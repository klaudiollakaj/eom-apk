import { Link, useLocation } from '@tanstack/react-router'
import { useSession } from '~/lib/auth-client'

interface SidebarItem {
  label: string
  href: string
  capability: string | null // null = always visible
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', href: '/admin', capability: null },
  { label: 'Users', href: '/admin/users', capability: 'admin:users:manage' },
  { label: 'Logs', href: '/admin/logs', capability: 'admin:logs:view' },
  {
    label: 'Navigation',
    href: '/admin/navigation',
    capability: 'admin:navigation:manage',
  },
  {
    label: 'Permissions',
    href: '/admin/permissions',
    capability: 'admin:permissions:manage',
  },
  {
    label: 'Capabilities',
    href: '/admin/capabilities',
    capability: 'admin:capabilities:manage',
  },
]

export function AdminSidebar({
  capabilities,
}: {
  capabilities: string[]
}) {
  const location = useLocation()
  const session = useSession()
  const isSuperadmin = session.data?.user?.role === 'superadmin'

  const visibleItems = SIDEBAR_ITEMS.filter(
    (item) =>
      item.capability === null ||
      isSuperadmin ||
      capabilities.includes(item.capability),
  )

  return (
    <aside className="w-64 border-r bg-gray-50">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
      </div>
      <nav className="space-y-1 px-2">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                isActive
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
