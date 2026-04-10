import { createServerFileRoute } from '@tanstack/react-start/server'
import { createRouteHandler } from 'uploadthing/server'
import { uploadRouter } from '~/server/uploadthing'

function getToken(): string | undefined {
  // Access via globalThis to defeat any static analysis/inlining by bundlers
  const env = (globalThis as any).process?.env ?? {}
  return env.UPLOADTHING_TOKEN
}

let _handler: ReturnType<typeof createRouteHandler> | null = null
function getHandler() {
  if (!_handler) {
    const token = getToken()
    console.log('[uploadthing] token present:', Boolean(token), 'length:', token?.length ?? 0)
    console.log('[uploadthing] env keys containing UPLOAD:', Object.keys((globalThis as any).process?.env ?? {}).filter((k) => k.includes('UPLOAD')))
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
