import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '~/server/fns/auth-helpers'

export const Route = createFileRoute('/organizer')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  component: OrganizerLayout,
})

function OrganizerLayout() {
  return <Outlet />
}
