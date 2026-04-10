export interface CheckoutLine {
  tierId: string
  tierName: string
  priceCents: number
  quantity: number
}

export interface CheckoutSummaryProps {
  lines: CheckoutLine[]
  discountCents?: number
  discountLabel?: string
}

export function CheckoutSummary({ lines, discountCents = 0, discountLabel }: CheckoutSummaryProps) {
  const subtotal = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0)
  const total = Math.max(0, subtotal - discountCents)
  const filtered = lines.filter((l) => l.quantity > 0)
  return (
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <h3 className="mb-3 font-semibold">Order Summary</h3>
      <div className="space-y-2 text-sm">
        {filtered.length === 0 ? (
          <p className="text-gray-500">No tickets selected</p>
        ) : (
          filtered.map((l) => (
            <div key={l.tierId} className="flex justify-between">
              <span>
                {l.tierName} × {l.quantity}
              </span>
              <span>${((l.priceCents * l.quantity) / 100).toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
      {discountCents > 0 && (
        <>
          <div className="mt-3 flex justify-between border-t pt-3 text-sm dark:border-gray-700">
            <span>Subtotal</span>
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
            <span>Discount{discountLabel ? ` (${discountLabel})` : ''}</span>
            <span>-${(discountCents / 100).toFixed(2)}</span>
          </div>
        </>
      )}
      <div className="mt-3 flex justify-between border-t pt-3 font-bold dark:border-gray-700">
        <span>Total</span>
        <span>${(total / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}
