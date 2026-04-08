import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listAllServices } from '~/server/fns/services'

export const Route = createFileRoute('/admin/services')({
  component: AdminServicesPage,
})

function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([])

  useEffect(() => { listAllServices().then(setServices) }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Services</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b dark:border-gray-700">
                <td className="px-4 py-2 font-medium">{s.title}</td>
                <td className="px-4 py-2">{s.category?.name}</td>
                <td className="px-4 py-2">{s.provider?.name}</td>
                <td className="px-4 py-2">
                  <span className={s.isActive ? 'text-green-600' : 'text-red-500'}>{s.isActive ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
