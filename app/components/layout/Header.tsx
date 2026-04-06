import { Link } from '@tanstack/react-router'
import { useSession } from '~/lib/auth-client'
import { UserDropdown } from './UserDropdown'

interface NavLink {
  id: string
  label: string
  url: string
  isExternal: boolean
}

export function Header({ links }: { links: NavLink[] }) {
  const session = useSession()

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-indigo-600">
          EOM
        </Link>

        <nav className="flex items-center gap-6">
          {links.map((link) =>
            link.isExternal ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.id}
                to={link.url}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ),
          )}

          {session.data?.user ? (
            <UserDropdown />
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
