import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listUsersWithCapabilities } from '~/server/fns/capabilities'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/admin/capabilities')({
  component: CapabilitiesPage,
})

function CapabilitiesPage() {
  const [roleFilter, setRoleFilter] = useState('')
  const [data, setData] = useState<any[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    listUsersWithCapabilities({
      data: { roleFilter: roleFilter || undefined },
    }).then(setData)
  }, [roleFilter])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Capability Overview</h1>

      <select
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value)}
        className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
      >
        <option value="">All Roles</option>
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
      </select>

      <div className="rounded-lg border dark:border-gray-700">
        <table className="min-w-full divide-y dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Capabilities</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
            {data.map((item: any) => (
              <>
                <tr key={item.user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm">{item.user.name}</td>
                  <td className="px-4 py-3 text-sm">{item.user.email}</td>
                  <td className="px-4 py-3 text-sm"><RoleBadge role={item.user.role as Role} /></td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => setExpandedUser(expandedUser === item.user.id ? null : item.user.id)}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {item.capabilities.length} capabilities
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/admin/users/${item.user.id}/caps`}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
                {expandedUser === item.user.id && (
                  <tr key={`${item.user.id}-caps`}>
                    <td colSpan={5} className="bg-gray-50 dark:bg-gray-900 px-8 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.capabilities.map((cap: string) => (
                          <span key={cap} className="rounded bg-indigo-100 dark:bg-indigo-900 px-2 py-1 text-xs text-indigo-700 dark:text-indigo-300">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
