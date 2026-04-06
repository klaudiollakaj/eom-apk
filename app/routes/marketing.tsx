import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSession, signOut } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/marketing')({
  component: Page,
})

function Page() {
  const navigate = useNavigate()
  const session = useSession()
  const user = session.data?.user

  if (!user) return null

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <div className="mt-2">
          <RoleBadge role={user.role as Role} />
        </div>
        <p className="mt-4 text-gray-600">
          Your dashboard is coming soon.
        </p>
        <button
          onClick={async () => { await signOut(); navigate({ to: '/login' }) }}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm text-white"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
