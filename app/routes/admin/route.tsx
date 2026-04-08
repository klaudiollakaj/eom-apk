import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminSidebar } from '~/components/layout/AdminSidebar'
import { getMyCapabilities } from '~/server/fns/capabilities'
import { getSession } from '~/server/fns/auth-helpers'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    const role = session.user.role
    if (role !== 'admin' && role !== 'superadmin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  loader: async () => {
    try {
      const result = await getMyCapabilities()
      return { capabilities: result.all ? 'all' : result.capabilities }
    } catch {
      return { capabilities: [] }
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { capabilities } = Route.useLoaderData()
  const capList =
    capabilities === 'all'
      ? [
          'admin:users:manage',
          'admin:logs:view',
          'admin:navigation:manage',
          'admin:permissions:manage',
          'admin:capabilities:manage',
          'admin:suspend:manage',
          'admin:categories:manage',
          'admin:events:manage',
          'admin:service-categories:manage',
          'admin:services:manage',
          'admin:negotiations:manage',
          'admin:analytics:view',
        ]
      : (capabilities as string[])

  return (
    <div className="flex min-h-screen">
      <AdminSidebar capabilities={capList} />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
