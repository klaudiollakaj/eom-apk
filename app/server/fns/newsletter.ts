import { createServerFn } from '@tanstack/react-start'
import { eq, count, desc, and, isNull, isNotNull } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { newsletterSubscribers } from '~/lib/schema'
import { sendEmail } from '~/lib/email.server'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

const PUBLIC_URL = process.env.PUBLIC_URL || 'https://eom.up.railway.app'

export const subscribeNewsletter = createServerFn({ method: 'POST' })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase()
    if (!email || !email.includes('@')) throw new Error('INVALID_EMAIL')

    // Check if already subscribed
    const existing = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.email, email),
    })

    if (existing) {
      if (existing.confirmedAt && !existing.unsubscribedAt) {
        return { status: 'already_subscribed' as const }
      }
      if (existing.unsubscribedAt) {
        // Re-subscribe
        await db.update(newsletterSubscribers)
          .set({ unsubscribedAt: null, confirmedAt: new Date() })
          .where(eq(newsletterSubscribers.id, existing.id))
        return { status: 'resubscribed' as const }
      }
      // Resend confirmation
      return { status: 'confirmation_sent' as const }
    }

    const [sub] = await db.insert(newsletterSubscribers)
      .values({ email })
      .returning()

    // Send confirmation email
    const confirmUrl = `${PUBLIC_URL}/newsletter/confirm?token=${sub.confirmToken}`
    sendEmail({
      to: email,
      subject: 'Confirm your newsletter subscription — EOM',
      text:
        `Hi,\n\n` +
        `Please confirm your newsletter subscription:\n\n` +
        `${confirmUrl}\n\n` +
        `If you didn't request this, you can ignore this email.\n\n` +
        `— EOM`,
    }).catch((err) => console.error('[newsletter confirm]', err))

    return { status: 'confirmation_sent' as const }
  })

export const confirmNewsletter = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sub = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.confirmToken, data.token),
    })
    if (!sub) throw new Error('NOT_FOUND')

    if (sub.confirmedAt) return { status: 'already_confirmed' as const }

    await db.update(newsletterSubscribers)
      .set({ confirmedAt: new Date() })
      .where(eq(newsletterSubscribers.id, sub.id))

    return { status: 'confirmed' as const }
  })

export const unsubscribeNewsletter = createServerFn({ method: 'POST' })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const sub = await db.query.newsletterSubscribers.findFirst({
      where: eq(newsletterSubscribers.unsubscribeToken, data.token),
    })
    if (!sub) throw new Error('NOT_FOUND')

    await db.update(newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.id, sub.id))

    return { status: 'unsubscribed' as const }
  })

export const getNewsletterStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const [total] = await db.select({ count: count() }).from(newsletterSubscribers)
    const [confirmed] = await db.select({ count: count() }).from(newsletterSubscribers)
      .where(and(isNotNull(newsletterSubscribers.confirmedAt), isNull(newsletterSubscribers.unsubscribedAt)))
    const [unsubscribed] = await db.select({ count: count() }).from(newsletterSubscribers)
      .where(isNotNull(newsletterSubscribers.unsubscribedAt))

    return {
      total: Number(total?.count ?? 0),
      active: Number(confirmed?.count ?? 0),
      unsubscribed: Number(unsubscribed?.count ?? 0),
    }
  },
)

export const listNewsletterSubscribers = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number; offset?: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const limit = data.limit ?? 50
    const offset = data.offset ?? 0

    const [rows, [total]] = await Promise.all([
      db.query.newsletterSubscribers.findMany({
        orderBy: [desc(newsletterSubscribers.createdAt)],
        limit,
        offset,
      }),
      db.select({ count: count() }).from(newsletterSubscribers),
    ])

    return { subscribers: rows, total: Number(total?.count ?? 0) }
  })

export const sendNewsletterEmail = createServerFn({ method: 'POST' })
  .validator((input: { subject: string; body: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    // Get all active subscribers
    const subscribers = await db.query.newsletterSubscribers.findMany({
      where: and(
        isNotNull(newsletterSubscribers.confirmedAt),
        isNull(newsletterSubscribers.unsubscribedAt),
      ),
    })

    let sent = 0
    for (const sub of subscribers) {
      const unsubUrl = `${PUBLIC_URL}/newsletter/unsubscribe?token=${sub.unsubscribeToken}`
      sendEmail({
        to: sub.email,
        subject: data.subject,
        text: `${data.body}\n\n---\nUnsubscribe: ${unsubUrl}`,
      }).catch((err) => console.error('[newsletter send]', err))
      sent++
    }

    return { sent }
  })
