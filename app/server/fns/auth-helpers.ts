import { createServerFn } from '@tanstack/react-start/server'
import { getHeaders } from '@tanstack/react-start/server'
import { auth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    return auth.api.getSession({ headers: getHeaders() })
  },
)

export async function requireAuth() {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (!isAdmin(session.user.role)) throw new Error('FORBIDDEN')
  return session
}
