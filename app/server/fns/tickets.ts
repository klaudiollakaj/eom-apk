import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, desc, sql, inArray, count } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import {
  events,
  ticketTiers,
  tickets,
  orders,
  ticketTransfers,
  refunds,
  users,
  userLogs,
  promoCodes,
} from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { isAdmin, type Role } from '~/lib/permissions'
import { hasCapability, requireCapability } from '~/lib/permissions.server'
import { signTicketToken, verifyTicketToken } from '~/lib/ticket-qr.server'
import { sendEmail } from '~/lib/email.server'
import { buildIcsEvent } from '~/lib/ics'
import { getStripe, isStripeEnabled, getStripePublishableKey } from '~/lib/stripe.server'
import { computeCartPricing as computePricing } from '~/lib/pricing'
import { performRefund, sendRefundEmail } from './refund-helpers.server'

async function requireEventOwnership(eventId: string, userId: string, role: Role) {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event) throw new Error('EVENT_NOT_FOUND')
  if (event.organizerId !== userId && !isAdmin(role)) {
    throw new Error('FORBIDDEN')
  }
  return event
}

// ==================== TIER CRUD ====================

export const createTier = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      eventId: string
      name: string
      description?: string
      priceCents: number
      quantityTotal: number
      salesStartAt?: string
      salesEndAt?: string
      maxPerUser?: number
      sortOrder?: number
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireEventOwnership(data.eventId, session.user.id, session.user.role as Role)

    if (data.priceCents < 0) throw new Error('INVALID_PRICE')
    if (data.quantityTotal < 1) throw new Error('INVALID_QUANTITY')
    if (!data.name.trim()) throw new Error('INVALID_NAME')

    const [tier] = await db
      .insert(ticketTiers)
      .values({
        eventId: data.eventId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        priceCents: data.priceCents,
        quantityTotal: data.quantityTotal,
        salesStartAt: data.salesStartAt ? new Date(data.salesStartAt) : null,
        salesEndAt: data.salesEndAt ? new Date(data.salesEndAt) : null,
        maxPerUser: data.maxPerUser ?? 10,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'ticket_tier_created',
      details: { tierId: tier.id, eventId: data.eventId },
    })

    return tier
  })

export const updateTier = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      tierId: string
      name?: string
      description?: string | null
      priceCents?: number
      quantityTotal?: number
      salesStartAt?: string | null
      salesEndAt?: string | null
      maxPerUser?: number
      sortOrder?: number
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const tier = await db.query.ticketTiers.findFirst({
      where: eq(ticketTiers.id, data.tierId),
    })
    if (!tier) throw new Error('NOT_FOUND')

    await requireEventOwnership(tier.eventId, session.user.id, session.user.role as Role)

    const updates: Partial<typeof ticketTiers.$inferInsert> = { updatedAt: new Date() }

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('INVALID_NAME')
      updates.name = data.name.trim()
    }
    if (data.description !== undefined) {
      updates.description = data.description?.trim() || null
    }
    if (data.priceCents !== undefined) {
      if (data.priceCents < 0) throw new Error('INVALID_PRICE')
      updates.priceCents = data.priceCents
    }
    if (data.quantityTotal !== undefined) {
      if (data.quantityTotal < tier.quantitySold) {
        throw new Error('QUANTITY_BELOW_SOLD')
      }
      updates.quantityTotal = data.quantityTotal
    }
    if (data.salesStartAt !== undefined) {
      updates.salesStartAt = data.salesStartAt ? new Date(data.salesStartAt) : null
    }
    if (data.salesEndAt !== undefined) {
      updates.salesEndAt = data.salesEndAt ? new Date(data.salesEndAt) : null
    }
    if (data.maxPerUser !== undefined) updates.maxPerUser = data.maxPerUser
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder

    const [updated] = await db
      .update(ticketTiers)
      .set(updates)
      .where(eq(ticketTiers.id, data.tierId))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'ticket_tier_updated',
      details: { tierId: data.tierId, eventId: tier.eventId },
    })

    return updated
  })

export const deleteTier = createServerFn({ method: 'POST' })
  .validator((input: { tierId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const tier = await db.query.ticketTiers.findFirst({
      where: eq(ticketTiers.id, data.tierId),
    })
    if (!tier) throw new Error('NOT_FOUND')

    await requireEventOwnership(tier.eventId, session.user.id, session.user.role as Role)

    if (tier.quantitySold > 0) throw new Error('HAS_SALES')

    await db.delete(ticketTiers).where(eq(ticketTiers.id, data.tierId))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'ticket_tier_deleted',
      details: { tierId: data.tierId, eventId: tier.eventId },
    })

    return { ok: true }
  })

export const toggleTierActive = createServerFn({ method: 'POST' })
  .validator((input: { tierId: string; isActive: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const tier = await db.query.ticketTiers.findFirst({
      where: eq(ticketTiers.id, data.tierId),
    })
    if (!tier) throw new Error('NOT_FOUND')

    await requireEventOwnership(tier.eventId, session.user.id, session.user.role as Role)

    const [updated] = await db
      .update(ticketTiers)
      .set({ isActive: data.isActive, updatedAt: new Date() })
      .where(eq(ticketTiers.id, data.tierId))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.isActive ? 'ticket_tier_activated' : 'ticket_tier_deactivated',
      details: { tierId: data.tierId, eventId: tier.eventId },
    })

    return updated
  })

export const listEventTiers = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string; includeInactive?: boolean }) => input)
  .handler(async ({ data }) => {
    const conditions = [eq(ticketTiers.eventId, data.eventId)]
    if (!data.includeInactive) {
      conditions.push(eq(ticketTiers.isActive, true))
    }

    const tiers = await db.query.ticketTiers.findMany({
      where: and(...conditions),
      orderBy: [asc(ticketTiers.sortOrder), asc(ticketTiers.createdAt)],
    })

    return tiers.map((t) => ({
      ...t,
      quantityAvailable: Math.max(0, t.quantityTotal - t.quantitySold),
    }))
  })

// ==================== PURCHASE FLOW ====================

export const getCheckoutSummary = createServerFn({ method: 'GET' })
  .validator(
    (input: { eventId: string; items: { tierId: string; quantity: number }[] }) =>
      input,
  )
  .handler(async ({ data }) => {
    await requireAuth()

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
    })
    if (!event) throw new Error('EVENT_NOT_FOUND')

    const tierIds = data.items.map((i) => i.tierId)
    const tiers = tierIds.length
      ? await db.query.ticketTiers.findMany({
          where: and(
            inArray(ticketTiers.id, tierIds),
            eq(ticketTiers.eventId, data.eventId),
          ),
        })
      : []

    const lines = data.items.map((item) => {
      const tier = tiers.find((t) => t.id === item.tierId)
      if (!tier) throw new Error('TIER_NOT_FOUND')
      const quantityAvailable = Math.max(0, tier.quantityTotal - tier.quantitySold)
      const lineTotalCents = tier.priceCents * item.quantity
      return {
        tierId: tier.id,
        tierName: tier.name,
        priceCents: tier.priceCents,
        quantity: item.quantity,
        quantityAvailable,
        lineTotalCents,
        isActive: tier.isActive,
      }
    })

    const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0)

    return {
      event: {
        id: event.id,
        title: event.title,
        startDate: event.startDate,
      },
      lines,
      subtotalCents,
      totalCents: subtotalCents,
    }
  })

function validateMockCard(payment: {
  cardNumber: string
  expiry: string
  cvc: string
  name: string
}) {
  const digits = payment.cardNumber.replace(/\s+/g, '')
  if (!/^\d{16}$/.test(digits)) throw new Error('INVALID_CARD_NUMBER')
  if (!/^\d{2}\/\d{2}$/.test(payment.expiry)) throw new Error('INVALID_EXPIRY')
  if (!/^\d{3}$/.test(payment.cvc)) throw new Error('INVALID_CVC')
  if (!payment.name.trim()) throw new Error('INVALID_CARDHOLDER_NAME')
}

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `EOM-${ts}-${rand}`
}

/**
 * Compute cart total without locking. Used for Stripe payment-intent creation
 * where we need a number upfront — the authoritative, locked recomputation
 * happens inside purchaseTickets when tickets are actually minted.
 */
async function computeCartPricing(input: {
  eventId: string
  items: { tierId: string; quantity: number }[]
  promoCodeStr?: string
}): Promise<{ subtotalCents: number; discountCents: number; totalCents: number }> {
  if (!input.items.length) throw new Error('EMPTY_CART')
  const event = await db.query.events.findFirst({
    where: eq(events.id, input.eventId),
  })
  if (!event) throw new Error('EVENT_NOT_FOUND')
  if (event.startDate.getTime() <= Date.now()) throw new Error('EVENT_STARTED')

  const tierIds = input.items.map((i) => i.tierId)
  const tierRows = await db.query.ticketTiers.findMany({
    where: and(
      inArray(ticketTiers.id, tierIds),
      eq(ticketTiers.eventId, input.eventId),
    ),
  })
  if (tierRows.length !== tierIds.length) throw new Error('TIER_NOT_FOUND')

  const lines = input.items.map((item) => {
    const tier = tierRows.find((t) => t.id === item.tierId)!
    return { priceCents: tier.priceCents, quantity: item.quantity }
  })

  let promo: { discountType: string; discountValue: number } | null = null
  if (input.promoCodeStr && input.promoCodeStr.trim()) {
    const codeStr = input.promoCodeStr.trim().toUpperCase()
    const row = await db.query.promoCodes.findFirst({
      where: and(
        eq(promoCodes.eventId, input.eventId),
        sql`UPPER(${promoCodes.code}) = ${codeStr}`,
      ),
    })
    if (row && row.isActive) {
      const expired = row.expiresAt && row.expiresAt.getTime() < Date.now()
      const exhausted = row.maxUses !== null && row.usedCount >= row.maxUses
      if (!expired && !exhausted) {
        promo = { discountType: row.discountType, discountValue: row.discountValue }
      }
    }
  }

  return computePricing(lines, promo)
}

export const getStripeConfig = createServerFn({ method: 'GET' }).handler(
  async () => ({
    enabled: isStripeEnabled(),
    publishableKey: getStripePublishableKey(),
  }),
)

export const createStripePaymentIntent = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      eventId: string
      items: { tierId: string; quantity: number }[]
      promoCode?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const stripe = getStripe()
    if (!stripe) throw new Error('STRIPE_NOT_CONFIGURED')

    const pricing = await computeCartPricing({
      eventId: data.eventId,
      items: data.items,
      promoCodeStr: data.promoCode,
    })
    if (pricing.totalCents === 0) throw new Error('FREE_ORDER_NO_PAYMENT_NEEDED')

    const intent = await stripe.paymentIntents.create({
      amount: pricing.totalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: session.user.id,
        eventId: data.eventId,
      },
    })

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      totalCents: pricing.totalCents,
      discountCents: pricing.discountCents,
    }
  })

export const purchaseTickets = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      eventId: string
      items: { tierId: string; quantity: number }[]
      promoCode?: string
      paymentIntentId?: string
      payment?: {
        cardNumber: string
        expiry: string
        cvc: string
        name: string
      }
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const userId = session.user.id

    if (!data.items.length) throw new Error('EMPTY_CART')
    for (const item of data.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new Error('INVALID_QUANTITY')
      }
    }

    const result = await db.transaction(async (tx) => {
      const event = await tx.query.events.findFirst({
        where: eq(events.id, data.eventId),
      })
      if (!event) throw new Error('EVENT_NOT_FOUND')
      if (event.startDate.getTime() <= Date.now()) {
        throw new Error('EVENT_STARTED')
      }

      const tierIds = data.items.map((i) => i.tierId)

      // Row-level lock on requested tiers
      await tx.execute(
        sql`SELECT id FROM ticket_tiers WHERE id IN (${sql.join(
          tierIds.map((id) => sql`${id}`),
          sql`, `,
        )}) FOR UPDATE`,
      )

      const lockedTiers = await tx.query.ticketTiers.findMany({
        where: and(
          inArray(ticketTiers.id, tierIds),
          eq(ticketTiers.eventId, data.eventId),
        ),
      })

      if (lockedTiers.length !== tierIds.length) {
        throw new Error('TIER_NOT_FOUND')
      }

      const now = new Date()
      let subtotalCents = 0

      const plan: {
        tier: (typeof lockedTiers)[number]
        quantity: number
      }[] = []

      for (const item of data.items) {
        const tier = lockedTiers.find((t) => t.id === item.tierId)!
        if (!tier.isActive) throw new Error('TIER_INACTIVE')
        if (tier.salesStartAt && tier.salesStartAt.getTime() > now.getTime()) {
          throw new Error('SALES_NOT_STARTED')
        }
        if (tier.salesEndAt && tier.salesEndAt.getTime() < now.getTime()) {
          throw new Error('SALES_CLOSED')
        }

        const available = tier.quantityTotal - tier.quantitySold
        if (available < item.quantity) throw new Error('SOLD_OUT')

        // Per-user cap: existing valid tickets for this tier + new
        const [existing] = await tx
          .select({ c: count() })
          .from(tickets)
          .where(
            and(
              eq(tickets.ownerId, userId),
              eq(tickets.tierId, tier.id),
              inArray(tickets.status, ['valid', 'checked_in']),
            ),
          )
        const existingCount = Number(existing?.c ?? 0)
        if (existingCount + item.quantity > tier.maxPerUser) {
          throw new Error('MAX_PER_USER_EXCEEDED')
        }

        subtotalCents += tier.priceCents * item.quantity
        plan.push({ tier, quantity: item.quantity })
      }

      // Promo code validation + discount
      let discountCents = 0
      let appliedPromoId: string | null = null

      if (data.promoCode && data.promoCode.trim()) {
        const codeStr = data.promoCode.trim().toUpperCase()

        // Lock the promo row so concurrent uses can't exceed maxUses
        await tx.execute(
          sql`SELECT id FROM promo_codes WHERE event_id = ${data.eventId} AND UPPER(code) = ${codeStr} FOR UPDATE`,
        )

        const promo = await tx.query.promoCodes.findFirst({
          where: and(
            eq(promoCodes.eventId, data.eventId),
            sql`UPPER(${promoCodes.code}) = ${codeStr}`,
          ),
        })

        if (!promo) throw new Error('PROMO_INVALID')
        if (!promo.isActive) throw new Error('PROMO_INACTIVE')
        if (promo.expiresAt && promo.expiresAt.getTime() < now.getTime()) {
          throw new Error('PROMO_EXPIRED')
        }
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
          throw new Error('PROMO_EXHAUSTED')
        }

        const lines = plan.map((p) => ({
          priceCents: p.tier.priceCents,
          quantity: p.quantity,
        }))
        const pricing = computePricing(lines, {
          discountType: promo.discountType,
          discountValue: promo.discountValue,
        })
        discountCents = pricing.discountCents
        appliedPromoId = promo.id
      }

      const totalCents = subtotalCents - discountCents
      const isFree = totalCents === 0

      // Payment verification — Stripe (if enabled + intent supplied) or mock
      const stripe = getStripe()
      let paymentMethod: string = 'mock'
      let paymentRef: string = `mock_${crypto.randomUUID()}`

      if (!isFree) {
        if (stripe && data.paymentIntentId) {
          const intent = await stripe.paymentIntents.retrieve(data.paymentIntentId)
          if (intent.status !== 'succeeded') {
            throw new Error('PAYMENT_NOT_SUCCEEDED')
          }
          if (intent.amount !== totalCents) {
            throw new Error('PAYMENT_AMOUNT_MISMATCH')
          }
          if (intent.metadata?.userId && intent.metadata.userId !== userId) {
            throw new Error('PAYMENT_USER_MISMATCH')
          }
          paymentMethod = 'stripe'
          paymentRef = intent.id
        } else if (stripe) {
          // Stripe is enabled but no intent supplied — don't fall back to mock
          throw new Error('PAYMENT_INTENT_REQUIRED')
        } else {
          // Dev/mock flow
          if (!data.payment) throw new Error('PAYMENT_REQUIRED')
          validateMockCard(data.payment)
        }
      }

      const orderNumber = generateOrderNumber()

      const [order] = await tx
        .insert(orders)
        .values({
          orderNumber,
          userId,
          eventId: data.eventId,
          subtotalCents,
          discountCents,
          promoCodeId: appliedPromoId,
          totalCents,
          status: 'paid',
          paymentMethod,
          paymentRef,
          paidAt: now,
        })
        .returning()

      if (appliedPromoId) {
        await tx
          .update(promoCodes)
          .set({ usedCount: sql`${promoCodes.usedCount} + 1`, updatedAt: now })
          .where(eq(promoCodes.id, appliedPromoId))
      }

      const createdTicketIds: string[] = []

      for (const { tier, quantity } of plan) {
        const ticketRows: (typeof tickets.$inferInsert)[] = []
        for (let i = 0; i < quantity; i++) {
          const ticketId = crypto.randomUUID()
          const qrCode = signTicketToken({ ticketId, eventId: data.eventId })
          ticketRows.push({
            id: ticketId,
            orderId: order.id,
            tierId: tier.id,
            eventId: data.eventId,
            ownerId: userId,
            status: 'valid',
            qrCode,
          })
          createdTicketIds.push(ticketId)
        }
        await tx.insert(tickets).values(ticketRows)

        await tx
          .update(ticketTiers)
          .set({
            quantitySold: tier.quantitySold + quantity,
            updatedAt: now,
          })
          .where(eq(ticketTiers.id, tier.id))
      }

      return {
        orderId: order.id,
        orderNumber,
        ticketIds: createdTicketIds,
        eventTitle: event.title,
        eventStartDate: event.startDate,
        eventStartTime: event.startTime,
        eventVenueName: event.venueName,
        eventCity: event.city,
        eventCountry: event.country,
        totalCents,
        discountCents,
      }
    })

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'tickets_purchased',
      details: {
        orderId: result.orderId,
        eventId: data.eventId,
        ticketCount: result.ticketIds.length,
      },
    })

    // Purchase confirmation email (fire-and-forget)
    {
      const dateStr = result.eventStartDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      const ticketsUrl = `${process.env.APP_URL || ''}/tickets`
      const lines = [
        `Hi ${session.user.name || 'there'},`,
        '',
        `Your order for "${result.eventTitle}" on ${dateStr} has been confirmed.`,
        '',
        `Order number: ${result.orderNumber}`,
        `Tickets: ${result.ticketIds.length}`,
        result.discountCents > 0
          ? `Discount applied: -$${(result.discountCents / 100).toFixed(2)}`
          : null,
        `Total: ${result.totalCents === 0 ? 'Free' : `$${(result.totalCents / 100).toFixed(2)}`}`,
        '',
        `View your tickets:`,
        ticketsUrl,
        '',
        '— EOM',
      ].filter(Boolean)

      const locationParts = [result.eventVenueName, result.eventCity, result.eventCountry].filter(Boolean)
      const icalEvent = buildIcsEvent({
        title: result.eventTitle,
        startDate: result.eventStartDate,
        startTime: result.eventStartTime,
        location: locationParts.length > 0 ? locationParts.join(', ') : undefined,
        description: `Order ${result.orderNumber} — ${result.ticketIds.length} ticket(s)`,
      })

      sendEmail({
        to: session.user.email,
        subject: `Order confirmed — ${result.eventTitle}`,
        text: lines.join('\n'),
        icalEvent,
      }).catch((err) => console.error('[purchase email]', err))
    }

    return {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      ticketIds: result.ticketIds,
    }
  })

// ==================== ATTENDEE QUERIES ====================

export const getMyTickets = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const rows = await db.query.tickets.findMany({
      where: eq(tickets.ownerId, session.user.id),
      orderBy: [desc(tickets.createdAt)],
      with: {
        tier: true,
        event: {
          with: {
            images: { limit: 1 },
          },
        },
      },
    })

    const now = Date.now()
    const upcoming: typeof rows = []
    const past: typeof rows = []
    for (const t of rows) {
      if (t.event.startDate.getTime() >= now) upcoming.push(t)
      else past.push(t)
    }
    upcoming.sort((a, b) => a.event.startDate.getTime() - b.event.startDate.getTime())
    past.sort((a, b) => b.event.startDate.getTime() - a.event.startDate.getTime())

    return { upcoming, past }
  },
)

export const getMyOrders = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const rows = await db.query.orders.findMany({
      where: eq(orders.userId, session.user.id),
      orderBy: [desc(orders.createdAt)],
      with: {
        event: {
          columns: { id: true, title: true, startDate: true, bannerImage: true },
        },
        tickets: {
          columns: { id: true, status: true, tierId: true },
        },
        promoCode: {
          columns: { code: true, discountType: true, discountValue: true },
        },
      },
    })

    return rows
  },
)

export const getTicket = createServerFn({ method: 'GET' })
  .validator((input: { ticketId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const ticket = await db.query.tickets.findFirst({
      where: eq(tickets.id, data.ticketId),
      with: {
        tier: true,
        event: {
          with: {
            images: { limit: 1 },
            organizer: { columns: { id: true, name: true } },
          },
        },
        order: {
          with: { promoCode: true },
        },
      },
    })
    if (!ticket) throw new Error('NOT_FOUND')

    const isOwner = ticket.ownerId === session.user.id
    const isAdminRole = isAdmin(session.user.role as Role)
    const isEventOrganizer = ticket.event.organizerId === session.user.id

    if (!isOwner && !isAdminRole && !isEventOrganizer) {
      throw new Error('FORBIDDEN')
    }

    return ticket
  })

// ==================== TRANSFER FLOW ====================

export const transferTicket = createServerFn({ method: 'POST' })
  .validator(
    (input: { ticketId: string; recipientEmail: string; note?: string }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const recipient = await db.query.users.findFirst({
      where: eq(users.email, data.recipientEmail.trim().toLowerCase()),
    })
    if (!recipient) throw new Error('USER_NOT_FOUND')
    if (recipient.id === session.user.id) throw new Error('CANNOT_TRANSFER_TO_SELF')

    let capturedEvent: { id: string; title: string; startDate: Date } | null = null
    let capturedTierName = ''

    const result = await db.transaction(async (tx) => {
      const ticket = await tx.query.tickets.findFirst({
        where: eq(tickets.id, data.ticketId),
        with: { event: true, tier: true },
      })
      if (!ticket) throw new Error('NOT_FOUND')
      if (ticket.ownerId !== session.user.id) throw new Error('FORBIDDEN')
      if (ticket.status !== 'valid') throw new Error('NOT_TRANSFERABLE')
      if (ticket.event.startDate.getTime() <= Date.now()) {
        throw new Error('EVENT_STARTED')
      }

      capturedEvent = {
        id: ticket.event.id,
        title: ticket.event.title,
        startDate: ticket.event.startDate,
      }
      capturedTierName = ticket.tier.name

      // Check recipient's cap for tier
      const [existing] = await tx
        .select({ c: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.ownerId, recipient.id),
            eq(tickets.tierId, ticket.tierId),
            inArray(tickets.status, ['valid', 'checked_in']),
          ),
        )
      const existingCount = Number(existing?.c ?? 0)
      if (existingCount + 1 > ticket.tier.maxPerUser) {
        throw new Error('RECIPIENT_MAX_PER_USER_EXCEEDED')
      }

      await tx.insert(ticketTransfers).values({
        ticketId: ticket.id,
        fromUserId: session.user.id,
        toUserId: recipient.id,
        note: data.note?.trim() || null,
      })

      // Regenerate QR so old token is invalidated via ownership mismatch on lookup,
      // though signature stays same ticketId/eventId — fresh signing gives a new `iat`.
      const newQr = signTicketToken({
        ticketId: ticket.id,
        eventId: ticket.eventId,
      })

      const [updated] = await tx
        .update(tickets)
        .set({ ownerId: recipient.id, qrCode: newQr })
        .where(eq(tickets.id, ticket.id))
        .returning()

      return updated
    })

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'ticket_transferred',
      details: {
        ticketId: data.ticketId,
        recipientId: recipient.id,
      },
    })

    // Fire-and-forget email notifications — don't block the transfer if SMTP is down
    if (capturedEvent) {
      const ev = capturedEvent as { id: string; title: string; startDate: Date }
      const dateStr = ev.startDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
      const senderName = session.user.name || session.user.email
      const ticketUrl = `${process.env.APP_URL || ''}/tickets/${data.ticketId}`

      // Recipient: you received a ticket
      sendEmail({
        to: recipient.email,
        subject: `You received a ticket for ${ev.title}`,
        text:
          `Hi ${recipient.name || 'there'},\n\n` +
          `${senderName} has transferred you a ticket for "${ev.title}" on ${dateStr}.\n` +
          `Ticket type: ${capturedTierName}\n` +
          (data.note?.trim() ? `\nMessage from ${senderName}:\n"${data.note.trim()}"\n` : '') +
          `\nView your ticket:\n${ticketUrl}\n\n` +
          `— EOM`,
      }).catch((err) => console.error('[transfer email → recipient]', err))

      // Sender: confirmation
      sendEmail({
        to: session.user.email,
        subject: `Ticket transferred to ${recipient.email}`,
        text:
          `Hi ${senderName},\n\n` +
          `Your ticket for "${ev.title}" (${capturedTierName}) has been transferred to ${recipient.email}.\n` +
          `You no longer have access to this ticket.\n\n` +
          `— EOM`,
      }).catch((err) => console.error('[transfer email → sender]', err))
    }

    return result
  })

// ==================== REFUND FLOW ====================

export const refundTicket = createServerFn({ method: 'POST' })
  .validator((input: { ticketId: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const result = await performRefund(
      data.ticketId,
      session.user.id,
      data.reason,
      false,
    )

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'ticket_refunded',
      details: { ticketId: data.ticketId },
    })

    if (result.notify) sendRefundEmail(result.notify)

    return result.ticket
  })

export const refundOrder = createServerFn({ method: 'POST' })
  .validator((input: { orderId: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, data.orderId),
      with: { tickets: true },
    })
    if (!order) throw new Error('NOT_FOUND')
    if (order.userId !== session.user.id) throw new Error('FORBIDDEN')

    const refundable = order.tickets.filter((t) => t.status === 'valid')
    if (refundable.length === 0) throw new Error('NOT_REFUNDABLE')

    const refunded: string[] = []
    let totalRefundCents = 0
    let eventTitle: string | null = null
    let ownerEmail: string | null = null
    let ownerName: string = ''
    for (const t of refundable) {
      const res = await performRefund(t.id, session.user.id, data.reason, false)
      refunded.push(t.id)
      if (res.notify) {
        totalRefundCents += res.notify.amountCents
        eventTitle = res.notify.eventTitle
        ownerEmail = res.notify.email
        ownerName = res.notify.name
      }
    }

    // One consolidated email for the whole order instead of one per ticket
    if (ownerEmail && eventTitle) {
      sendRefundEmail({
        email: ownerEmail,
        name: ownerName,
        eventTitle,
        tierName: `${refunded.length} ticket${refunded.length === 1 ? '' : 's'}`,
        amountCents: totalRefundCents,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'order_refunded',
      details: { orderId: data.orderId, ticketIds: refunded },
    })

    return { refundedTicketIds: refunded }
  })

// ==================== VALIDATION (STAFF SCANNER) ====================

type ValidateResult =
  | {
      success: true
      ticketId: string
      attendee: { id: string; name: string }
      tier: { name: string }
      checkedInAt: Date
    }
  | {
      success: false
      reason:
        | 'INVALID_SIGNATURE'
        | 'WRONG_EVENT'
        | 'NOT_FOUND'
        | 'ALREADY_CHECKED_IN'
        | 'REFUNDED'
        | 'INVALID_STATUS'
      details?: { checkedInAt?: Date }
    }

export const validateTicket = createServerFn({ method: 'POST' })
  .validator(
    (input: { token: string; eventId: string; manual?: boolean }) => input,
  )
  .handler(async ({ data }): Promise<ValidateResult> => {
    const session = await requireAuth()

    // Authorization: staff capability OR event organizer OR admin
    const event = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
    })
    if (!event) throw new Error('EVENT_NOT_FOUND')

    const isEventOrganizer = event.organizerId === session.user.id
    const isAdminRole = isAdmin(session.user.role as Role)
    let allowed = isEventOrganizer || isAdminRole
    if (!allowed) {
      allowed = await hasCapability(
        session.user.id,
        session.user.role as Role,
        'staff:scan_tickets',
      )
    }
    if (!allowed) throw new Error('FORBIDDEN')

    let ticketId: string
    let tokenEventId: string

    if (data.manual) {
      // Manual mode: token is actually a ticket id
      ticketId = data.token
      tokenEventId = data.eventId
    } else {
      const payload = verifyTicketToken(data.token)
      if (!payload) return { success: false, reason: 'INVALID_SIGNATURE' }
      ticketId = payload.ticketId
      tokenEventId = payload.eventId
    }

    if (tokenEventId !== data.eventId) {
      return { success: false, reason: 'WRONG_EVENT' }
    }

    return db.transaction(async (tx) => {
      const ticket = await tx.query.tickets.findFirst({
        where: eq(tickets.id, ticketId),
        with: {
          tier: true,
          owner: { columns: { id: true, name: true } },
        },
      })
      if (!ticket) return { success: false, reason: 'NOT_FOUND' } as const
      if (ticket.eventId !== data.eventId) {
        return { success: false, reason: 'WRONG_EVENT' } as const
      }
      if (ticket.status === 'checked_in') {
        return {
          success: false,
          reason: 'ALREADY_CHECKED_IN',
          details: { checkedInAt: ticket.checkedInAt ?? undefined },
        } as const
      }
      if (ticket.status === 'refunded') {
        return { success: false, reason: 'REFUNDED' } as const
      }
      if (ticket.status !== 'valid') {
        return { success: false, reason: 'INVALID_STATUS' } as const
      }

      const now = new Date()
      await tx
        .update(tickets)
        .set({
          status: 'checked_in',
          checkedInAt: now,
          checkedInBy: session.user.id,
        })
        .where(eq(tickets.id, ticket.id))

      return {
        success: true,
        ticketId: ticket.id,
        attendee: {
          id: ticket.owner.id,
          name: ticket.owner.name,
        },
        tier: { name: ticket.tier.name },
        checkedInAt: now,
      } as const
    })
  })

// ==================== ADMIN + ORGANIZER QUERIES ====================

export const getAdminTicketStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:tickets:view')

    const [soldAgg] = await db
      .select({
        totalSold: count(),
        totalRevenue: sql<number>`COALESCE(SUM(${orders.totalCents}), 0)`,
      })
      .from(orders)
      .where(inArray(orders.status, ['paid', 'partially_refunded']))

    const [ticketCounts] = await db
      .select({
        total: count(),
      })
      .from(tickets)

    const [refundedCount] = await db
      .select({ c: count() })
      .from(tickets)
      .where(eq(tickets.status, 'refunded'))

    const totalTickets = Number(ticketCounts?.total ?? 0)
    const refunded = Number(refundedCount?.c ?? 0)
    const refundRate = totalTickets > 0 ? refunded / totalTickets : 0

    return {
      totalRevenueCents: Number(soldAgg?.totalRevenue ?? 0),
      totalOrders: Number(soldAgg?.totalSold ?? 0),
      totalTickets,
      refundedTickets: refunded,
      refundRate,
    }
  },
)

export const listOrdersForAdmin = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      eventId?: string
      userId?: string
      status?: string
      limit?: number
      offset?: number
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:tickets:view')

    const conditions: any[] = []
    if (data.eventId) conditions.push(eq(orders.eventId, data.eventId))
    if (data.userId) conditions.push(eq(orders.userId, data.userId))
    if (data.status) conditions.push(eq(orders.status, data.status))

    const where = conditions.length ? and(...conditions) : undefined
    const limit = data.limit ?? 25
    const offset = data.offset ?? 0

    const [rows, [total]] = await Promise.all([
      db.query.orders.findMany({
        where,
        orderBy: [desc(orders.createdAt)],
        limit,
        offset,
        with: {
          user: { columns: { id: true, name: true, email: true } },
          event: { columns: { id: true, title: true } },
          tickets: { with: { tier: true } },
        },
      }),
      db.select({ count: count() }).from(orders).where(where ?? sql`TRUE`),
    ])

    return { orders: rows, total: Number(total?.count ?? 0) }
  })

export const adminForceRefund = createServerFn({ method: 'POST' })
  .validator((input: { ticketId: string; reason?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:tickets:refund')

    const result = await performRefund(
      data.ticketId,
      session.user.id,
      data.reason,
      true,
    )

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'admin_force_refund',
      details: { ticketId: data.ticketId, reason: data.reason },
    })

    if (result.notify) sendRefundEmail(result.notify)

    return result.ticket
  })

export const getOrganizerEventSales = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireEventOwnership(
      data.eventId,
      session.user.id,
      session.user.role as Role,
    )

    const tiers = await db.query.ticketTiers.findMany({
      where: eq(ticketTiers.eventId, data.eventId),
      orderBy: [asc(ticketTiers.sortOrder)],
    })

    const eventTickets = await db.query.tickets.findMany({
      where: eq(tickets.eventId, data.eventId),
    })

    const validStatuses = new Set(['valid', 'checked_in'])
    const totalSold = eventTickets.filter((t) => validStatuses.has(t.status)).length
    const checkedIn = eventTickets.filter((t) => t.status === 'checked_in').length
    const checkInRate = totalSold > 0 ? checkedIn / totalSold : 0

    const perTier = tiers.map((tier) => {
      const tierTickets = eventTickets.filter((t) => t.tierId === tier.id)
      const sold = tierTickets.filter((t) => validStatuses.has(t.status)).length
      const ci = tierTickets.filter((t) => t.status === 'checked_in').length
      return {
        tierId: tier.id,
        tierName: tier.name,
        priceCents: tier.priceCents,
        sold,
        checkedIn: ci,
        revenueCents: sold * tier.priceCents,
      }
    })

    const totalRevenueCents = perTier.reduce((sum, t) => sum + t.revenueCents, 0)

    return {
      totalSold,
      checkedIn,
      checkInRate,
      totalRevenueCents,
      perTier,
    }
  })

export const getEventAttendeeList = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string; search?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    // Organizer/admin OR staff with scan capability
    const event = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
    })
    if (!event) throw new Error('EVENT_NOT_FOUND')

    const isEventOrganizer = event.organizerId === session.user.id
    const isAdminRole = isAdmin(session.user.role as Role)
    let allowed = isEventOrganizer || isAdminRole
    if (!allowed) {
      allowed = await hasCapability(
        session.user.id,
        session.user.role as Role,
        'staff:scan_tickets',
      )
    }
    if (!allowed) throw new Error('FORBIDDEN')

    const rows = await db.query.tickets.findMany({
      where: eq(tickets.eventId, data.eventId),
      with: {
        owner: { columns: { id: true, name: true, email: true } },
        tier: { columns: { id: true, name: true } },
      },
      orderBy: [asc(tickets.createdAt)],
    })

    const q = data.search?.trim().toLowerCase()
    const filtered = q
      ? rows.filter(
          (t) =>
            t.owner.name.toLowerCase().includes(q) ||
            t.owner.email.toLowerCase().includes(q),
        )
      : rows

    return filtered.map((t) => ({
      ticketId: t.id,
      status: t.status,
      checkedInAt: t.checkedInAt,
      attendee: t.owner,
      tier: t.tier,
    }))
  })
