// app/routes/api/stripe-webhook.ts
//
// Stripe webhook handler. Covers the events that synchronous verification
// in purchaseTickets / performRefund can't catch:
//
//   - charge.refunded         → out-of-band refunds (initiated from the
//                               Stripe dashboard). Keeps our DB in sync.
//   - charge.dispute.created  → chargeback alerts. We log + email the order
//                               user and event organizer; no auto-freezing.
//
// Other events are recorded in stripe_webhook_events with status='ignored'
// so we have a paper trail if we later need to debug or extend handling.
//
// Idempotency: Stripe retries webhooks aggressively. We insert a row keyed
// on stripe_event_id and only process it once. Handlers are still expected
// to be internally idempotent (performRefund already refuses to refund a
// ticket that isn't 'valid', which makes double-delivery safe).

import { createServerFileRoute } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import type Stripe from 'stripe'
import { db } from '~/lib/db.server'
import { orders, tickets, stripeWebhookEvents, events, users } from '~/lib/schema'
import { getStripe } from '~/lib/stripe.server'
import { sendEmail } from '~/lib/email.server'
import { performRefund, sendRefundEmail } from '~/server/fns/refund-helpers.server'

const HANDLED_EVENTS = new Set([
  'charge.refunded',
  'charge.dispute.created',
])

export const ServerRoute = createServerFileRoute(
  '/api/stripe-webhook' as never,
).methods({
  POST: async ({ request }) => {
    const stripe = getStripe()
    if (!stripe) {
      return new Response('stripe not configured', { status: 503 })
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) {
      console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set')
      return new Response('webhook secret not set', { status: 503 })
    }
    const signature = request.headers.get('stripe-signature')
    if (!signature) {
      return new Response('missing stripe-signature', { status: 400 })
    }

    const rawBody = await request.text()

    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret)
    } catch (err) {
      console.error('[stripe-webhook] signature verification failed', err)
      return new Response(
        `invalid signature: ${(err as Error).message}`,
        { status: 400 },
      )
    }

    // Idempotency: first-writer-wins. If the row already exists and was
    // processed, return 200 so Stripe stops retrying.
    const existing = await db.query.stripeWebhookEvents.findFirst({
      where: eq(stripeWebhookEvents.stripeEventId, event.id),
    })
    if (existing?.status === 'processed' || existing?.status === 'ignored') {
      return new Response('already processed', { status: 200 })
    }

    if (!existing) {
      await db
        .insert(stripeWebhookEvents)
        .values({
          stripeEventId: event.id,
          type: event.type,
          status: 'received',
          payload: event as unknown as Record<string, unknown>,
        })
        .onConflictDoNothing()
    }

    if (!HANDLED_EVENTS.has(event.type)) {
      await db
        .update(stripeWebhookEvents)
        .set({ status: 'ignored', processedAt: new Date() })
        .where(eq(stripeWebhookEvents.stripeEventId, event.id))
      return new Response('ignored', { status: 200 })
    }

    try {
      switch (event.type) {
        case 'charge.refunded':
          await handleChargeRefunded(event.data.object as Stripe.Charge)
          break
        case 'charge.dispute.created':
          await handleDisputeCreated(event.data.object as Stripe.Dispute)
          break
      }

      await db
        .update(stripeWebhookEvents)
        .set({ status: 'processed', processedAt: new Date() })
        .where(eq(stripeWebhookEvents.stripeEventId, event.id))

      return new Response('ok', { status: 200 })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[stripe-webhook] ${event.type} handler failed`, err)
      await db
        .update(stripeWebhookEvents)
        .set({ status: 'failed', error: message })
        .where(eq(stripeWebhookEvents.stripeEventId, event.id))
      // Return 500 so Stripe retries
      return new Response(`handler failed: ${message}`, { status: 500 })
    }
  },
})

// ── handlers ────────────────────────────────────────────────────────────

async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id
  if (!paymentIntentId) {
    console.warn('[stripe-webhook] charge.refunded without payment_intent')
    return
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.paymentRef, paymentIntentId),
  })
  if (!order) {
    console.warn(
      `[stripe-webhook] charge.refunded: no order for pi=${paymentIntentId}`,
    )
    return
  }

  // Only act on full refunds for v1. Partial refunds would require matching
  // the refunded amount to specific tickets, which needs human judgement.
  const isFullRefund = charge.amount_refunded >= charge.amount
  if (!isFullRefund) {
    console.warn(
      `[stripe-webhook] partial refund on order ${order.id} — manual review required`,
    )
    throw new Error('PARTIAL_REFUND_NOT_HANDLED')
  }

  // Refund every still-valid ticket on the order, reusing performRefund so
  // all the bookkeeping (refund row, tier quantitySold, order status,
  // notification payload) runs the same way it would from the UI flow.
  const validTickets = await db.query.tickets.findMany({
    where: eq(tickets.orderId, order.id),
  })

  for (const t of validTickets) {
    if (t.status !== 'valid') continue
    try {
      const result = await performRefund(
        t.id,
        order.userId,
        'Refunded via Stripe dashboard',
        true, // isAdminOverride — bypasses event-started / ownership checks
        true, // skipStripe — Stripe already did the refund
      )
      if (result.notify) sendRefundEmail(result.notify)
    } catch (err) {
      // NOT_REFUNDABLE means the ticket was already refunded (idempotent replay)
      if ((err as Error).message !== 'NOT_REFUNDABLE') throw err
    }
  }
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const chargeId =
    typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
  const stripe = getStripe()
  if (!stripe) return

  // Need the payment_intent to find our order — it's on the charge.
  const charge = await stripe.charges.retrieve(chargeId)
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id
  if (!paymentIntentId) {
    console.warn('[stripe-webhook] dispute.created without payment_intent')
    return
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.paymentRef, paymentIntentId),
  })
  if (!order) {
    console.warn(
      `[stripe-webhook] dispute.created: no order for pi=${paymentIntentId}`,
    )
    return
  }

  const [buyer, event] = await Promise.all([
    db.query.users.findFirst({
      where: eq(users.id, order.userId),
      columns: { email: true, name: true },
    }),
    db.query.events.findFirst({
      where: eq(events.id, order.eventId),
      with: { organizer: { columns: { email: true, name: true } } },
    }),
  ])

  const amountStr = `$${(dispute.amount / 100).toFixed(2)}`
  const reason = dispute.reason || 'unknown'
  const eventTitle = event?.title ?? 'your event'

  const recipients: { email: string; name: string; role: 'buyer' | 'organizer' }[] = []
  if (buyer?.email) {
    recipients.push({
      email: buyer.email,
      name: buyer.name || 'there',
      role: 'buyer',
    })
  }
  if (event?.organizer?.email) {
    recipients.push({
      email: event.organizer.email,
      name: event.organizer.name || 'there',
      role: 'organizer',
    })
  }

  for (const r of recipients) {
    const body =
      r.role === 'buyer'
        ? `Hi ${r.name},\n\n` +
          `We received a chargeback dispute on your order for "${eventTitle}" ` +
          `(${amountStr}, reason: ${reason}).\n\n` +
          `If this was a mistake, please reply to this email so we can resolve it.\n\n` +
          `— EOM`
        : `Hi ${r.name},\n\n` +
          `A chargeback dispute was opened on order ${order.orderNumber} ` +
          `for your event "${eventTitle}" (${amountStr}, reason: ${reason}).\n\n` +
          `Stripe will handle the dispute evidence flow. No action is required ` +
          `from you yet — we'll follow up if we need documentation.\n\n` +
          `— EOM`
    sendEmail({
      to: r.email,
      subject: `Chargeback dispute — ${eventTitle}`,
      text: body,
    }).catch((err) => console.error('[dispute email]', err))
  }
}
