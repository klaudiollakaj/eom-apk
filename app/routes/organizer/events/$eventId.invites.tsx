import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getEvent } from '~/server/fns/events'
import { sendInvites, listEventInvites, revokeInvite } from '~/server/fns/invites'

export const Route = createFileRoute('/organizer/events/$eventId/invites')({
  loader: async ({ params }) => {
    const [event, invites] = await Promise.all([
      getEvent({ data: { eventId: params.eventId } }),
      listEventInvites({ data: { eventId: params.eventId } }),
    ])
    return { event, invites }
  },
  component: InvitesPage,
})

function InvitesPage() {
  const { event, invites: initialInvites } = Route.useLoaderData()
  const [invites, setInvites] = useState(initialInvites)
  const [emailInput, setEmailInput] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSend() {
    const emails = emailInput
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter(Boolean)
    if (emails.length === 0) return

    setSending(true)
    setMessage(null)
    try {
      const results = await sendInvites({ data: { eventId: event.id, emails } })
      const sent = results.filter((r) => r.status === 'sent').length
      const dupes = results.filter((r) => r.status === 'already_invited').length
      setMessage(`${sent} invite${sent !== 1 ? 's' : ''} sent${dupes ? `, ${dupes} already invited` : ''}`)
      setEmailInput('')
      // Refresh invites list
      const updated = await listEventInvites({ data: { eventId: event.id } })
      setInvites(updated)
    } catch (err: any) {
      setMessage(err.message || 'Failed to send invites')
    } finally {
      setSending(false)
    }
  }

  async function handleRevoke(inviteId: string) {
    await revokeInvite({ data: { inviteId } })
    setInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-2 text-2xl font-bold">{event.title}</h1>
      <div className="mb-6 flex gap-4 border-b dark:border-gray-700">
        <Link to="/organizer/events/$eventId/edit" params={{ eventId: event.id }} className="border-b-2 border-transparent pb-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
          Details
        </Link>
        <Link to="/organizer/events/$eventId/tickets" params={{ eventId: event.id }} className="border-b-2 border-transparent pb-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
          Tickets
        </Link>
        <Link to="/organizer/events/$eventId/sales" params={{ eventId: event.id }} className="border-b-2 border-transparent pb-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
          Sales
        </Link>
        <Link to="/organizer/events/$eventId/promo-codes" params={{ eventId: event.id }} className="border-b-2 border-transparent pb-2 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
          Promo Codes
        </Link>
        <span className="-mb-px border-b-2 border-indigo-600 pb-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
          Invites
        </span>
      </div>

      {event.visibility !== 'invite_only' && (
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-600 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            This event is set to <strong>{event.visibility}</strong> visibility. Invites are only enforced when visibility is set to <strong>Invite Only</strong>.
            <Link to="/organizer/events/$eventId/edit" params={{ eventId: event.id }} className="ml-1 underline">Change visibility</Link>
          </p>
        </div>
      )}

      <div className="mb-8 rounded-lg border bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-lg font-semibold">Send Invites</h2>
        <p className="mb-3 text-sm text-gray-500">Enter email addresses separated by commas or new lines.</p>
        <textarea
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          rows={3}
          placeholder="alice@example.com, bob@example.com"
          className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={sending || !emailInput.trim()}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Invites'}
          </button>
          {message && <span className="text-sm text-gray-600 dark:text-gray-400">{message}</span>}
        </div>
      </div>

      <div className="rounded-lg border bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="border-b px-6 py-3 dark:border-gray-700">
          <h2 className="font-semibold">Invited ({invites.length})</h2>
        </div>
        {invites.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">No invites sent yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Sent</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-6 py-3">{inv.email}</td>
                  <td className="px-6 py-3">{inv.user?.name || '—'}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.status === 'accepted'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                        : inv.status === 'declined'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                    }`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500">{new Date(inv.sentAt).toLocaleDateString()}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleRevoke(inv.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
