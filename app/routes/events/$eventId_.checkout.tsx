import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import { getEvent } from '~/server/fns/events'
import {
  listEventTiers,
  purchaseTickets,
  getStripeConfig,
  createStripePaymentIntent,
} from '~/server/fns/tickets'
import { previewPromoCode } from '~/server/fns/promo-codes'
import { getSession } from '~/server/fns/auth-helpers'
import { CheckoutSummary } from '~/components/tickets/CheckoutSummary'
import { MockPaymentForm, type MockPaymentValues } from '~/components/tickets/MockPaymentForm'
import { StripePaymentForm } from '~/components/tickets/StripePaymentForm'
import { computeDiscountCents } from '~/lib/pricing'

const searchSchema = z.object({
  tier: z.string().optional(),
})

export const Route = createFileRoute('/events/$eventId_/checkout')({
  validateSearch: searchSchema,
  beforeLoad: async () => {
    try {
      const session = await getSession()
      if (!session) {
        throw redirect({ to: '/login' })
      }
    } catch (err: any) {
      if (err?.to) throw err // re-throw redirects
      console.error('[checkout beforeLoad]', err)
      throw err
    }
  },
  loader: async ({ params }) => {
    try {
      const [event, tiers, stripeConfig] = await Promise.all([
        getEvent({ data: { eventId: params.eventId } }),
        listEventTiers({ data: { eventId: params.eventId } }),
        getStripeConfig().catch(() => ({ enabled: false, publishableKey: null })),
      ])
      if (!event) throw new Error('Event not found')
      return { event, tiers: tiers ?? [], stripeConfig }
    } catch (err: any) {
      console.error('[checkout loader]', err)
      throw err
    }
  },
  errorComponent: ({ error }: { error: Error }) => (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-red-600">Checkout Error</h1>
      <pre className="mt-4 whitespace-pre-wrap rounded bg-red-50 p-4 text-sm text-red-800">
        {error?.message || String(error)}
      </pre>
    </div>
  ),
  component: CheckoutPage,
})

function CheckoutPage() {
  const { event, tiers, stripeConfig } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const stripeEnabled = !!(
    stripeConfig?.enabled && stripeConfig?.publishableKey
  )

  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const t of tiers) initial[t.id] = 0
    if (search.tier && initial[search.tier] !== undefined) {
      initial[search.tier] = 1
    }
    return initial
  })

  const [payment, setPayment] = useState<MockPaymentValues>({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [promoInput, setPromoInput] = useState('')
  const [promoApplying, setPromoApplying] = useState(false)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [applied, setApplied] = useState<{
    code: string
    discountType: 'percent' | 'fixed'
    discountValue: number
  } | null>(null)

  // Stripe state
  const [stripeIntent, setStripeIntent] = useState<{
    clientSecret: string
    paymentIntentId: string
    totalCents: number
  } | null>(null)
  const [creatingIntent, setCreatingIntent] = useState(false)
  const [stripeConfirm, setStripeConfirm] = useState<
    (() => Promise<{ error?: string }>) | null
  >(null)
  const onStripeReady = useCallback(
    (fn: () => Promise<{ error?: string }>) => setStripeConfirm(() => fn),
    [],
  )

  const lines = useMemo(
    () =>
      tiers.map((t: any) => ({
        tierId: t.id,
        tierName: t.name,
        priceCents: t.priceCents,
        quantity: quantities[t.id] ?? 0,
      })),
    [tiers, quantities],
  )

  const subtotalCents = useMemo(
    () => lines.reduce((s, l) => s + l.priceCents * l.quantity, 0),
    [lines],
  )
  const totalTickets = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  )

  // Recompute discount whenever cart or promo changes — uses the shared
  // pricing helper so server and client stay in sync.
  const effectiveDiscountCents = useMemo(
    () => computeDiscountCents(lines, applied),
    [applied, lines],
  )

  const totalCents = Math.max(0, subtotalCents - effectiveDiscountCents)
  const isFree = totalCents === 0

  async function handleApplyPromo() {
    setPromoError(null)
    if (!promoInput.trim()) return
    if (subtotalCents === 0) {
      setPromoError('Select tickets before applying a promo code.')
      return
    }
    setPromoApplying(true)
    try {
      const result = await previewPromoCode({
        data: {
          eventId: event.id,
          code: promoInput.trim(),
          subtotalCents,
        },
      })
      setApplied(result)
      setStripeIntent(null)
      setStripeConfirm(null)
    } catch (err: any) {
      setApplied(null)
      setPromoError(friendlyError(err?.message || 'Invalid promo code'))
    } finally {
      setPromoApplying(false)
    }
  }

  function handleRemovePromo() {
    setApplied(null)
    setPromoInput('')
    setPromoError(null)
    setStripeIntent(null)
    setStripeConfirm(null)
  }

  function adjust(tierId: string, delta: number) {
    setQuantities((q) => {
      const tier = tiers.find((t: any) => t.id === tierId)
      if (!tier) return q
      const current = q[tierId] ?? 0
      const next = Math.max(
        0,
        Math.min(current + delta, tier.quantityAvailable, tier.maxPerUser),
      )
      return { ...q, [tierId]: next }
    })
    // Cart changed — any pending Stripe intent is stale
    setStripeIntent(null)
    setStripeConfirm(null)
  }

  async function loadStripePayment() {
    setError(null)
    setCreatingIntent(true)
    try {
      const items = lines
        .filter((l) => l.quantity > 0)
        .map((l) => ({ tierId: l.tierId, quantity: l.quantity }))
      const intent = await createStripePaymentIntent({
        data: {
          eventId: event.id,
          items,
          promoCode: applied?.code,
        },
      })
      if (!intent.clientSecret) throw new Error('Missing client secret')
      setStripeIntent({
        clientSecret: intent.clientSecret,
        paymentIntentId: intent.paymentIntentId,
        totalCents: intent.totalCents,
      })
    } catch (err: any) {
      setError(friendlyError(err?.message || 'Failed to initialize payment'))
    } finally {
      setCreatingIntent(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (totalTickets === 0) {
      setError('Please select at least one ticket')
      return
    }

    const items = lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({ tierId: l.tierId, quantity: l.quantity }))

    setSubmitting(true)
    try {
      let paymentIntentId: string | undefined

      if (!isFree && stripeEnabled) {
        if (!stripeIntent || !stripeConfirm) {
          setError('Initialize payment first.')
          setSubmitting(false)
          return
        }
        if (stripeIntent.totalCents !== totalCents) {
          setError('Cart changed — please reload payment.')
          setStripeIntent(null)
          setStripeConfirm(null)
          setSubmitting(false)
          return
        }
        const { error: confirmErr } = await stripeConfirm()
        if (confirmErr) {
          setError(confirmErr)
          setSubmitting(false)
          return
        }
        paymentIntentId = stripeIntent.paymentIntentId
      } else if (!isFree) {
        // Mock flow — small fake delay to feel like a payment
        await new Promise((r) => setTimeout(r, 800))
      }

      const result = await purchaseTickets({
        data: {
          eventId: event.id,
          items,
          promoCode: applied?.code,
          paymentIntentId,
          payment: isFree || stripeEnabled ? undefined : payment,
        },
      })
      const firstId = result.ticketIds[0]
      navigate({ to: '/tickets/$ticketId', params: { ticketId: firstId } })
    } catch (err: any) {
      const msg = err?.message || 'Purchase failed'
      setError(friendlyError(msg))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Checkout</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">{event.title}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <h2 className="mb-3 font-semibold">Select Tickets</h2>
          <div className="space-y-3">
            {tiers.length === 0 ? (
              <p className="text-sm text-gray-500">No tickets available.</p>
            ) : (
              tiers.map((tier: any) => {
                const qty = quantities[tier.id] ?? 0
                return (
                  <div
                    key={tier.id}
                    className="flex items-center justify-between rounded border p-3 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{tier.name}</div>
                      {tier.description && (
                        <div className="text-xs text-gray-500">{tier.description}</div>
                      )}
                      <div className="mt-1 text-xs text-gray-500">
                        {tier.priceCents === 0
                          ? 'Free'
                          : `$${(tier.priceCents / 100).toFixed(2)}`}{' '}
                        · {tier.quantityAvailable} available
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 rounded border text-lg dark:border-gray-700"
                        onClick={() => adjust(tier.id, -1)}
                        disabled={qty === 0}
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-mono">{qty}</span>
                      <button
                        type="button"
                        className="h-8 w-8 rounded border text-lg dark:border-gray-700"
                        onClick={() => adjust(tier.id, 1)}
                        disabled={
                          qty >= tier.quantityAvailable || qty >= tier.maxPerUser
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4 dark:border-gray-700">
          <h2 className="mb-3 font-semibold">Promo Code</h2>
          {applied ? (
            <div className="flex items-center justify-between rounded bg-green-50 px-3 py-2 text-sm dark:bg-green-950">
              <div>
                <span className="font-mono font-semibold text-green-700 dark:text-green-300">
                  {applied.code}
                </span>
                <span className="ml-2 text-green-700 dark:text-green-400">
                  applied ·{' '}
                  {applied.discountType === 'percent'
                    ? `${applied.discountValue}% off`
                    : `$${(applied.discountValue / 100).toFixed(2)} off`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemovePromo}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Enter code"
                className="flex-1 rounded border px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={promoApplying || !promoInput.trim()}
                className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
              >
                {promoApplying ? 'Checking...' : 'Apply'}
              </button>
            </div>
          )}
          {promoError && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">{promoError}</p>
          )}
        </div>

        <CheckoutSummary
          lines={lines}
          discountCents={effectiveDiscountCents}
          discountLabel={applied?.code}
        />

        {!isFree && totalTickets > 0 && (
          <div className="rounded-lg border p-4 dark:border-gray-700">
            <h2 className="mb-3 font-semibold">Payment</h2>
            {stripeEnabled ? (
              stripeIntent ? (
                <StripePaymentForm
                  publishableKey={stripeConfig!.publishableKey!}
                  clientSecret={stripeIntent.clientSecret}
                  onReady={onStripeReady}
                />
              ) : (
                <div>
                  <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                    Click below to load the secure payment form.
                  </p>
                  <button
                    type="button"
                    onClick={loadStripePayment}
                    disabled={creatingIntent}
                    className="rounded border px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-gray-700"
                  >
                    {creatingIntent ? 'Loading...' : 'Load payment form'}
                  </button>
                </div>
              )
            ) : (
              <MockPaymentForm values={payment} onChange={setPayment} />
            )}
          </div>
        )}

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            totalTickets === 0 ||
            (!isFree && stripeEnabled && (!stripeIntent || !stripeConfirm))
          }
          className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {submitting
            ? 'Processing...'
            : isFree
              ? 'Claim Free Tickets'
              : `Pay $${(totalCents / 100).toFixed(2)}`}
        </button>
      </form>
    </div>
  )
}

function friendlyError(code: string): string {
  const map: Record<string, string> = {
    SOLD_OUT: 'Sorry, these tickets just sold out.',
    MAX_PER_USER_EXCEEDED: 'You exceeded the maximum tickets per person.',
    SALES_CLOSED: 'Ticket sales have ended.',
    SALES_NOT_STARTED: 'Ticket sales have not started yet.',
    EVENT_STARTED: 'This event has already started.',
    TIER_INACTIVE: 'This tier is no longer available.',
    INVALID_CARD_NUMBER: 'Please enter a valid 16-digit card number.',
    INVALID_EXPIRY: 'Please enter a valid expiry (MM/YY).',
    INVALID_CVC: 'Please enter a valid 3-digit CVC.',
    INVALID_CARDHOLDER_NAME: 'Please enter the cardholder name.',
    PAYMENT_REQUIRED: 'Payment details are required.',
    PROMO_INVALID: 'Invalid promo code.',
    PROMO_INACTIVE: 'This promo code is not active.',
    PROMO_EXPIRED: 'This promo code has expired.',
    PROMO_EXHAUSTED: 'This promo code has reached its usage limit.',
    STRIPE_NOT_CONFIGURED: 'Payment provider unavailable. Try again later.',
    PAYMENT_INTENT_REQUIRED: 'Please complete payment before submitting.',
    PAYMENT_NOT_SUCCEEDED: 'Payment was not completed. Please try again.',
    PAYMENT_AMOUNT_MISMATCH: 'Cart changed — please reload payment.',
    PAYMENT_USER_MISMATCH: 'Session mismatch. Please reload the page.',
    FREE_ORDER_NO_PAYMENT_NEEDED: 'This order is free — no payment required.',
  }
  return map[code] || code
}
