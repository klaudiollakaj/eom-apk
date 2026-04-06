import { Link } from '@tanstack/react-router'

interface NavLink {
  id: string
  label: string
  url: string
  isExternal: boolean
}

export function Footer({ links }: { links: NavLink[] }) {
  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} EOM — Event Of Mine
          </p>
          <nav className="flex gap-4">
            {links.map((link) =>
              link.isExternal ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.id}
                  to={link.url}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </div>
    </footer>
  )
}
