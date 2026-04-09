import { createServerFileRoute } from '@tanstack/react-start/server'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '~/server/uploadthing'

const handler = createRouteHandler({
  router: uploadRouter,
  config: { token: process.env.UPLOADTHING_TOKEN },
})

export const ServerRoute = createServerFileRoute('/api/uploadthing').methods({
  GET: ({ request }) => {
    return handler(request)
  },
  POST: async ({ request }) => {
    // Rebuild request to avoid TanStack Start body-parsing conflicts
    const body = await request.text()
    const plainRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body,
    })
    return handler(plainRequest)
  },
})
