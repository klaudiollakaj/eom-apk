import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listAllNegotiations } from '~/server/fns/negotiations'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'

export const Route = createFileRoute('/admin/negotiations')({
  component: AdminNegotiationsPage,
})

function AdminNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<any[]>([])

  useEffect(() => { listAllNegotiations().then(setNegotiations) }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Negotiations</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Organizer</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last Price</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {negotiations.map((n) => (
              <tr key={n.id} className="border-b dark:border-gray-700">
                <td className="px-4 py-2">{n.event?.title}</td>
                <td className="px-4 py-2">{n.service?.title}</td>
                <td className="px-4 py-2">{n.organizer?.name}</td>
                <td className="px-4 py-2">{n.provider?.name}</td>
                <td className="px-4 py-2"><NegotiationStatusBadge status={n.status} /></td>
                <td className="px-4 py-2">{n.rounds?.[0]?.price ? `€${Number(n.rounds[0].price).toFixed(2)}` : '—'}</td>
                <td className="px-4 py-2 text-xs text-gray-400">{new Date(n.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
