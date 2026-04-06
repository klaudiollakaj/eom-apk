import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useSession, signOut } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const session = useSession()
  const navigate = useNavigate()
  const user = session.data?.user

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Profile</h1>
      <div className="space-y-4 rounded-lg border bg-white p-6">
        <div>
          <label className="text-sm font-medium text-gray-500">Name</label>
          <p className="text-lg">{user.name}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Email</label>
          <p className="text-lg">{user.email}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-500">Role</label>
          <div className="mt-1">
            <RoleBadge role={user.role as Role} />
          </div>
        </div>
        <p className="text-sm text-gray-400">
          Profile editing coming in a future update.
        </p>
        <button
          onClick={async () => {
            await signOut()
            navigate({ to: '/login' })
          }}
          className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
