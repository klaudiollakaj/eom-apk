import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getEvent } from '~/server/fns/events'
import {
  getOrganizerEventSales,
  getEventAttendeeList,
  validateTicket,
} from '~/server/fns/tickets'

export const Route = createFileRoute('/organizer/events/$eventId/sales')({
  loader: async ({ params }) => {
    const [event, sales, attendees] = await Promise.all([
      getEvent({ data: { eventId: params.eventId } }),
      getOrganizerEventSales({ data: { eventId: params.eventId } }),
      getEventAttendeeList({ data: { eventId: params.eventId } }),
    ])
    return { event, sales, attendees }
  },
  component: SalesDashboardPage,
})

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function SalesDashboardPage() {
  const { event, sales: initialSales, attendees: initialAttendees } = Route.useLoaderData()
  const [sales, setSales] = useState(initialSales)
  const [attendees, setAttendees] = useState(initialAttendees)
  const [search, setSearch] = useState('')
  const [checkingIn, setCheckingIn] = useState<string | null>(null)

  async function refresh() {
    const [freshSales, freshAttendees] = await Promise.all([
      getOrganizerEventSales({ data: { eventId: event.id } }),
      getEventAttendeeList({ data: { eventId: event.id, search: search || undefined } }),
    ])
    setSales(freshSales)
    setAttendees(freshAttendees)
  }

  async function handleExportCsv() {
    const allAttendees = await getEventAttendeeList({
      data: { eventId: event.id },
    })

    const statusLabel = (s: string) =>
      s === 'checked_in' ? 'Checked In' : s === 'refunded' ? 'Refunded' : 'Valid'

    const escapeCell = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    const header = ['Name', 'Email', 'Tier', 'Status', 'Checked In At']
    const rows = allAttendees.map((a) => [
      escapeCell(a.attendee.name),
      escapeCell(a.attendee.email),
      escapeCell(a.tier.name),
      statusLabel(a.status),
      a.checkedInAt ? new Date(a.checkedInAt).toLocaleString() : '',
    ])

    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${event.title}-attendees.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleSearch(value: string) {
    setSearch(value)
    const result = await getEventAttendeeList({
      data: { eventId: event.id, search: value || undefined },
    })
    setAttendees(result)
  }

  async function handleManualCheckIn(ticketId: string) {
    setCheckingIn(ticketId)
    try {
      const result = await validateTicket({
        data: { token: ticketId, eventId: event.id, manual: true },
      })
      if (!result.success) {
        alert(`Check-in failed: ${result.reason}`)
      }
      await refresh()
    } finally {
      setCheckingIn(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Sales & Attendees</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportCsv}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            Export CSV
          </button>
          <Link
            to="/organizer/events/$eventId/tickets"
            params={{ eventId: event.id }}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            Manage Tiers
          </Link>
          <Link
            to="/staff/scan/$eventId"
            params={{ eventId: event.id }}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Open Scanner
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatPrice(sales.totalRevenueCents)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Revenue</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold">{sales.totalSold}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Tickets Sold</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {sales.checkedIn} ({(sales.checkInRate * 100).toFixed(0)}%)
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Checked In</div>
        </div>
      </div>

      {/* Per-tier breakdown */}
      <h2 className="mt-8 mb-3 text-lg font-bold">By Tier</h2>
      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Tier</th>
              <th className="px-4 py-3 text-left font-medium">Price</th>
              <th className="px-4 py-3 text-left font-medium">Sold</th>
              <th className="px-4 py-3 text-left font-medium">Checked In</th>
              <th className="px-4 py-3 text-left font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {sales.perTier.map((t) => (
              <tr key={t.tierId} className="bg-white dark:bg-gray-900">
                <td className="px-4 py-3 font-medium">{t.tierName}</td>
                <td className="px-4 py-3">{formatPrice(t.priceCents)}</td>
                <td className="px-4 py-3">{t.sold}</td>
                <td className="px-4 py-3">{t.checkedIn}</td>
                <td className="px-4 py-3">{formatPrice(t.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Attendee list */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold">Attendees</h2>
        <input
          type="search"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-72 rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {attendees.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed p-10 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No attendees yet.</p>
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Tier</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {attendees.map((a) => (
                <tr key={a.ticketId} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3">{a.attendee.name}</td>
                  <td className="px-4 py-3 text-gray-500">{a.attendee.email}</td>
                  <td className="px-4 py-3">{a.tier.name}</td>
                  <td className="px-4 py-3">
                    {a.status === 'checked_in' ? (
                      <span className="text-green-600 dark:text-green-400">
                        Checked in
                        {a.checkedInAt && (
                          <span className="ml-1 text-xs text-gray-500">
                            {new Date(a.checkedInAt).toLocaleTimeString()}
                          </span>
                        )}
                      </span>
                    ) : a.status === 'refunded' ? (
                      <span className="text-red-600 dark:text-red-400">Refunded</span>
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">Valid</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'valid' && (
                      <button
                        onClick={() => handleManualCheckIn(a.ticketId)}
                        disabled={checkingIn === a.ticketId}
                        className="text-xs text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
                      >
                        {checkingIn === a.ticketId ? 'Checking in...' : 'Check In'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
