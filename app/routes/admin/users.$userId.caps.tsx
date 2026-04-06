import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getUserCapabilities,
  updateUserCapability,
} from '~/server/fns/capabilities'
import { listAllNavLinks } from '~/server/fns/navigation'

const STAFF_CAPABILITIES = [
  { key: 'economics:view', label: 'View Economics', category: 'Economics' },
  { key: 'economics:export', label: 'Export Economics', category: 'Economics' },
  { key: 'stats:view', label: 'View Statistics', category: 'Statistics' },
  { key: 'stats:export', label: 'Export Statistics', category: 'Statistics' },
]

const ADMIN_CAPABILITIES = [
  { key: 'admin:users:manage', label: 'Manage Users', category: 'Admin' },
  { key: 'admin:logs:view', label: 'View Logs', category: 'Admin' },
  { key: 'admin:navigation:manage', label: 'Manage Navigation', category: 'Admin' },
  { key: 'admin:permissions:manage', label: 'Manage Permissions', category: 'Admin' },
  { key: 'admin:capabilities:manage', label: 'Manage Capabilities', category: 'Admin' },
  { key: 'admin:suspend:manage', label: 'Manage Suspension', category: 'Admin' },
  { key: 'admin:ads:manage', label: 'Manage Ads (Phase 7)', category: 'Admin' },
  { key: 'admin:coupons:manage', label: 'Manage Coupons (Phase 5)', category: 'Admin' },
  { key: 'admin:viewer:access', label: 'Viewer Access (Phase 7)', category: 'Admin' },
]

export const Route = createFileRoute('/admin/users/$userId/caps')({
  component: UserCapsPage,
})

function UserCapsPage() {
  const { userId } = Route.useParams()
  const [userCaps, setUserCaps] = useState<any[]>([])
  const [pageCapabilities, setPageCapabilities] = useState<
    { key: string; label: string; category: string }[]
  >([])

  async function fetchData() {
    const caps = await getUserCapabilities({ data: { userId } })
    setUserCaps(caps)

    // Get internal nav links for pages:edit:* capabilities
    const navLinks = await listAllNavLinks()
    const pageCaps = navLinks
      .filter((l: any) => !l.isExternal)
      .map((l: any) => ({
        key: `pages:edit:${l.url.replace(/^\//, '')}`,
        label: `Edit ${l.label} (${l.url})`,
        category: 'Public Pages',
      }))
    setPageCapabilities(pageCaps)
  }

  useEffect(() => { fetchData() }, [userId])

  function isGranted(capKey: string) {
    return userCaps.some((c: any) => c.capability === capKey && c.granted)
  }

  async function toggleCap(capKey: string) {
    const current = isGranted(capKey)
    await updateUserCapability({
      data: { userId, capability: capKey, granted: !current },
    })
    fetchData()
  }

  const allCaps = [...pageCapabilities, ...STAFF_CAPABILITIES, ...ADMIN_CAPABILITIES]

  // Group by category
  const grouped = allCaps.reduce(
    (acc, cap) => {
      if (!acc[cap.category]) acc[cap.category] = []
      acc[cap.category].push(cap)
      return acc
    },
    {} as Record<string, typeof allCaps>,
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Capabilities</h1>
      <p className="text-sm text-gray-500">User ID: {userId}</p>

      {Object.entries(grouped).map(([category, caps]) => (
        <div key={category}>
          <h2 className="mb-2 text-lg font-semibold">{category}</h2>
          <div className="space-y-2 rounded-lg border bg-white p-4">
            {caps.map((cap) => (
              <label
                key={cap.key}
                className="flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium">{cap.label}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {cap.key}
                  </span>
                </div>
                <button
                  onClick={() => toggleCap(cap.key)}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    isGranted(cap.key)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isGranted(cap.key) ? 'Granted' : 'Not Granted'}
                </button>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
