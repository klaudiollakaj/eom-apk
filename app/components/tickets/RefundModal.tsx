import { useState } from 'react'
import { refundTicket } from '~/server/fns/tickets'

export interface RefundModalProps {
  ticketId: string
  amountCents: number
  onClose: () => void
  onSuccess: () => void
}

export function RefundModal({
  ticketId,
  amountCents,
  onClose,
  onSuccess,
}: RefundModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await refundTicket({
        data: { ticketId, reason: reason || undefined },
      })
      onSuccess()
    } catch (err: any) {
      const msg = err?.message || 'Refund failed'
      const friendly: Record<string, string> = {
        NOT_REFUNDABLE: 'This ticket cannot be refunded.',
        EVENT_STARTED: 'The event has already started.',
      }
      setError(friendly[msg] || msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="mb-2 text-lg font-bold">Refund Ticket</h2>
        <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          You'll receive{' '}
          <span className="font-semibold">${(amountCents / 100).toFixed(2)}</span>{' '}
          back (demo mode — no actual refund).
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Reason (optional)</label>
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border px-4 py-2 text-sm dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
