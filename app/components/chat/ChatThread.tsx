// app/components/chat/ChatThread.tsx
import { useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  senderId: string
  content: string
  createdAt: string | Date
  sender: { id: string; name: string; image: string | null }
}

interface ChatThreadProps {
  messages: ChatMessage[]
  currentUserId: string
  hasMore: boolean
  onLoadMore: () => void
  otherReadAt?: string | null
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(dateStr: string | Date): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string | Date): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ChatThread({ messages, currentUserId, hasMore, onLoadMore, otherReadAt }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const container = containerRef.current
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
        if (isNearBottom) {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  // Scroll to bottom on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [])

  // Group messages by date
  let lastDate = ''

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="mx-auto block text-xs text-indigo-600 hover:underline"
        >
          Load older messages
        </button>
      )}

      {messages.map((msg) => {
        const isMe = msg.senderId === currentUserId
        const dateLabel = formatDate(msg.createdAt)
        const showDate = dateLabel !== lastDate
        lastDate = dateLabel

        // Check if the other party has read up to this message
        const isRead = isMe && otherReadAt && new Date(msg.createdAt) <= new Date(otherReadAt)

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-3 text-center text-xs text-gray-400">{dateLabel}</div>
            )}
            <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '75%', marginLeft: isMe ? 'auto' : undefined }}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isMe ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                }`}
              >
                {isMe ? 'You' : getInitials(msg.sender.name)}
              </div>
              <div>
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-sm ${
                    isMe
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm border bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`mt-1 text-[10px] text-gray-400 ${isMe ? 'text-right' : ''}`}>
                  {isMe ? 'You' : msg.sender.name} · {formatTime(msg.createdAt)}
                  {isRead && <span className="ml-1">· Read</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
