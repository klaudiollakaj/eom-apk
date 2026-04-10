import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { RoleHeader } from '~/components/layout/RoleHeader'
import { getSession } from '~/server/fns/auth-helpers'

export const Route = createFileRoute('/service-provider')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  component: ServiceProviderLayout,
})

function ServiceProviderLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <RoleHeader />
      <Outlet />
    </div>
  )
}
