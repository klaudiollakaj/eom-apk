// app/routes/api/chat-stream.ts
import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '~/lib/db.server'
import { messages, negotiations } from '~/lib/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { auth } from '~/lib/auth.server'

export const ServerRoute = createServerFileRoute('/api/chat-stream' as never).methods({
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const negotiationId = url.searchParams.get('negotiationId')
    const lastEventId = request.headers.get('Last-Event-ID')

    if (!negotiationId) {
      return new Response('Missing negotiationId', { status: 400 })
    }

    // Auth check — use auth.api directly since getSession() relies on
    // TanStack Start async context which is unavailable in createServerFileRoute
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Verify party access
    const neg = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, negotiationId),
      columns: { organizerId: true, providerId: true },
    })
    if (!neg) {
      return new Response('Not found', { status: 404 })
    }
    if (neg.organizerId !== session.user.id && neg.providerId !== session.user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    // Track the last sent message ID
    let lastSentId = lastEventId || ''

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let keepaliveInterval: ReturnType<typeof setInterval>
        let pollInterval: ReturnType<typeof setInterval>

        function send(data: string, id?: string) {
          try {
            if (id) controller.enqueue(encoder.encode(`id: ${id}\n`))
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } catch {
            // Stream closed
            cleanup()
          }
        }

        function cleanup() {
          clearInterval(keepaliveInterval)
          clearInterval(pollInterval)
          try { controller.close() } catch {}
        }

        // Send keepalive every 30 seconds
        keepaliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            cleanup()
          }
        }, 30000)

        // Poll for new messages every 3 seconds
        pollInterval = setInterval(async () => {
          try {
            const conditions = [eq(messages.negotiationId, negotiationId)]

            if (lastSentId) {
              // Get the timestamp of the last sent message
              const lastMsg = await db.query.messages.findFirst({
                where: eq(messages.id, lastSentId),
                columns: { createdAt: true },
              })
              if (lastMsg) {
                conditions.push(gt(messages.createdAt, lastMsg.createdAt))
              }
            }

            const newMessages = await db.query.messages.findMany({
              where: and(...conditions),
              with: {
                sender: { columns: { id: true, name: true, image: true } },
              },
              orderBy: [desc(messages.createdAt)],
              limit: 50,
            })

            // Send in chronological order
            for (const msg of newMessages.reverse()) {
              send(JSON.stringify({
                id: msg.id,
                negotiationId: msg.negotiationId,
                senderId: msg.senderId,
                content: msg.content,
                createdAt: msg.createdAt,
                sender: msg.sender,
              }), msg.id)
              lastSentId = msg.id
            }
          } catch {
            cleanup()
          }
        }, 3000)

        // Clean up when client disconnects
        request.signal.addEventListener('abort', cleanup)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  },
})
