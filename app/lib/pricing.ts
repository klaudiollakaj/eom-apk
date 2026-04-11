/**
 * Cart pricing — shared between server (purchaseTickets, payment intent)
 * and client (checkout summary, Stripe button state).
 *
 * Discount semantics:
 * - 'percent' codes: applied to subtotal as a single percentage.
 * - 'fixed' codes: applied **per ticket**, capped at the ticket's own price
 *   so a $5 code never makes a $3 ticket cost negative.
 */

export interface PricingLine {
  priceCents: number
  quantity: number
}

export interface PromoForPricing {
  discountType: 'percent' | 'fixed' | string
  discountValue: number
}

export function computeSubtotalCents(lines: PricingLine[]): number {
  let s = 0
  for (const l of lines) s += l.priceCents * l.quantity
  return s
}

export function computeDiscountCents(
  lines: PricingLine[],
  promo: PromoForPricing | null | undefined,
): number {
  if (!promo) return 0
  const subtotal = computeSubtotalCents(lines)
  if (subtotal === 0) return 0

  if (promo.discountType === 'percent') {
    const d = Math.floor((subtotal * promo.discountValue) / 100)
    return Math.min(d, subtotal)
  }
  if (promo.discountType === 'fixed') {
    let total = 0
    for (const l of lines) {
      const perTicket = Math.min(promo.discountValue, l.priceCents)
      total += perTicket * l.quantity
    }
    return Math.min(total, subtotal)
  }
  return 0
}

export interface CartPricing {
  subtotalCents: number
  discountCents: number
  totalCents: number
}

export function computeCartPricing(
  lines: PricingLine[],
  promo: PromoForPricing | null | undefined,
): CartPricing {
  const subtotalCents = computeSubtotalCents(lines)
  const discountCents = computeDiscountCents(lines, promo)
  return {
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  }
}

/**
 * Per-ticket paid amount given the order's promo and the ticket's tier price.
 * Used on the ticket detail page to show what was actually paid.
 */
export function computeTicketPaidCents(
  tierPriceCents: number,
  promo: PromoForPricing | null | undefined,
): number {
  if (!promo) return tierPriceCents
  if (promo.discountType === 'percent') {
    return Math.max(
      0,
      Math.round(tierPriceCents * (1 - promo.discountValue / 100)),
    )
  }
  if (promo.discountType === 'fixed') {
    return Math.max(0, tierPriceCents - promo.discountValue)
  }
  return tierPriceCents
}
