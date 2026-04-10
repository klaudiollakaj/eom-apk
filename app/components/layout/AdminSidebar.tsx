import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { useSession, signOut } from '~/lib/auth-client'
import { ThemeToggle } from '~/components/ui/ThemeToggle'

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
  {
    label: 'Categories',
    href: '/admin/categories',
    capability: 'admin:categories:manage',
  },
  {
    label: 'Events',
    href: '/admin/events',
    capability: 'admin:events:manage',
  },
  {
    label: 'Service Categories',
    href: '/admin/service-categories',
    capability: 'admin:service-categories:manage',
  },
  {
    label: 'Services',
    href: '/admin/services',
    capability: 'admin:services:manage',
  },
  {
    label: 'Negotiations',
    href: '/admin/negotiations',
    capability: 'admin:negotiations:manage',
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    capability: 'admin:analytics:view',
  },
  {
    label: 'Reviews',
    href: '/admin/reviews',
    capability: 'admin:reviews:moderate',
  },
  {
    label: 'Chat',
    href: '/admin/chat',
    capability: 'admin:chat:moderate',
  },
  {
    label: 'Tickets',
    href: '/admin/tickets',
    capability: 'admin:tickets:view',
  },
]

export function AdminSidebar({
  capabilities,
}: {
  capabilities: string[]
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSession()
  const isSuperadmin = session.data?.user?.role === 'superadmin'

  const visibleItems = SIDEBAR_ITEMS.filter(
    (item) =>
      item.capability === null ||
      isSuperadmin ||
      capabilities.includes(item.capability),
  )

  return (
    <aside className="w-64 border-r bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Admin Panel</h2>
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
                  ? 'bg-indigo-100 text-indigo-700 font-medium dark:bg-indigo-900 dark:text-indigo-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto border-t p-4 dark:border-gray-700">
        <div className="mb-2 flex items-center gap-2">
          <ThemeToggle />
          <span className="text-xs text-gray-500 dark:text-gray-400">Theme</span>
        </div>
        <button
          onClick={async () => {
            await signOut()
            navigate({ to: '/login' })
          }}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:text-red-400 dark:hover:bg-gray-700"
        >
          Logout
        </button>
      </div>
    </aside>
  )
}
