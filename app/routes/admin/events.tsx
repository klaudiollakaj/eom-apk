import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listAllEvents, toggleFeatured, cancelEvent, archiveEvent } from '~/server/fns/events'
import { listAllCategories } from '~/server/fns/categories'
import { EventStatusBadge } from '~/components/events/EventStatusBadge'

export const Route = createFileRoute('/admin/events')({
  component: AdminEventsPage,
})

function AdminEventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  async function fetchEvents() {
    const result = await listAllEvents({
      data: {
        status: statusFilter || undefined,
        categoryId: categoryFilter || undefined,
        search: search || undefined,
        offset,
        limit,
      },
    })
    setEvents(result.events)
    setTotal(result.total)
  }

  useEffect(() => { fetchEvents() }, [statusFilter, categoryFilter, search, offset])
  useEffect(() => { listAllCategories().then(setCategories) }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Event Moderation</h1>

      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOffset(0) }}
          placeholder="Search by title..."
          className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setOffset(0) }}
          className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="cancelled">Cancelled</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setOffset(0) }}
          className="rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Organizer</th>
              <th className="px-4 py-3 text-left font-medium">Category</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Featured</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {events.map((event) => (
              <tr key={event.id} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium">{event.title}</td>
                <td className="px-4 py-3 text-gray-500">{event.organizer?.name}</td>
                <td className="px-4 py-3 text-gray-500">{event.category?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(event.startDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3"><EventStatusBadge status={event.status} /></td>
                <td className="px-4 py-3">
                  <button
                    onClick={async () => {
                      await toggleFeatured({ data: { id: event.id } })
                      fetchEvents()
                    }}
                    className={`rounded px-2 py-1 text-xs ${
                      event.isFeatured
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                  >
                    {event.isFeatured ? 'Featured' : 'Not Featured'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      to="/events/$eventId"
                      params={{ eventId: event.id }}
                      className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      View
                    </Link>
                    {event.status === 'published' && (
                      <button
                        onClick={async () => {
                          if (confirm('Cancel this event?')) {
                            await cancelEvent({ data: { id: event.id } })
                            fetchEvents()
                          }
                        }}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Cancel
                      </button>
                    )}
                    {(event.status === 'published' || event.status === 'cancelled') && (
                      <button
                        onClick={async () => {
                          if (confirm('Archive this event?')) {
                            await archiveEvent({ data: { id: event.id } })
                            fetchEvents()
                          }
                        }}
                        className="text-xs text-gray-600 hover:underline dark:text-gray-400"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">Showing {offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
        <div className="flex gap-2">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            Previous
          </button>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
