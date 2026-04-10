import { createServerFileRoute } from '@tanstack/react-start/server'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '~/server/uploadthing'

let _handler: ReturnType<typeof createRouteHandler> | null = null
function getHandler() {
  if (!_handler) {
    const token = process.env.UPLOADTHING_TOKEN
    const allKeys = Object.keys(process.env)
    console.log('[uploadthing] token present:', Boolean(token), 'length:', token?.length ?? 0)
    console.log('[uploadthing] token first 20 chars:', token?.slice(0, 20) ?? 'N/A')
    console.log('[uploadthing] env keys with UPLOAD:', allKeys.filter((k) => k.toUpperCase().includes('UPLOAD')))
    _handler = createRouteHandler({
      router: uploadRouter,
      config: { token },
    })
  }
  return _handler
}

export const ServerRoute = createServerFileRoute('/api/uploadthing').methods({
  GET: ({ request }) => {
    return getHandler()(request)
  },
  POST: async ({ request }) => {
    // Rebuild request to avoid TanStack Start body-parsing conflicts
    const body = await request.text()
    const plainRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    })
    return getHandler()(plainRequest)
  },
})
