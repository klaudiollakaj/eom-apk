// app/server/fns/chat.ts
import { createServerFn } from '@tanstack/react-start'
import { db } from '~/lib/db'
import { messages, messageFlags, messageReadReceipts, negotiations, negotiationRounds, events, users } from '~/lib/schema'
import { eq, and, desc, asc, gt, sql, isNull, isNotNull, count } from 'drizzle-orm'
import { requireAuth } from './auth-helpers'
import { requireCapability, hasCapability } from '~/lib/permissions.server'
import { scanMessage } from '~/lib/content-filter'
import type { Role } from '~/lib/permissions'

// ── Helpers ──

const TERMINAL_STATUSES = ['accepted', 'rejected', 'cancelled', 'expired']
const MAX_MESSAGE_LENGTH = 2000
const RATE_LIMIT_PER_HOUR = 30

async function verifyNegotiationParty(negotiationId: string, userId: string) {
  const neg = await db.query.negotiations.findFirst({
    where: eq(negotiations.id, negotiationId),
    columns: { id: true, organizerId: true, providerId: true },
  })
  if (!neg) throw new Error('NOT_FOUND')
  if (neg.organizerId !== userId && neg.providerId !== userId) {
    throw new Error('FORBIDDEN')
  }
  return neg
}

// ── Chat status helper (plain function, usable from other server fns) ──

async function getChatStatusInternal(negotiationId: string, userId: string) {
  const neg = await db.query.negotiations.findFirst({
    where: eq(negotiations.id, negotiationId),
    columns: { id: true, organizerId: true, providerId: true, status: true },
    with: {
      event: { columns: { startDate: true, endDate: true } },
      rounds: {
        columns: { senderId: true },
        orderBy: [asc(negotiationRounds.roundNumber)],
      },
    },
  })
  if (!neg) throw new Error('NOT_FOUND')
  if (neg.organizerId !== userId && neg.providerId !== userId) {
    throw new Error('FORBIDDEN')
  }

  // Count distinct senders in rounds
  const senderIds = new Set(neg.rounds.map((r) => r.senderId))
  const roundCount = neg.rounds.length
  const bothPartiesEngaged = senderIds.size >= 2 && roundCount >= 2

  // Determine chat state
  if (!bothPartiesEngaged) {
    return { status: 'locked' as const, reason: 'Waiting for both parties to engage in negotiation' }
  }

  if (['rejected', 'cancelled', 'expired'].includes(neg.status)) {
    return { status: 'readonly' as const, reason: `Negotiation ${neg.status}` }
  }

  if (neg.status === 'accepted') {
    const eventDate = neg.event.endDate ?? neg.event.startDate
    if (eventDate && new Date(eventDate) < new Date()) {
      return { status: 'readonly' as const, reason: 'Event has ended' }
    }
    return { status: 'active' as const }
  }

  // offered/countered with 2+ rounds from both parties
  return { status: 'active' as const }
}

// ── getChatStatus (public server function wrapper) ──

export const getChatStatus = createServerFn({ method: 'GET' })
  .validator((input: { negotiationId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    return getChatStatusInternal(data.negotiationId, session.user.id)
  })

// ── sendMessage ──

export const sendMessage = createServerFn({ method: 'POST' })
  .validator((input: { negotiationId: string; content: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended || session.user.banned) throw new Error('ACCOUNT_SUSPENDED')
    if (!session.user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED')

    const content = data.content.trim()
    if (!content) throw new Error('EMPTY_MESSAGE')
    if (content.length > MAX_MESSAGE_LENGTH) throw new Error('MESSAGE_TOO_LONG')

    // Verify party access
    await verifyNegotiationParty(data.negotiationId, session.user.id)

    // Verify chat is active (not locked or readonly) — use internal helper to avoid nested server fn call
    const status = await getChatStatusInternal(data.negotiationId, session.user.id)
    if (status.status !== 'active') {
      throw new Error('CHAT_NOT_ACTIVE')
    }

    // Rate limiting: count messages in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [rateCheck] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.negotiationId, data.negotiationId),
        eq(messages.senderId, session.user.id),
        gt(messages.createdAt, oneHourAgo),
      ))
    if ((rateCheck?.count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      throw new Error('RATE_LIMIT_EXCEEDED')
    }

    // Store the message
    const [msg] = await db.insert(messages).values({
      negotiationId: data.negotiationId,
      senderId: session.user.id,
      content,
    }).returning()

    // Run content filter (async, non-blocking for the user)
    const flagResults = scanMessage(content)
    if (flagResults.length > 0) {
      await db.insert(messageFlags).values(
        flagResults.map((f) => ({
          messageId: msg.id,
          flagType: f.flagType,
          matchedContent: f.matchedContent,
        })),
      )
    }

    return {
      id: msg.id,
      negotiationId: msg.negotiationId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt,
      sender: { id: session.user.id, name: session.user.name, image: session.user.image ?? null },
    }
  })

// ── getMessages ──

export const getMessages = createServerFn({ method: 'GET' })
  .validator((input: { negotiationId: string; cursor?: string; limit?: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const limit = data.limit ?? 50

    // Check if admin or party
    const isAdmin = await hasCapability(session.user.id, session.user.role as Role, 'admin:chat:moderate')
    if (!isAdmin) {
      await verifyNegotiationParty(data.negotiationId, session.user.id)
    }

    const conditions = [eq(messages.negotiationId, data.negotiationId)]
    if (data.cursor) {
      // Cursor is a message ID — get messages older than that message
      const cursorMsg = await db.query.messages.findFirst({
        where: eq(messages.id, data.cursor),
        columns: { createdAt: true },
      })
      if (cursorMsg) {
        conditions.push(sql`${messages.createdAt} < ${cursorMsg.createdAt}`)
      }
    }

    const results = await db.query.messages.findMany({
      where: and(...conditions),
      with: {
        sender: { columns: { id: true, name: true, image: true } },
      },
      orderBy: [desc(messages.createdAt)],
      limit: limit + 1, // fetch one extra to detect "has more"
    })

    const hasMore = results.length > limit
    const items = hasMore ? results.slice(0, limit) : results

    // Get the other party's read receipt for "Read" indicator
    let otherReadAt: string | null = null
    if (!isAdmin) {
      const neg = await db.query.negotiations.findFirst({
        where: eq(negotiations.id, data.negotiationId),
        columns: { organizerId: true, providerId: true },
      })
      if (neg) {
        const otherUserId = neg.organizerId === session.user.id ? neg.providerId : neg.organizerId
        const otherReceipt = await db.query.messageReadReceipts.findFirst({
          where: and(
            eq(messageReadReceipts.negotiationId, data.negotiationId),
            eq(messageReadReceipts.userId, otherUserId),
          ),
        })
        if (otherReceipt) otherReadAt = otherReceipt.lastReadAt.toISOString()
      }
    }

    return {
      messages: items.reverse(), // return in chronological order
      hasMore,
      nextCursor: hasMore ? items[0]?.id : null, // oldest message in this page
      otherReadAt,
    }
  })

// ── markAsRead ──

export const markAsRead = createServerFn({ method: 'POST' })
  .validator((input: { negotiationId: string; messageId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await verifyNegotiationParty(data.negotiationId, session.user.id)

    await db
      .insert(messageReadReceipts)
      .values({
        negotiationId: data.negotiationId,
        userId: session.user.id,
        lastReadAt: new Date(),
        lastReadMessageId: data.messageId,
      })
      .onConflictDoUpdate({
        target: [messageReadReceipts.negotiationId, messageReadReceipts.userId],
        set: {
          lastReadAt: new Date(),
          lastReadMessageId: data.messageId,
        },
      })

    return { success: true }
  })

// ── getUnreadCounts ──

export const getUnreadCounts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    // Get all negotiations where user is a party
    const myNegotiations = await db.query.negotiations.findMany({
      where: sql`${negotiations.organizerId} = ${session.user.id} OR ${negotiations.providerId} = ${session.user.id}`,
      columns: { id: true },
    })

    if (myNegotiations.length === 0) return {}

    const negIds = myNegotiations.map((n) => n.id)

    // For each negotiation, count messages after the user's last read receipt
    const results = await db.execute(sql`
      SELECT
        m.negotiation_id AS "negotiationId",
        COUNT(*)::int AS "unreadCount"
      FROM messages m
      LEFT JOIN message_read_receipts mrr
        ON mrr.negotiation_id = m.negotiation_id
        AND mrr.user_id = ${session.user.id}
      WHERE m.negotiation_id IN (${sql.join(negIds.map(id => sql`${id}`), sql`, `)})
        AND m.sender_id != ${session.user.id}
        AND (mrr.last_read_at IS NULL OR m.created_at > mrr.last_read_at)
      GROUP BY m.negotiation_id
    `)

    const counts: Record<string, number> = {}
    for (const row of results.rows as { negotiationId: string; unreadCount: number }[]) {
      counts[row.negotiationId] = row.unreadCount
    }
    return counts
  },
)

// ── Admin: getFlaggedMessages ──

export const getFlaggedMessages = createServerFn({ method: 'GET' })
  .validator((input: { status?: 'pending' | 'resolved'; limit?: number; offset?: number } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:chat:moderate')

    const limit = data.limit ?? 20
    const offset = data.offset ?? 0

    const conditions = []
    if (data.status === 'resolved') {
      conditions.push(isNotNull(messageFlags.resolvedAt))
    } else {
      // Default to pending
      conditions.push(isNull(messageFlags.resolvedAt))
    }

    const results = await db.query.messageFlags.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        message: {
          with: {
            sender: { columns: { id: true, name: true, image: true } },
            negotiation: {
              columns: { id: true },
              with: {
                organizer: { columns: { id: true, name: true } },
                provider: { columns: { id: true, name: true } },
                service: { columns: { title: true } },
                event: { columns: { title: true } },
              },
            },
          },
        },
        resolvedByUser: { columns: { id: true, name: true } },
      },
      orderBy: [desc(messageFlags.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(messageFlags)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return { flags: results, total: totalResult?.count ?? 0 }
  })

// ── Admin: resolveFlag ──

export const resolveFlag = createServerFn({ method: 'POST' })
  .validator((input: { flagId: string; resolution: 'dismissed' | 'warned' }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:chat:moderate')

    const flag = await db.query.messageFlags.findFirst({
      where: eq(messageFlags.id, data.flagId),
    })
    if (!flag) throw new Error('NOT_FOUND')

    await db.update(messageFlags).set({
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
      resolution: data.resolution,
    }).where(eq(messageFlags.id, data.flagId))

    return { success: true }
  })
