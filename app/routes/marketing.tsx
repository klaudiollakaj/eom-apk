import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useSession, signOut } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import { getSession } from '~/server/fns/auth-helpers'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/marketing')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: Page,
})

function Page() {
  const navigate = useNavigate()
  const session = useSession()
  const user = session.data?.user

  if (!user) return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <div className="mt-2">
          <RoleBadge role={user.role as Role} />
        </div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">
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
