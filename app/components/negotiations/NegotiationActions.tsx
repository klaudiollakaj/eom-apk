// app/components/negotiations/NegotiationActions.tsx
import { useState } from 'react'

interface NegotiationActionsProps {
  negotiationId: string
  status: string
  canRespond: boolean // true if it's this user's turn
  onRespond: (action: 'accept' | 'reject' | 'counter' | 'offer', price?: string, message?: string) => Promise<void>
  onCancel: () => Promise<void>
  isQuoteRequest?: boolean // true if status=requested and user is provider
}

export function NegotiationActions({
  negotiationId, status, canRespond, onRespond, onCancel, isQuoteRequest,
}: NegotiationActionsProps) {
  const [showCounter, setShowCounter] = useState(false)
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const isTerminal = ['accepted', 'rejected', 'cancelled', 'expired'].includes(status)

  if (isTerminal) return null

  async function handleAction(action: 'accept' | 'reject' | 'counter' | 'offer') {
    setLoading(true)
    try {
      await onRespond(action, price || undefined, message || undefined)
      setShowCounter(false)
      setPrice('')
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  // Provider responding to quote request
  if (isQuoteRequest) {
    return (
      <div className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
        <p className="text-sm font-medium">Send your offer:</p>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (\u20AC)"
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Terms and conditions..."
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('offer')}
            disabled={loading || !price}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send Offer
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!canRespond) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-700">
        <p className="text-sm text-gray-500">Waiting for the other party to respond...</p>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Withdraw
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
      {!showCounter ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('accept')}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => setShowCounter(true)}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Counter
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Withdraw
          </button>
        </div>
      ) : (
        <>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Your counter price (\u20AC)"
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Terms and conditions..."
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('counter')}
              disabled={loading || !price}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Send Counter
            </button>
            <button
              onClick={() => setShowCounter(false)}
              className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
