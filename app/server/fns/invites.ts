import { createServerFn } from '@tanstack/react-start'
import { eq, and, or } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { events, eventInvites, users } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { isAdmin, type Role } from '~/lib/permissions'
import { sendEmail } from '~/lib/email.server'

async function requireEventOwner(eventId: string, userId: string, role: Role) {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) })
  if (!event) throw new Error('NOT_FOUND')
  if (event.organizerId !== userId && !isAdmin(role)) throw new Error('FORBIDDEN')
  return event
}

export const sendInvites = createServerFn({ method: 'POST' })
  .validator((input: { eventId: string; emails: string[] }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const event = await requireEventOwner(data.eventId, session.user.id, session.user.role as Role)

    const results: { email: string; status: 'sent' | 'already_invited' }[] = []

    for (const email of data.emails) {
      const trimmed = email.trim().toLowerCase()
      if (!trimmed) continue

      // Check if already invited
      const existing = await db.query.eventInvites.findFirst({
        where: and(
          eq(eventInvites.eventId, data.eventId),
          eq(eventInvites.email, trimmed),
        ),
      })

      if (existing) {
        results.push({ email: trimmed, status: 'already_invited' })
        continue
      }

      // Check if the email belongs to a registered user
      const user = await db.query.users.findFirst({
        where: eq(users.email, trimmed),
        columns: { id: true },
      })

      const [invite] = await db.insert(eventInvites).values({
        eventId: data.eventId,
        email: trimmed,
        userId: user?.id ?? null,
        invitedBy: session.user.id,
      }).returning()

      // Send invite email
      const inviteUrl = `${process.env.PUBLIC_URL || 'https://eom.up.railway.app'}/events/${data.eventId}?invite=${invite.inviteCode}`
      sendEmail({
        to: trimmed,
        subject: `You're invited: ${event.title}`,
        text:
          `Hi,\n\n` +
          `You've been invited to "${event.title}".\n\n` +
          `View the event: ${inviteUrl}\n\n` +
          `— EOM`,
      }).catch((err) => console.error('[invite email]', err))

      results.push({ email: trimmed, status: 'sent' })
    }

    return results
  })

export const listEventInvites = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireEventOwner(data.eventId, session.user.id, session.user.role as Role)

    return db.query.eventInvites.findMany({
      where: eq(eventInvites.eventId, data.eventId),
      with: {
        user: { columns: { id: true, name: true, email: true } },
      },
      orderBy: (inv, { desc }) => [desc(inv.sentAt)],
    })
  })

export const revokeInvite = createServerFn({ method: 'POST' })
  .validator((input: { inviteId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const invite = await db.query.eventInvites.findFirst({
      where: eq(eventInvites.id, data.inviteId),
    })
    if (!invite) throw new Error('NOT_FOUND')

    await requireEventOwner(invite.eventId, session.user.id, session.user.role as Role)

    await db.delete(eventInvites).where(eq(eventInvites.id, data.inviteId))
    return { success: true }
  })

export const acceptInviteByCode = createServerFn({ method: 'POST' })
  .validator((input: { inviteCode: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const invite = await db.query.eventInvites.findFirst({
      where: eq(eventInvites.inviteCode, data.inviteCode),
    })
    if (!invite) throw new Error('NOT_FOUND')

    await db.update(eventInvites)
      .set({
        status: 'accepted',
        userId: session.user.id,
        respondedAt: new Date(),
      })
      .where(eq(eventInvites.id, invite.id))

    return { eventId: invite.eventId }
  })
