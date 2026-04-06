import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getDashboardStats } from '~/server/fns/dashboard'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    getDashboardStats().then(setStats)
  }, [])

  if (!stats) return <p>Loading...</p>

  const hasAnyStats =
    stats.totalUsers != null || stats.recentLogs != null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {!hasAnyStats && (
        <div className="rounded-lg border bg-gray-50 p-6 text-center">
          <p className="text-gray-600">
            Welcome! Contact your Superadmin to get access to admin features.
          </p>
        </div>
      )}

      {stats.totalUsers != null && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
          </div>
          {stats.usersByRole &&
            Object.entries(stats.usersByRole).map(([role, ct]) => (
              <div key={role} className="rounded-lg border bg-white p-4">
                <RoleBadge role={role as Role} />
                <p className="mt-1 text-lg font-semibold">{ct as number}</p>
              </div>
            ))}
        </div>
      )}

      {stats.recentUsers && stats.recentUsers.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            Recent Accounts (last 7 days)
          </h2>
          <div className="rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {stats.recentUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 text-sm">{u.name}</td>
                    <td className="px-4 py-2 text-sm">{u.email}</td>
                    <td className="px-4 py-2 text-sm">
                      <RoleBadge role={u.role as Role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.recentLogs && stats.recentLogs.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            Recent Activity (last 10)
          </h2>
          <div className="rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Action
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {stats.recentLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-sm">{log.action}</td>
                    <td className="px-4 py-2 text-sm">
                      {log.user?.name ?? 'System'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
