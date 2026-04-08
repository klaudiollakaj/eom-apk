import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listMyNegotiations } from '~/server/fns/negotiations'
import { NegotiationCard } from '~/components/negotiations/NegotiationCard'

export const Route = createFileRoute('/service-provider/negotiations/')({
  component: ProviderNegotiationsPage,
})

function ProviderNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    listMyNegotiations({ data: { status: statusFilter || undefined } }).then(setNegotiations)
  }, [statusFilter])

  const STATUSES = ['', 'requested', 'offered', 'countered', 'accepted', 'rejected', 'cancelled', 'expired']

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">My Negotiations</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {negotiations.map((n) => (
          <NegotiationCard
            key={n.id}
            id={n.id}
            status={n.status}
            event={n.event}
            service={n.service}
            otherParty={n.organizer}
            lastPrice={n.rounds?.[0]?.price ?? null}
            updatedAt={n.updatedAt}
            linkPrefix="/service-provider/negotiations"
          />
        ))}
        {negotiations.length === 0 && <p className="text-gray-500">No negotiations yet.</p>}
      </div>
    </div>
  )
}
