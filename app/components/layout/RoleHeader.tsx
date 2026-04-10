import { Link } from '@tanstack/react-router'
import { useSession } from '~/lib/auth-client'
import { UserDropdown } from './UserDropdown'
import { ThemeToggle } from '~/components/ui/ThemeToggle'
import { getDashboardPath, type Role } from '~/lib/permissions'

/**
 * Compact header for authenticated role pages (admin, organizer, sponsor, etc.).
 * Always shows Home + Dashboard buttons, theme toggle, and user dropdown.
 */
export function RoleHeader() {
  const session = useSession()
  const role = session.data?.user?.role as Role | undefined
  const dashboardPath = getDashboardPath(role)

  return (
    <header className="border-b bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link
          to="/"
          className="text-xl font-bold text-indigo-600 dark:text-indigo-400"
        >
          EOM
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            to="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Home
          </Link>
          <Link
            to={dashboardPath}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Dashboard
          </Link>
          <ThemeToggle />
          {session.data?.user && <UserDropdown />}
        </nav>
      </div>
    </header>
  )
}
