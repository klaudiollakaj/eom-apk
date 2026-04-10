import { createServerFileRoute } from '@tanstack/react-start/server'
import { auth } from '../../lib/auth.server'

export const ServerRoute = createServerFileRoute('/api/auth/$').methods({
  GET: ({ request }) => auth.handler(request),
  POST: async ({ request }) => {
    // Rebuild request to avoid TanStack Start body-parsing conflicts with Better Auth
    const body = await request.text()
    const plainRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    })
    return auth.handler(plainRequest)
  },
})
