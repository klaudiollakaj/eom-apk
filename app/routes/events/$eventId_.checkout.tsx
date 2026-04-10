import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { z } from 'zod'
import { getEvent } from '~/server/fns/events'
import { listEventTiers, purchaseTickets } from '~/server/fns/tickets'
import { getSession } from '~/server/fns/auth-helpers'
import { CheckoutSummary } from '~/components/tickets/CheckoutSummary'
import { MockPaymentForm, type MockPaymentValues } from '~/components/tickets/MockPaymentForm'

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
      const [event, tiers] = await Promise.all([
        getEvent({ data: { eventId: params.eventId } }),
        listEventTiers({ data: { eventId: params.eventId } }),
      ])
      if (!event) throw new Error('Event not found')
      return { event, tiers: tiers ?? [] }
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
  const { event, tiers } = Route.useLoaderData()
  const search = Route.useSearch()
  const navigate = useNavigate()

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

  const totalCents = useMemo(
    () => lines.reduce((s, l) => s + l.priceCents * l.quantity, 0),
    [lines],
  )
  const totalTickets = useMemo(
    () => lines.reduce((s, l) => s + l.quantity, 0),
    [lines],
  )
  const isFree = totalCents === 0

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
      // Fake 1s delay to feel like a payment
      await new Promise((r) => setTimeout(r, 1000))
      const result = await purchaseTickets({
        data: {
          eventId: event.id,
          items,
          payment: isFree ? undefined : payment,
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

        <CheckoutSummary lines={lines} />

        {!isFree && totalTickets > 0 && (
          <div className="rounded-lg border p-4 dark:border-gray-700">
            <h2 className="mb-3 font-semibold">Payment</h2>
            <MockPaymentForm values={payment} onChange={setPayment} />
          </div>
        )}

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || totalTickets === 0}
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
  }
  return map[code] || code
}
