import { eq, sql } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import {
  tickets,
  ticketTiers,
  orders,
  refunds,
  users,
} from '~/lib/schema'
import { getStripe } from '~/lib/stripe.server'
import { sendEmail } from '~/lib/email.server'

export async function performRefund(
  ticketId: string,
  actorId: string,
  reason: string | undefined,
  isAdminOverride: boolean,
  skipStripe = false,
) {
  return db.transaction(async (tx) => {
    const ticket = await tx.query.tickets.findFirst({
      where: eq(tickets.id, ticketId),
      with: { event: true, tier: true, order: true },
    })
    if (!ticket) throw new Error('NOT_FOUND')
    if (!isAdminOverride && ticket.ownerId !== actorId) {
      throw new Error('FORBIDDEN')
    }
    if (ticket.status !== 'valid') throw new Error('NOT_REFUNDABLE')
    if (!isAdminOverride && ticket.event.startDate.getTime() <= Date.now()) {
      throw new Error('EVENT_STARTED')
    }

    // Lock tier row
    await tx.execute(
      sql`SELECT id FROM ticket_tiers WHERE id = ${ticket.tierId} FOR UPDATE`,
    )

    // Stripe refund (best-effort; logs on failure but doesn't block DB refund).
    // Skipped when the refund originated from Stripe itself (webhook-initiated).
    if (
      !skipStripe &&
      ticket.order.paymentMethod === 'stripe' &&
      ticket.order.paymentRef &&
      ticket.tier.priceCents > 0
    ) {
      const stripe = getStripe()
      if (stripe) {
        try {
          await stripe.refunds.create({
            payment_intent: ticket.order.paymentRef,
            amount: ticket.tier.priceCents,
            reason: 'requested_by_customer',
            metadata: { ticketId: ticket.id, actorId },
          })
        } catch (err) {
          console.error('[stripe refund] failed', err)
          if (!isAdminOverride) throw new Error('STRIPE_REFUND_FAILED')
        }
      }
    }

    await tx.insert(refunds).values({
      orderId: ticket.orderId,
      ticketIds: [ticket.id],
      amountCents: ticket.tier.priceCents,
      reason: reason?.trim() || null,
      requestedBy: actorId,
      approvedBy: isAdminOverride ? actorId : null,
      status: 'approved',
    })

    const [updated] = await tx
      .update(tickets)
      .set({ status: 'refunded' })
      .where(eq(tickets.id, ticket.id))
      .returning()

    const owner = await tx.query.users.findFirst({
      where: eq(users.id, ticket.ownerId),
      columns: { email: true, name: true },
    })

    await tx
      .update(ticketTiers)
      .set({
        quantitySold: sql`${ticketTiers.quantitySold} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(ticketTiers.id, ticket.tierId))

    // Update order status based on remaining valid tickets in order
    const orderTickets = await tx.query.tickets.findMany({
      where: eq(tickets.orderId, ticket.orderId),
    })
    const allRefunded = orderTickets.every((t) => t.status === 'refunded')
    const anyValid = orderTickets.some(
      (t) => t.status === 'valid' || t.status === 'checked_in',
    )
    const newOrderStatus = allRefunded
      ? 'refunded'
      : anyValid
        ? 'partially_refunded'
        : 'refunded'

    await tx
      .update(orders)
      .set({
        status: newOrderStatus,
        refundedAt: allRefunded ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, ticket.orderId))

    return {
      ticket: updated,
      notify: owner
        ? {
            email: owner.email,
            name: owner.name,
            eventTitle: ticket.event.title,
            tierName: ticket.tier.name,
            amountCents: ticket.tier.priceCents,
          }
        : null,
    }
  })
}

export function sendRefundEmail(notify: {
  email: string
  name: string
  eventTitle: string
  tierName: string
  amountCents: number
}) {
  const amountStr =
    notify.amountCents > 0 ? `$${(notify.amountCents / 100).toFixed(2)}` : 'Free'
  sendEmail({
    to: notify.email,
    subject: `Refund processed — ${notify.eventTitle}`,
    text:
      `Hi ${notify.name || 'there'},\n\n` +
      `Your ticket for "${notify.eventTitle}" (${notify.tierName}) has been refunded.\n` +
      `Amount: ${amountStr}\n\n` +
      `— EOM`,
  }).catch((err) => console.error('[refund email]', err))
}
