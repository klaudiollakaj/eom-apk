import { createServerFn } from '@tanstack/react-start'
import { getHeaders } from '@tanstack/react-start/server'
import { auth } from '~/lib/auth.server'
import { isAdmin, type Role } from '~/lib/permissions'

function toHeaders(): Headers {
  const h = new Headers()
  for (const [k, v] of Object.entries(getHeaders())) {
    if (typeof v === 'string') h.set(k, v)
  }
  return h
}

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    return auth.api.getSession({ headers: toHeaders() })
  },
)

export async function requireAuth() {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (!isAdmin(session.user.role as Role)) throw new Error('FORBIDDEN')
  return session
}
