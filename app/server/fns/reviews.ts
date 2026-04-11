import { createServerFn } from '@tanstack/react-start'
import { db } from '~/lib/db.server'
import { reviews, eventReviews, eventServices, events, users, tickets } from '~/lib/schema'
import { eq, and, desc, isNotNull, isNull, sql, avg, count } from 'drizzle-orm'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

// ── Submit a review ──────────────────────────────────────────

export const submitReview = createServerFn({ method: 'POST' })
  .validator((input: { eventServiceId: string; rating: number; comment?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new Error('INVALID_RATING: Must be integer 1-5')
    }

    // Verify event_service exists and caller is the organizer
    const es = await db.query.eventServices.findFirst({
      where: eq(eventServices.id, data.eventServiceId),
      with: {
        negotiation: { columns: { organizerId: true } },
      },
    })
    if (!es) throw new Error('NOT_FOUND')
    if (es.negotiation.organizerId !== session.user.id) {
      throw new Error('FORBIDDEN: Only the organizer can review this deal')
    }

    // Check for duplicate
    const existing = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.eventServiceId, data.eventServiceId),
        eq(reviews.reviewerId, session.user.id),
      ),
    })
    if (existing) throw new Error('DUPLICATE: You have already reviewed this deal')

    const [review] = await db.insert(reviews).values({
      eventServiceId: data.eventServiceId,
      reviewerId: session.user.id,
      revieweeId: es.providerId,
      rating: data.rating,
      comment: data.comment || null,
      type: 'organizer_to_provider',
    }).returning()

    return review
  })

// ── Get reviews for a specific service ───────────────────────

export const getReviewsForService = createServerFn({ method: 'GET' })
  .validator((input: { serviceId: string; limit?: number; offset?: number }) => input)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10
    const offset = data.offset ?? 0

    const results = await db.query.reviews.findMany({
      where: and(
        eq(reviews.isVisible, true),
        sql`${reviews.eventServiceId} IN (
          SELECT ${eventServices.id} FROM ${eventServices}
          WHERE ${eventServices.serviceId} = ${data.serviceId}
        )`,
      ),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .innerJoin(eventServices, eq(reviews.eventServiceId, eventServices.id))
      .where(and(
        eq(eventServices.serviceId, data.serviceId),
        eq(reviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewer,
        event: r.eventService.event,
      })),
      total: totalResult?.count ?? 0,
    }
  })

// ── Get reviews for a provider (all services) ────────────────

export const getReviewsForProvider = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string; limit?: number; offset?: number }) => input)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10
    const offset = data.offset ?? 0

    const results = await db.query.reviews.findMany({
      where: and(
        eq(reviews.revieweeId, data.providerId),
        eq(reviews.isVisible, true),
      ),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(and(
        eq(reviews.revieweeId, data.providerId),
        eq(reviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewer,
        event: r.eventService.event,
      })),
      total: totalResult?.count ?? 0,
    }
  })

// ── Get provider rating summary ──────────────────────────────

export const getProviderRatingSummary = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string }) => input)
  .handler(async ({ data }) => {
    const [result] = await db
      .select({
        avgRating: avg(reviews.rating),
        reviewCount: count(),
      })
      .from(reviews)
      .where(and(
        eq(reviews.revieweeId, data.providerId),
        eq(reviews.isVisible, true),
      ))

    return {
      avgRating: result?.avgRating ? Number(result.avgRating) : null,
      reviewCount: result?.reviewCount ?? 0,
    }
  })

// ── Get my reviews (provider view) ──────────────────────────

export const getMyReviews = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number; offset?: number } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const limit = data.limit ?? 20
    const offset = data.offset ?? 0

    const results = await db.query.reviews.findMany({
      where: eq(reviews.revieweeId, session.user.id),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.revieweeId, session.user.id))

    const [avgResult] = await db
      .select({ avgRating: avg(reviews.rating) })
      .from(reviews)
      .where(and(
        eq(reviews.revieweeId, session.user.id),
        eq(reviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        isVisible: r.isVisible,
        reportedAt: r.reportedAt,
        reviewer: r.reviewer,
        event: r.eventService.event,
      })),
      total: totalResult?.count ?? 0,
      avgRating: avgResult?.avgRating ? Number(avgResult.avgRating) : null,
    }
  })

// ── Report a review ─────────────────────────────────────────

export const reportReview = createServerFn({ method: 'POST' })
  .validator((input: { reviewId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.reviewId),
    })
    if (!review) throw new Error('NOT_FOUND')
    if (review.revieweeId !== session.user.id) {
      throw new Error('FORBIDDEN: Only the reviewed provider can report')
    }
    if (review.reportedAt) return { success: true } // already reported

    await db.update(reviews).set({
      reportedAt: new Date(),
      reportReason: data.reason,
      updatedAt: new Date(),
    }).where(eq(reviews.id, data.reviewId))

    return { success: true }
  })

// ── Get reported reviews (admin) ────────────────────────────

export const getReportedReviews = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number; offset?: number; status?: 'pending' | 'resolved' } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:reviews:moderate')

    const limit = data.limit ?? 20
    const offset = data.offset ?? 0

    const conditions = [isNotNull(reviews.reportedAt)]
    if (data.status === 'resolved') {
      conditions.push(isNotNull(reviews.moderatedAt))
    } else {
      conditions.push(isNull(reviews.moderatedAt))
    }

    const results = await db.query.reviews.findMany({
      where: and(...conditions),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        reviewee: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
            service: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.reportedAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(and(...conditions))

    return { reviews: results, total: totalResult?.count ?? 0 }
  })

// ── Moderate a review (admin) ───────────────────────────────

export const moderateReview = createServerFn({ method: 'POST' })
  .validator((input: { reviewId: string; action: 'hide' | 'unhide' | 'dismiss' }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:reviews:moderate')

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.reviewId),
    })
    if (!review) throw new Error('NOT_FOUND')

    const now = new Date()

    switch (data.action) {
      case 'hide':
        await db.update(reviews).set({
          isVisible: false,
          moderatedAt: now,
          moderationAction: 'hidden',
          updatedAt: now,
        }).where(eq(reviews.id, data.reviewId))
        break
      case 'unhide':
        await db.update(reviews).set({
          isVisible: true,
          moderatedAt: now,
          moderationAction: null,
          updatedAt: now,
        }).where(eq(reviews.id, data.reviewId))
        break
      case 'dismiss':
        await db.update(reviews).set({
          moderatedAt: now,
          moderationAction: 'dismissed',
          updatedAt: now,
        }).where(eq(reviews.id, data.reviewId))
        break
    }

    return { success: true }
  })

// ══════════════════════════════════════════════════
// Attendee → Event Reviews (gated by checked-in ticket)
// ══════════════════════════════════════════════════

async function userHasCheckedInTicket(userId: string, eventId: string): Promise<boolean> {
  const ticket = await db.query.tickets.findFirst({
    where: and(
      eq(tickets.eventId, eventId),
      eq(tickets.ownerId, userId),
      eq(tickets.status, 'checked_in'),
    ),
    columns: { id: true },
  })
  return !!ticket
}

export const canReviewEvent = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    let session
    try {
      session = await requireAuth()
    } catch {
      return { canReview: false, reason: 'NOT_AUTHENTICATED' as const, existingReviewId: null }
    }

    const hasTicket = await userHasCheckedInTicket(session.user.id, data.eventId)
    if (!hasTicket) {
      return { canReview: false, reason: 'NO_CHECKED_IN_TICKET' as const, existingReviewId: null }
    }

    const existing = await db.query.eventReviews.findFirst({
      where: and(
        eq(eventReviews.eventId, data.eventId),
        eq(eventReviews.userId, session.user.id),
      ),
      columns: { id: true },
    })

    if (existing) {
      return { canReview: false, reason: 'ALREADY_REVIEWED' as const, existingReviewId: existing.id }
    }

    return { canReview: true, reason: null, existingReviewId: null }
  })

export const submitEventReview = createServerFn({ method: 'POST' })
  .validator((input: { eventId: string; rating: number; comment?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new Error('INVALID_RATING: Must be integer 1-5')
    }

    const hasTicket = await userHasCheckedInTicket(session.user.id, data.eventId)
    if (!hasTicket) {
      throw new Error('FORBIDDEN: Only checked-in attendees can review this event')
    }

    const existing = await db.query.eventReviews.findFirst({
      where: and(
        eq(eventReviews.eventId, data.eventId),
        eq(eventReviews.userId, session.user.id),
      ),
    })
    if (existing) throw new Error('DUPLICATE: You have already reviewed this event')

    const [review] = await db.insert(eventReviews).values({
      eventId: data.eventId,
      userId: session.user.id,
      rating: data.rating,
      comment: data.comment || null,
    }).returning()

    return review
  })

export const updateEventReview = createServerFn({ method: 'POST' })
  .validator((input: { reviewId: string; rating: number; comment?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new Error('INVALID_RATING: Must be integer 1-5')
    }

    const existing = await db.query.eventReviews.findFirst({
      where: eq(eventReviews.id, data.reviewId),
    })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.userId !== session.user.id) throw new Error('FORBIDDEN')

    const [updated] = await db
      .update(eventReviews)
      .set({
        rating: data.rating,
        comment: data.comment || null,
        updatedAt: new Date(),
      })
      .where(eq(eventReviews.id, data.reviewId))
      .returning()

    return updated
  })

export const getEventReviews = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string; limit?: number; offset?: number }) => input)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10
    const offset = data.offset ?? 0

    const results = await db.query.eventReviews.findMany({
      where: and(
        eq(eventReviews.eventId, data.eventId),
        eq(eventReviews.isVisible, true),
      ),
      with: {
        user: { columns: { id: true, name: true, image: true } },
      },
      orderBy: [desc(eventReviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(eventReviews)
      .where(and(
        eq(eventReviews.eventId, data.eventId),
        eq(eventReviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        user: r.user,
      })),
      total: totalResult?.count ?? 0,
    }
  })

export const getEventRatingSummary = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const [result] = await db
      .select({
        avgRating: avg(eventReviews.rating),
        reviewCount: count(),
      })
      .from(eventReviews)
      .where(and(
        eq(eventReviews.eventId, data.eventId),
        eq(eventReviews.isVisible, true),
      ))

    return {
      avgRating: result?.avgRating ? Number(result.avgRating) : null,
      reviewCount: result?.reviewCount ?? 0,
    }
  })

// ── Get reviewable deals (organizer) ────────────────────────

export const getReviewableDeals = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const results = await db.execute(sql`
      SELECT
        es.id,
        es.agreed_price AS "agreedPrice",
        es.created_at AS "createdAt",
        u.name AS "providerName",
        u.id AS "providerId",
        u.image AS "providerImage",
        s.title AS "serviceTitle",
        e.title AS "eventTitle",
        e.id AS "eventId"
      FROM event_services es
      INNER JOIN events e ON es.event_id = e.id
      INNER JOIN users u ON es.provider_id = u.id
      INNER JOIN services s ON es.service_id = s.id
      WHERE e.organizer_id = ${session.user.id}
      AND NOT EXISTS (
        SELECT 1 FROM reviews r
        WHERE r.event_service_id = es.id
        AND r.reviewer_id = ${session.user.id}
      )
      ORDER BY es.created_at DESC
    `)

    return results as unknown as any[]
  },
)
