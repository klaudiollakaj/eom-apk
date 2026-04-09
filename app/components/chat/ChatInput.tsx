// app/components/chat/ChatInput.tsx
import { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  disabledReason?: string
}

export function ChatInput({ onSend, disabled, disabledReason }: ChatInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const content = text.trim()
    if (!content || sending || disabled) return

    setSending(true)
    setError(null)
    try {
      await onSend(content)
      setText('')
      inputRef.current?.focus()
    } catch (e: any) {
      if (e.message?.includes('RATE_LIMIT')) {
        setError('Slow down — too many messages. Try again in a minute.')
      } else {
        setError('Failed to send message')
      }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (disabled) {
    return (
      <div className="border-t bg-gray-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-sm text-gray-400">{disabledReason || 'Chat is not available'}</p>
      </div>
    )
  }

  return (
    <div className="border-t px-4 py-3 dark:border-gray-700">
      {error && (
        <p className="mb-2 text-xs text-red-500">{error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-800 dark:focus:border-indigo-600"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
