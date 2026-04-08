import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listMyServices } from '~/server/fns/services'
import { listMyNegotiations } from '~/server/fns/negotiations'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'

export const Route = createFileRoute('/service-provider/')({
  component: ProviderDashboard,
})

function ProviderDashboard() {
  const [services, setServices] = useState<any[]>([])
  const [negotiations, setNegotiations] = useState<any[]>([])

  useEffect(() => {
    listMyServices().then(setServices)
    listMyNegotiations({ data: {} }).then(setNegotiations)
  }, [])

  const activeNegotiations = negotiations.filter((n) =>
    !['accepted', 'rejected', 'cancelled', 'expired'].includes(n.status),
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Service Provider Dashboard</h1>
        <Link to="/service-provider/services/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + New Service
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <p className="text-2xl font-bold">{services.length}</p>
          <p className="text-sm text-gray-500">Services</p>
        </div>
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <p className="text-2xl font-bold">{activeNegotiations.length}</p>
          <p className="text-sm text-gray-500">Active Negotiations</p>
        </div>
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <p className="text-2xl font-bold">{negotiations.filter((n) => n.status === 'accepted').length}</p>
          <p className="text-sm text-gray-500">Deals Closed</p>
        </div>
      </div>

      <h2 className="mb-4 text-lg font-bold">My Services</h2>
      {services.length === 0 ? (
        <p className="text-gray-500">No services yet. Create your first listing!</p>
      ) : (
        <div className="mb-8 space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-gray-500">{s.category?.name} — {s.packages.length} package(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
                <Link to="/service-provider/services/$serviceId/edit" params={{ serviceId: s.id }} className="rounded border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Recent Negotiations</h2>
        <Link to="/service-provider/negotiations" className="text-sm text-indigo-600 hover:underline">View all</Link>
      </div>
      {negotiations.slice(0, 5).map((n) => (
        <Link
          key={n.id}
          to="/service-provider/negotiations/$negotiationId"
          params={{ negotiationId: n.id }}
          className="mb-2 flex items-center justify-between rounded-lg border p-3 dark:border-gray-700 hover:shadow-sm"
        >
          <div>
            <p className="text-sm font-medium">{n.service?.title}</p>
            <p className="text-xs text-gray-500">for {n.event?.title} — {n.organizer?.name}</p>
          </div>
          <NegotiationStatusBadge status={n.status} />
        </Link>
      ))}
    </div>
  )
}
