// app/components/chat/ChatTab.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatThread, type ChatMessage } from './ChatThread'
import { ChatInput } from './ChatInput'
import { sendMessage, getMessages, markAsRead, getChatStatus } from '~/server/fns/chat'

interface ChatTabProps {
  negotiationId: string
  currentUserId: string
}

export function ChatTab({ negotiationId, currentUserId }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [chatStatus, setChatStatus] = useState<{ status: 'active' | 'readonly' | 'locked'; reason?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load initial messages + status
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const [statusResult, msgResult] = await Promise.all([
          getChatStatus({ data: { negotiationId } }),
          getMessages({ data: { negotiationId } }),
        ])
        if (!mounted) return
        setChatStatus(statusResult)
        setMessages(msgResult.messages)
        setHasMore(msgResult.hasMore)
        setNextCursor(msgResult.nextCursor)
        if (msgResult.otherReadAt) setOtherReadAt(msgResult.otherReadAt)

        // Mark as read if there are messages
        const lastMsg = msgResult.messages[msgResult.messages.length - 1]
        if (lastMsg) {
          markAsRead({ data: { negotiationId, messageId: lastMsg.id } })
        }
      } catch (err) {
        console.error('Failed to init chat:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()
    return () => { mounted = false }
  }, [negotiationId])

  // SSE connection with polling fallback
  useEffect(() => {
    if (chatStatus?.status === 'locked') return

    let reconnectDelay = 1000
    let sseActive = false

    function connectSSE() {
      const es = new EventSource(`/api/chat-stream?negotiationId=${negotiationId}`)
      eventSourceRef.current = es

      es.onopen = () => {
        sseActive = true
        reconnectDelay = 1000
        // Stop polling if active
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }

      es.onmessage = (event) => {
        try {
          const msg: ChatMessage = JSON.parse(event.data)
          setMessages((prev) => {
            // Dedupe
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // Auto-mark as read if from other party
          if (msg.senderId !== currentUserId) {
            markAsRead({ data: { negotiationId, messageId: msg.id } })
          }
        } catch {}
      }

      es.onerror = () => {
        sseActive = false
        es.close()
        eventSourceRef.current = null

        // Start polling fallback
        startPolling()

        // Attempt reconnect with exponential backoff
        setTimeout(() => {
          connectSSE()
          reconnectDelay = Math.min(reconnectDelay * 2, 30000)
        }, reconnectDelay)
      }
    }

    function startPolling() {
      if (pollIntervalRef.current) return
      pollIntervalRef.current = setInterval(async () => {
        if (sseActive) return
        try {
          const result = await getMessages({ data: { negotiationId } })
          setMessages(result.messages)
        } catch {}
      }, 5000)
    }

    connectSSE()

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [negotiationId, currentUserId, chatStatus?.status])

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return
    try {
      const result = await getMessages({ data: { negotiationId, cursor: nextCursor } })
      setMessages((prev) => [...result.messages, ...prev])
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
    } catch {}
  }, [negotiationId, nextCursor])

  const handleSend = useCallback(async (content: string) => {
    const msg = await sendMessage({ data: { negotiationId, content } })
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [negotiationId])

  if (loading) {
    return <p className="p-4 text-sm text-gray-400">Loading chat...</p>
  }

  if (chatStatus?.status === 'locked') {
    return null // Tab shouldn't be visible when locked
  }

  const isReadonly = chatStatus?.status === 'readonly'

  return (
    <div className="flex flex-col" style={{ height: '500px' }}>
      <ChatThread
        messages={messages}
        currentUserId={currentUserId}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        otherReadAt={otherReadAt}
      />
      <ChatInput
        onSend={handleSend}
        disabled={isReadonly}
        disabledReason={chatStatus?.reason}
      />
    </div>
  )
}
