// app/server/fns/negotiations.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, asc, notInArray } from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  negotiations, negotiationRounds, eventServices,
  services, servicePackages, events, users, userLogs,
} from '~/lib/schema'
import { requireAuth } from '~/server/fns/auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

const TERMINAL_STATUSES = ['accepted', 'rejected', 'cancelled', 'expired']
const EXPIRY_DAYS = 14

function checkExpiry(negotiation: { status: string; updatedAt: Date }) {
  if (TERMINAL_STATUSES.includes(negotiation.status)) return negotiation.status
  const daysSinceUpdate = (Date.now() - new Date(negotiation.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpdate > EXPIRY_DAYS) return 'expired'
  return negotiation.status
}

// ── Organizer: Request quote (hidden-price services) ──
export const requestQuote = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    packageId?: string
    eventId: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'organizer' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')

    // Duplicate check
    const existing = await db.query.negotiations.findFirst({
      where: and(
        eq(negotiations.serviceId, data.serviceId),
        eq(negotiations.eventId, data.eventId),
        eq(negotiations.providerId, service.providerId),
        notInArray(negotiations.status, TERMINAL_STATUSES),
      ),
    })
    if (existing) throw new Error('DUPLICATE: Active negotiation already exists for this service + event')

    const [negotiation] = await db.insert(negotiations).values({
      eventId: data.eventId,
      serviceId: data.serviceId,
      packageId: data.packageId || null,
      organizerId: session.user.id,
      providerId: service.providerId,
      status: 'requested',
      initiatedBy: 'organizer',
    }).returning()

    // No initial round for quote requests — provider responds with first offer

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'quote_requested',
      details: { negotiationId: negotiation.id, serviceId: data.serviceId, eventId: data.eventId },
    })

    return negotiation
  })

// ── Organizer: Send direct offer (public-price services) ──
export const sendOffer = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    packageId?: string
    eventId: string
    price: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'organizer' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')

    // Duplicate check
    const existing = await db.query.negotiations.findFirst({
      where: and(
        eq(negotiations.serviceId, data.serviceId),
        eq(negotiations.eventId, data.eventId),
        eq(negotiations.providerId, service.providerId),
        notInArray(negotiations.status, TERMINAL_STATUSES),
      ),
    })
    if (existing) throw new Error('DUPLICATE: Active negotiation already exists for this service + event')

    const [negotiation] = await db.insert(negotiations).values({
      eventId: data.eventId,
      serviceId: data.serviceId,
      packageId: data.packageId || null,
      organizerId: session.user.id,
      providerId: service.providerId,
      status: 'offered',
      initiatedBy: 'organizer',
    }).returning()

    // Create initial round
    await db.insert(negotiationRounds).values({
      negotiationId: negotiation.id,
      senderId: session.user.id,
      action: 'offer',
      price: data.price,
      message: data.message || null,
      roundNumber: 1,
    })

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'offer_sent',
      details: { negotiationId: negotiation.id, price: data.price },
    })

    return negotiation
  })

// ── Provider: Send offer to organizer for a published event ──
export const sendProviderOffer = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    packageId?: string
    eventId: string
    price: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'service_provider' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    // Verify service ownership
    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')
    if (service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    // Verify event is published
    const event = await db.query.events.findFirst({ where: eq(events.id, data.eventId) })
    if (!event) throw new Error('NOT_FOUND')
    if (event.status !== 'published') throw new Error('FORBIDDEN: Event must be published')

    // Duplicate check
    const existing = await db.query.negotiations.findFirst({
      where: and(
        eq(negotiations.serviceId, data.serviceId),
        eq(negotiations.eventId, data.eventId),
        eq(negotiations.providerId, session.user.id),
        notInArray(negotiations.status, TERMINAL_STATUSES),
      ),
    })
    if (existing) throw new Error('DUPLICATE: Active negotiation already exists for this service + event')

    const [negotiation] = await db.insert(negotiations).values({
      eventId: data.eventId,
      serviceId: data.serviceId,
      packageId: data.packageId || null,
      organizerId: event.organizerId,
      providerId: session.user.id,
      status: 'offered',
      initiatedBy: 'provider',
    }).returning()

    await db.insert(negotiationRounds).values({
      negotiationId: negotiation.id,
      senderId: session.user.id,
      action: 'offer',
      price: data.price,
      message: data.message || null,
      roundNumber: 1,
    })

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'provider_offer_sent',
      details: { negotiationId: negotiation.id, eventId: data.eventId, price: data.price },
    })

    return negotiation
  })

// ── Respond to negotiation (accept/reject/counter) ──
export const respondToNegotiation = createServerFn({ method: 'POST' })
  .validator((input: {
    negotiationId: string
    action: 'offer' | 'counter' | 'accept' | 'reject'
    price?: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const negotiation = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, data.negotiationId),
      with: { rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 } },
    })
    if (!negotiation) throw new Error('NOT_FOUND')

    // Verify participant
    const isOrganizer = negotiation.organizerId === session.user.id
    const isProvider = negotiation.providerId === session.user.id
    if (!isOrganizer && !isProvider && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    // Check expiry
    const currentStatus = checkExpiry(negotiation)
    if (currentStatus === 'expired') {
      await db.update(negotiations).set({ status: 'expired', updatedAt: new Date() }).where(eq(negotiations.id, data.negotiationId))
      throw new Error('NEGOTIATION_EXPIRED')
    }

    // Validate status transitions
    if (TERMINAL_STATUSES.includes(currentStatus)) {
      throw new Error('NEGOTIATION_CLOSED: Cannot respond to a terminal negotiation')
    }

    const lastRound = negotiation.rounds[0]
    const nextRoundNumber = (lastRound?.roundNumber ?? 0) + 1

    // For 'requested' status, only provider can respond with 'offer'
    if (currentStatus === 'requested') {
      if (!isProvider) throw new Error('FORBIDDEN: Only provider can respond to quote request')
      if (data.action !== 'offer') throw new Error('INVALID_ACTION: Must send an offer for quote request')
    }

    // Determine new status based on action
    let newStatus: string
    switch (data.action) {
      case 'offer':
        newStatus = 'offered'
        if (!data.price) throw new Error('PRICE_REQUIRED')
        break
      case 'counter':
        newStatus = currentStatus === 'offered' ? 'countered' : 'offered'
        if (!data.price) throw new Error('PRICE_REQUIRED')
        break
      case 'accept':
        newStatus = 'accepted'
        break
      case 'reject':
        newStatus = 'rejected'
        break
      default:
        throw new Error('INVALID_ACTION')
    }

    // Create the round
    await db.insert(negotiationRounds).values({
      negotiationId: data.negotiationId,
      senderId: session.user.id,
      action: data.action,
      price: data.price || null,
      message: data.message || null,
      roundNumber: nextRoundNumber,
    })

    // Update negotiation status
    await db.update(negotiations).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(negotiations.id, data.negotiationId))

    // On accept: create event_services record
    if (newStatus === 'accepted') {
      // Find the last offer/counter round with a price
      const allRounds = await db.query.negotiationRounds.findMany({
        where: eq(negotiationRounds.negotiationId, data.negotiationId),
        orderBy: [desc(negotiationRounds.roundNumber)],
      })
      const priceRound = allRounds.find((r) => r.price !== null)

      await db.insert(eventServices).values({
        eventId: negotiation.eventId,
        serviceId: negotiation.serviceId,
        negotiationId: negotiation.id,
        providerId: negotiation.providerId,
        agreedPrice: priceRound?.price ?? '0',
        agreedTerms: priceRound?.message || null,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: `negotiation_${data.action}`,
      details: { negotiationId: data.negotiationId, price: data.price },
    })

    return { status: newStatus }
  })

// ── Cancel negotiation ──
export const cancelNegotiation = createServerFn({ method: 'POST' })
  .validator((input: { negotiationId: string; message?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const negotiation = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, data.negotiationId),
      with: { rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 } },
    })
    if (!negotiation) throw new Error('NOT_FOUND')

    const isOrganizer = negotiation.organizerId === session.user.id
    const isProvider = negotiation.providerId === session.user.id
    if (!isOrganizer && !isProvider && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    if (TERMINAL_STATUSES.includes(negotiation.status)) {
      throw new Error('NEGOTIATION_CLOSED')
    }

    const lastRound = negotiation.rounds[0]
    const nextRoundNumber = (lastRound?.roundNumber ?? 0) + 1

    await db.insert(negotiationRounds).values({
      negotiationId: data.negotiationId,
      senderId: session.user.id,
      action: 'cancel',
      message: data.message || null,
      roundNumber: nextRoundNumber,
    })

    await db.update(negotiations).set({
      status: 'cancelled',
      updatedAt: new Date(),
    }).where(eq(negotiations.id, data.negotiationId))

    return { status: 'cancelled' }
  })

// ── List my negotiations ──
export const listMyNegotiations = createServerFn({ method: 'GET' })
  .validator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const isProvider = session.user.role === 'service_provider'
    const conditions = [
      isProvider
        ? eq(negotiations.providerId, session.user.id)
        : eq(negotiations.organizerId, session.user.id),
    ]
    if (data.status) {
      conditions.push(eq(negotiations.status, data.status))
    }

    const results = await db.query.negotiations.findMany({
      where: and(...conditions),
      with: {
        event: { columns: { id: true, title: true, status: true } },
        service: { columns: { id: true, title: true } },
        organizer: { columns: { id: true, name: true, image: true } },
        provider: { columns: { id: true, name: true, image: true } },
        rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 },
      },
      orderBy: [desc(negotiations.updatedAt)],
    })

    // Apply lazy expiry
    return results.map((neg) => {
      const actualStatus = checkExpiry(neg)
      return { ...neg, status: actualStatus }
    })
  })

// ── Get negotiation detail (with lazy expiry check) ──
export const getNegotiation = createServerFn({ method: 'GET' })
  .validator((input: { negotiationId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const negotiation = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, data.negotiationId),
      with: {
        event: { columns: { id: true, title: true, status: true, startDate: true } },
        service: { columns: { id: true, title: true } },
        package: true,
        organizer: { columns: { id: true, name: true, image: true } },
        provider: { columns: { id: true, name: true, image: true } },
        rounds: { orderBy: [asc(negotiationRounds.roundNumber)] },
      },
    })
    if (!negotiation) throw new Error('NOT_FOUND')

    // Verify participant
    const isOrganizer = negotiation.organizerId === session.user.id
    const isProvider = negotiation.providerId === session.user.id
    if (!isOrganizer && !isProvider && session.user.role !== 'superadmin' && session.user.role !== 'admin') {
      throw new Error('FORBIDDEN')
    }

    // Lazy expiry
    const actualStatus = checkExpiry(negotiation)
    if (actualStatus === 'expired' && negotiation.status !== 'expired') {
      await db.update(negotiations).set({ status: 'expired', updatedAt: new Date() }).where(eq(negotiations.id, data.negotiationId))
    }

    return { ...negotiation, status: actualStatus }
  })

// ── Admin: List all negotiations ──
export const listAllNegotiations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:negotiations:manage')
    return db.query.negotiations.findMany({
      with: {
        event: { columns: { id: true, title: true } },
        service: { columns: { id: true, title: true } },
        organizer: { columns: { id: true, name: true } },
        provider: { columns: { id: true, name: true } },
        rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 },
      },
      orderBy: [desc(negotiations.updatedAt)],
    })
  },
)
