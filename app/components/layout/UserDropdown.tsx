import { Link, useNavigate } from '@tanstack/react-router'
import { signOut, useSession } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'
import { useState } from 'react'

const DASHBOARD_ROUTES: Record<string, string> = {
  user: '/dashboard',
  organizer: '/organizer',
  distributor: '/distributor',
  sponsor: '/sponsor',
  negotiator: '/negotiator',
  service_provider: '/service-provider',
  marketing_agency: '/marketing',
  staff: '/staff',
  admin: '/admin',
  superadmin: '/admin',
}

export function UserDropdown() {
  const session = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!session.data?.user) return null

  const user = session.data.user
  const dashboardRoute = DASHBOARD_ROUTES[user.role] ?? '/dashboard'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100"
      >
        <span>{user.name}</span>
        <RoleBadge role={user.role as Role} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border bg-white py-1 shadow-lg">
          <Link
            to={dashboardRoute}
            className="block px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            My Dashboard
          </Link>
          <Link
            to="/profile"
            className="block px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            onClick={async () => {
              await signOut()
              setOpen(false)
              navigate({ to: '/login' })
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
