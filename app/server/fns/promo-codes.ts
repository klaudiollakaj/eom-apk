import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { events, promoCodes } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { isAdmin, type Role } from '~/lib/permissions'

async function requireEventOwnership(eventId: string, userId: string, role: Role) {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event) throw new Error('EVENT_NOT_FOUND')
  if (event.organizerId !== userId && !isAdmin(role)) {
    throw new Error('FORBIDDEN')
  }
  return event
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase()
}

export const listEventPromoCodes = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireEventOwnership(data.eventId, session.user.id, session.user.role as Role)
    return db.query.promoCodes.findMany({
      where: eq(promoCodes.eventId, data.eventId),
      orderBy: [desc(promoCodes.createdAt)],
    })
  })

export const createPromoCode = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      eventId: string
      code: string
      discountType: 'percent' | 'fixed'
      discountValue: number
      maxUses?: number | null
      expiresAt?: string | null
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireEventOwnership(data.eventId, session.user.id, session.user.role as Role)

    const code = normalizeCode(data.code)
    if (!code || code.length < 3 || code.length > 32) {
      throw new Error('INVALID_CODE')
    }
    if (data.discountType !== 'percent' && data.discountType !== 'fixed') {
      throw new Error('INVALID_DISCOUNT_TYPE')
    }
    if (!Number.isInteger(data.discountValue) || data.discountValue < 1) {
      throw new Error('INVALID_DISCOUNT_VALUE')
    }
    if (data.discountType === 'percent' && data.discountValue > 100) {
      throw new Error('INVALID_DISCOUNT_VALUE')
    }

    const existing = await db.query.promoCodes.findFirst({
      where: and(eq(promoCodes.eventId, data.eventId), sql`UPPER(${promoCodes.code}) = ${code}`),
    })
    if (existing) throw new Error('CODE_ALREADY_EXISTS')

    const [row] = await db
      .insert(promoCodes)
      .values({
        eventId: data.eventId,
        code,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxUses: data.maxUses ?? null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        isActive: true,
      })
      .returning()
    return row
  })

export const updatePromoCode = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      promoCodeId: string
      discountType?: 'percent' | 'fixed'
      discountValue?: number
      maxUses?: number | null
      expiresAt?: string | null
      isActive?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const promo = await db.query.promoCodes.findFirst({
      where: eq(promoCodes.id, data.promoCodeId),
    })
    if (!promo) throw new Error('PROMO_NOT_FOUND')
    await requireEventOwnership(promo.eventId, session.user.id, session.user.role as Role)

    const patch: Partial<typeof promoCodes.$inferInsert> = { updatedAt: new Date() }
    if (data.discountType !== undefined) patch.discountType = data.discountType
    if (data.discountValue !== undefined) {
      if (!Number.isInteger(data.discountValue) || data.discountValue < 1) {
        throw new Error('INVALID_DISCOUNT_VALUE')
      }
      patch.discountValue = data.discountValue
    }
    if (data.maxUses !== undefined) patch.maxUses = data.maxUses
    if (data.expiresAt !== undefined) {
      patch.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
    }
    if (data.isActive !== undefined) patch.isActive = data.isActive

    const [row] = await db
      .update(promoCodes)
      .set(patch)
      .where(eq(promoCodes.id, data.promoCodeId))
      .returning()
    return row
  })

export const deletePromoCode = createServerFn({ method: 'POST' })
  .validator((input: { promoCodeId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const promo = await db.query.promoCodes.findFirst({
      where: eq(promoCodes.id, data.promoCodeId),
    })
    if (!promo) throw new Error('PROMO_NOT_FOUND')
    await requireEventOwnership(promo.eventId, session.user.id, session.user.role as Role)
    await db.delete(promoCodes).where(eq(promoCodes.id, data.promoCodeId))
    return { ok: true }
  })

/**
 * Public validation — used on the checkout page to preview discount before purchase.
 * Does NOT reserve or consume the code; the real atomic check happens in purchaseTickets.
 */
export const previewPromoCode = createServerFn({ method: 'POST' })
  .validator(
    (input: { eventId: string; code: string; subtotalCents: number }) => input,
  )
  .handler(async ({ data }) => {
    const code = normalizeCode(data.code)
    if (!code) throw new Error('PROMO_INVALID')

    const promo = await db.query.promoCodes.findFirst({
      where: and(eq(promoCodes.eventId, data.eventId), sql`UPPER(${promoCodes.code}) = ${code}`),
    })
    if (!promo) throw new Error('PROMO_INVALID')
    if (!promo.isActive) throw new Error('PROMO_INACTIVE')
    if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
      throw new Error('PROMO_EXPIRED')
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      throw new Error('PROMO_EXHAUSTED')
    }

    let discountCents = 0
    if (promo.discountType === 'percent') {
      discountCents = Math.floor((data.subtotalCents * promo.discountValue) / 100)
    } else {
      discountCents = promo.discountValue
    }
    if (discountCents > data.subtotalCents) discountCents = data.subtotalCents

    return {
      code: promo.code,
      discountType: promo.discountType as 'percent' | 'fixed',
      discountValue: promo.discountValue,
      discountCents,
    }
  })
