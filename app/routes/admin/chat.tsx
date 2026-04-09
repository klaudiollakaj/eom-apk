import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getFlaggedMessages, resolveFlag, getMessages } from '~/server/fns/chat'

export const Route = createFileRoute('/admin/chat')({
  component: AdminChatPage,
})

function AdminChatPage() {
  const [tab, setTab] = useState<'pending' | 'resolved'>('pending')
  const [data, setData] = useState<any>({ flags: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [viewingChat, setViewingChat] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])

  async function fetchFlags() {
    setLoading(true)
    try {
      const result = await getFlaggedMessages({ data: { status: tab } })
      setData(result)
    } catch (err) {
      console.error('Failed to fetch flagged messages:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFlags() }, [tab])

  async function handleResolve(flagId: string, resolution: 'dismissed' | 'warned') {
    await resolveFlag({ data: { flagId, resolution } })
    fetchFlags()
  }

  async function handleViewChat(negotiationId: string) {
    setViewingChat(negotiationId)
    try {
      const result = await getMessages({ data: { negotiationId, limit: 100 } })
      setChatMessages(result.messages)
    } catch {
      setChatMessages([])
    }
  }

  const FLAG_TYPE_LABELS: Record<string, string> = {
    phone: 'Phone Number',
    email: 'Email Address',
    social: 'Social Handle',
    url: 'URL/Website',
    messaging_app: 'Messaging App',
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Chat Moderation</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'pending' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          Flagged ({tab === 'pending' ? data.total : '...'})
        </button>
        <button
          onClick={() => setTab('resolved')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          Resolved
        </button>
      </div>

      {data.flags.length === 0 ? (
        <div className="rounded-lg border p-8 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {tab === 'pending' ? 'No flagged messages. All clear!' : 'No resolved flags yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.flags.map((f: any) => (
            <div key={f.id} className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                      {FLAG_TYPE_LABELS[f.flagType] ?? f.flagType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(f.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded border bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-gray-700 dark:text-gray-300">{f.message?.content}</p>
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Matched: &quot;{f.matchedContent}&quot;
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    <strong>{f.message?.sender?.name}</strong>
                    {' → '}
                    Negotiation: {f.message?.negotiation?.service?.title} · {f.message?.negotiation?.event?.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {f.message?.negotiation?.organizer?.name} ↔ {f.message?.negotiation?.provider?.name}
                  </p>
                  {f.resolution && (
                    <p className="mt-1 text-xs text-green-600">
                      Resolved: {f.resolution} by {f.resolvedByUser?.name}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    onClick={() => handleViewChat(f.message?.negotiationId)}
                    className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    View Chat
                  </button>
                  {!f.resolvedAt && (
                    <>
                      <button
                        onClick={() => handleResolve(f.id, 'dismissed')}
                        className="rounded border border-green-300 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleResolve(f.id, 'warned')}
                        className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                      >
                        Warn User
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat viewer modal */}
      {viewingChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewingChat(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Conversation</h3>
              <button onClick={() => setViewingChat(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-3">
              {chatMessages.map((msg: any) => (
                <div key={msg.id} className="rounded border p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium">{msg.sender?.name}</span>
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{msg.content}</p>
                </div>
              ))}
              {chatMessages.length === 0 && <p className="text-gray-400 text-sm">No messages in this conversation.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
