import { useState } from 'react'
import { transferTicket } from '~/server/fns/tickets'

export interface TransferModalProps {
  ticketId: string
  onClose: () => void
  onSuccess: () => void
}

export function TransferModal({ ticketId, onClose, onSuccess }: TransferModalProps) {
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim()) return setError('Email is required')
    setSubmitting(true)
    try {
      await transferTicket({
        data: { ticketId, recipientEmail: email.trim(), note: note || undefined },
      })
      onSuccess()
    } catch (err: any) {
      const msg = err?.message || 'Transfer failed'
      const friendly: Record<string, string> = {
        USER_NOT_FOUND: 'No user found with that email.',
        CANNOT_TRANSFER_TO_SELF: "You can't transfer to yourself.",
        NOT_TRANSFERABLE: 'This ticket cannot be transferred.',
        EVENT_STARTED: 'The event has already started.',
        RECIPIENT_MAX_PER_USER_EXCEEDED:
          'Recipient already has the maximum tickets for this tier.',
      }
      setError(friendly[msg] || msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-bold">Transfer Ticket</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Recipient Email</label>
            <input
              type="email"
              className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="friend@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Note (optional)</label>
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Warning: once transferred, you can't undo this.
          </p>
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
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
