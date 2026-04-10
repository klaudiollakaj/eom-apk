import { useEffect, useMemo, useState } from 'react'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'

export interface StripePaymentFormProps {
  publishableKey: string
  clientSecret: string
  onReady: (confirmFn: () => Promise<{ error?: string }>) => void
}

/**
 * Wraps Stripe Elements. Parent passes clientSecret from a created PaymentIntent.
 * Parent calls the confirm function returned via onReady when the user clicks pay.
 */
export function StripePaymentForm({
  publishableKey,
  clientSecret,
  onReady,
}: StripePaymentFormProps) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey])

  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: 'stripe' } }}
    >
      <InnerForm onReady={onReady} />
    </Elements>
  )
}

function InnerForm({
  onReady,
}: {
  onReady: (confirmFn: () => Promise<{ error?: string }>) => void
}) {
  const stripe = useStripe()
  const elements = useElements()

  useEffect(() => {
    if (!stripe || !elements) return
    onReady(async () => {
      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      })
      if (error) return { error: error.message || 'Payment failed' }
      return {}
    })
  }, [stripe, elements, onReady])

  return (
    <div>
      <PaymentElement />
    </div>
  )
}
