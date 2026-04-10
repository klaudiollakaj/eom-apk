import { createServerFileRoute } from '@tanstack/react-start/server'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '~/server/uploadthing'

let _handler: ReturnType<typeof createRouteHandler> | null = null
function getHandler() {
  if (!_handler) {
    _handler = createRouteHandler({
      router: uploadRouter,
      config: { token: process.env.UPLOADTHING_TOKEN },
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
