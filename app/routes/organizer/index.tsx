import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { useSession, signOut } from '~/lib/auth-client'
import { listOrganizerEvents } from '~/server/fns/events'
import { EventStatusBadge } from '~/components/events/EventStatusBadge'
import type { Role } from '~/lib/permissions'
import { RoleBadge } from '~/components/ui/RoleBadge'
import { OrganizerAnalyticsSection } from '~/components/analytics/OrganizerAnalyticsSection'
import { getReviewableDeals } from '~/server/fns/reviews'
import { ReviewModal } from '~/components/reviews/ReviewModal'

export const Route = createFileRoute('/organizer/')({
  component: OrganizerDashboard,
})

function OrganizerDashboard() {
  const navigate = useNavigate()
  const session = useSession()
  const user = session.data?.user
  const [events, setEvents] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [reviewableDeals, setReviewableDeals] = useState<any[]>([])
  const [reviewTarget, setReviewTarget] = useState<any>(null)

  async function fetchEvents() {
    const result = await listOrganizerEvents({
      data: { status: statusFilter || undefined },
    })
    setEvents(Array.isArray(result) ? result : [])
  }

  useEffect(() => { fetchEvents() }, [statusFilter])

  function fetchReviewableDeals() {
    getReviewableDeals().then((r) => setReviewableDeals(Array.isArray(r) ? r : []))
  }

  useEffect(() => { fetchReviewableDeals() }, [])

  if (!user) return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>

  const published = events.filter((e) => e.status === 'published').length
  const drafts = events.filter((e) => e.status === 'draft').length
  const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 0), 0)

  const tabs = [
    { label: 'All', value: '', count: events.length },
    { label: 'Published', value: 'published', count: published },
    { label: 'Drafts', value: 'draft', count: drafts },
    { label: 'Cancelled', value: 'cancelled', count: events.filter((e) => e.status === 'cancelled').length },
    { label: 'Archived', value: 'archived', count: events.filter((e) => e.status === 'archived').length },
  ]

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Events</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Welcome back, {user.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <RoleBadge role={user.role as Role} />
          <Link
            to="/organizer/events/new"
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            + Create Event
          </Link>
          <button
            onClick={async () => { await signOut(); navigate({ to: '/login' }) }}
            className="rounded-md bg-red-600 px-3 py-2 text-sm text-white"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: events.length, color: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Published', value: published, color: 'text-green-600 dark:text-green-400' },
          { label: 'Drafts', value: drafts, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Total Capacity', value: totalCapacity, color: '' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-4 border-b dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`pb-2 text-sm ${
              statusFilter === tab.value
                ? 'border-b-2 border-indigo-600 font-medium text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="mt-10 text-center">
          <p className="text-gray-500 dark:text-gray-400">No events yet. Create your first event!</p>
          <Link
            to="/organizer/events/new"
            className="mt-4 inline-block rounded-md bg-indigo-600 px-6 py-2 text-sm text-white"
          >
            Create Event
          </Link>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Event</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Capacity</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {events.map((event) => (
                <tr key={event.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3">
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-gray-500">{event.category?.name}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(event.startDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3"><EventStatusBadge status={event.status} /></td>
                  <td className="px-4 py-3 text-gray-500">{event.capacity || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        to="/organizer/events/$eventId/edit"
                        params={{ eventId: event.id }}
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Edit
                      </Link>
                      {event.status === 'published' && (
                        <Link
                          to="/events/$eventId"
                          params={{ eventId: event.id }}
                          className="text-xs text-gray-600 hover:underline dark:text-gray-400"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(reviewableDeals?.length ?? 0) > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold">Pending Reviews ({reviewableDeals?.length ?? 0})</h2>
          <div className="space-y-2">
            {(reviewableDeals ?? []).map((deal: any) => (
              <div key={deal.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">{deal.providerName} — {deal.serviceTitle}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {deal.eventTitle} · Deal closed €{Number(deal.agreedPrice).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setReviewTarget(deal)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Leave Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviewTarget && (
        <ReviewModal
          eventServiceId={reviewTarget.id}
          providerName={reviewTarget.providerName}
          eventTitle={reviewTarget.eventTitle}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setReviewTarget(null)
            fetchReviewableDeals()
          }}
        />
      )}

      <OrganizerAnalyticsSection />
    </div>
  )
}
