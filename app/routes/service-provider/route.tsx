import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '~/server/fns/auth-helpers'

export const Route = createFileRoute('/service-provider')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  component: ServiceProviderLayout,
})

function ServiceProviderLayout() {
  return <Outlet />
}
