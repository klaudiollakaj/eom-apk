import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getPublishingPermissions,
  updatePublishingPermission,
} from '~/server/fns/permissions'
import { ROLES } from '~/lib/permissions'

// Roles shown in the matrix (exclude staff — they edit pages, not publish)
const MATRIX_ROLES = ROLES.filter((r) => r !== 'staff')

export const Route = createFileRoute('/admin/permissions')({
  component: PermissionsPage,
})

function PermissionsPage() {
  const [pages, setPages] = useState<any[]>([])
  const [perms, setPerms] = useState<any[]>([])

  async function fetchData() {
    const result = await getPublishingPermissions()
    setPages(result.publishablePages)
    setPerms(result.permissions)
  }

  useEffect(() => { fetchData() }, [])

  function isGranted(role: string, targetPage: string) {
    if (role === 'admin' || role === 'superadmin') return true
    return perms.some(
      (p: any) => p.role === role && p.targetPage === targetPage && p.canPublish,
    )
  }

  async function togglePerm(role: string, targetPage: string) {
    const current = isGranted(role, targetPage)
    await updatePublishingPermission({
      data: { role, targetPage, canPublish: !current },
    })
    fetchData()
  }

  if (pages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Publishing Permissions</h1>
        <p className="text-gray-500 dark:text-gray-400">
          No publishable pages configured. Mark navigation links as
          "publishable" in Navigation Management first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Publishing Permissions</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Control which roles can publish content to each page.
      </p>

      <div className="overflow-x-auto rounded-lg border dark:border-gray-700">
        <table className="min-w-full divide-y dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                Role
              </th>
              {pages.map((page: any) => (
                <th
                  key={page.url}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300"
                >
                  {page.label}
                  <br />
                  <span className="font-normal text-gray-400 dark:text-gray-500">
                    {page.url}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-gray-700 bg-white dark:bg-gray-800">
            {MATRIX_ROLES.map((role) => {
              const isAdminRole = role === 'admin' || role === 'superadmin'
              return (
                <tr key={role}>
                  <td className="px-4 py-3 text-sm font-medium">{role}</td>
                  {pages.map((page: any) => (
                    <td key={page.url} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isGranted(role, page.url)}
                        disabled={isAdminRole}
                        onChange={() => togglePerm(role, page.url)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
