import Stripe from 'stripe'

let cached: Stripe | null = null

export function getStripe(): Stripe | null {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  cached = new Stripe(key, { apiVersion: '2026-03-25.dahlia' })
  return cached
}

export function isStripeEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function getStripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY || null
}
