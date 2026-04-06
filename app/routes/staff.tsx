import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useSession, signOut } from '~/lib/auth-client'
import { useState, useEffect } from 'react'
import { getMyCapabilities } from '~/server/fns/capabilities'
import { getSession } from '~/server/fns/auth-helpers'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/staff')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: StaffPage,
})

function StaffPage() {
  const navigate = useNavigate()
  const session = useSession()
  const user = session.data?.user
  const [capabilities, setCapabilities] = useState<string[]>([])

  useEffect(() => {
    getMyCapabilities().then((result) => {
      setCapabilities(result.all ? ['all'] : result.capabilities)
    })
  }, [])

  if (!user) return <div className="flex min-h-screen items-center justify-center"><p>Loading...</p></div>

  const hasPageEdit = capabilities.some((c) => c.startsWith('pages:edit:'))
  const hasEconomics = capabilities.includes('economics:view')
  const hasStats = capabilities.includes('stats:view')
  const hasAny = hasPageEdit || hasEconomics || hasStats

  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
          <div className="mt-1">
            <RoleBadge role={user.role as Role} />
          </div>
        </div>
        <button
          onClick={async () => { await signOut(); navigate({ to: '/login' }) }}
          className="rounded-md bg-red-600 px-4 py-2 text-sm text-white"
        >
          Logout
        </button>
      </div>

      {!hasAny && (
        <div className="rounded-lg border dark:border-gray-700 bg-gray-50 p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Contact your admin to get access to staff features.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {hasPageEdit && (
          <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h2 className="font-semibold">Edit Pages</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage public page content (coming in Phase 2+)
            </p>
          </div>
        )}
        {hasEconomics && (
          <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h2 className="font-semibold">Economics</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View financial data (coming in Phase 5)
            </p>
          </div>
        )}
        {hasStats && (
          <div className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <h2 className="font-semibold">Statistics</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View platform stats (coming in Phase 5)
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
