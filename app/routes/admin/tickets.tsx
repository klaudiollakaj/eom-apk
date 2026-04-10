import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  getAdminTicketStats,
  listOrdersForAdmin,
  adminForceRefund,
} from '~/server/fns/tickets'

export const Route = createFileRoute('/admin/tickets')({
  loader: async () => {
    const [stats, ordersResult] = await Promise.all([
      getAdminTicketStats(),
      listOrdersForAdmin({ data: {} }),
    ])
    return { stats, ordersResult }
  },
  component: AdminTicketsPage,
})

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function AdminTicketsPage() {
  const { stats, ordersResult } = Route.useLoaderData()
  const [orders, setOrders] = useState(ordersResult.orders)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selected, setSelected] = useState<any>(null)
  const [refunding, setRefunding] = useState<string | null>(null)

  async function applyFilter(status: string) {
    setStatusFilter(status)
    const r = await listOrdersForAdmin({
      data: { status: status || undefined },
    })
    setOrders(r.orders)
  }

  async function handleForceRefund(ticketId: string) {
    if (!confirm('Force refund this ticket?')) return
    setRefunding(ticketId)
    try {
      await adminForceRefund({ data: { ticketId } })
      const r = await listOrdersForAdmin({ data: { status: statusFilter || undefined } })
      setOrders(r.orders)
      if (selected) {
        const updated = r.orders.find((o: any) => o.id === selected.id)
        if (updated) setSelected(updated)
      }
    } catch (err: any) {
      alert(`Refund failed: ${err?.message}`)
    } finally {
      setRefunding(null)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Tickets</h1>

      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {formatPrice(stats.totalRevenueCents)}
          </div>
          <div className="text-xs text-gray-500">Total Revenue</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold">{stats.totalOrders}</div>
          <div className="text-xs text-gray-500">Orders</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold">{stats.totalTickets}</div>
          <div className="text-xs text-gray-500">Tickets Issued</div>
        </div>
        <div className="rounded-lg border bg-white p-4 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {(stats.refundRate * 100).toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            Refund Rate ({stats.refundedTickets})
          </div>
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b dark:border-gray-700">
        {[
          { label: 'All', value: '' },
          { label: 'Paid', value: 'paid' },
          { label: 'Refunded', value: 'refunded' },
          { label: 'Partially Refunded', value: 'partially_refunded' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => applyFilter(tab.value)}
            className={`pb-2 text-sm ${
              statusFilter === tab.value
                ? 'border-b-2 border-indigo-600 font-medium text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Order #</th>
              <th className="px-4 py-3 text-left font-medium">Event</th>
              <th className="px-4 py-3 text-left font-medium">Buyer</th>
              <th className="px-4 py-3 text-left font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  No orders
                </td>
              </tr>
            ) : (
              orders.map((o: any) => (
                <tr
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="cursor-pointer bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800"
                >
                  <td className="px-4 py-3 font-mono text-xs">{o.orderNumber}</td>
                  <td className="px-4 py-3">{o.event.title}</td>
                  <td className="px-4 py-3">{o.user.name}</td>
                  <td className="px-4 py-3">{formatPrice(o.totalCents)}</td>
                  <td className="px-4 py-3">{o.status}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(o.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Order {selected.orderNumber}</h2>
                <p className="text-sm text-gray-500">
                  {selected.event.title} · {formatPrice(selected.totalCents)}
                </p>
                <p className="text-sm text-gray-500">
                  {selected.user.name} ({selected.user.email})
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <h3 className="mt-4 mb-2 text-sm font-semibold">Tickets</h3>
            <div className="divide-y dark:divide-gray-700">
              {selected.tickets.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="text-sm font-medium">{t.tier.name}</div>
                    <div className="text-xs text-gray-500">
                      {t.status} · {formatPrice(t.tier.priceCents)}
                    </div>
                  </div>
                  {t.status === 'valid' && (
                    <button
                      disabled={refunding === t.id}
                      onClick={() => handleForceRefund(t.id)}
                      className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 disabled:opacity-50 dark:border-red-700 dark:text-red-400"
                    >
                      {refunding === t.id ? 'Refunding...' : 'Force Refund'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
