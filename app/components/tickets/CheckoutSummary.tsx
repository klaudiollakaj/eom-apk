export interface CheckoutLine {
  tierId: string
  tierName: string
  priceCents: number
  quantity: number
}

export interface CheckoutSummaryProps {
  lines: CheckoutLine[]
}

export function CheckoutSummary({ lines }: CheckoutSummaryProps) {
  const total = lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0)
  return (
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <h3 className="mb-3 font-semibold">Order Summary</h3>
      <div className="space-y-2 text-sm">
        {lines.filter((l) => l.quantity > 0).length === 0 ? (
          <p className="text-gray-500">No tickets selected</p>
        ) : (
          lines
            .filter((l) => l.quantity > 0)
            .map((l) => (
              <div key={l.tierId} className="flex justify-between">
                <span>
                  {l.tierName} × {l.quantity}
                </span>
                <span>${((l.priceCents * l.quantity) / 100).toFixed(2)}</span>
              </div>
            ))
        )}
      </div>
      <div className="mt-3 flex justify-between border-t pt-3 font-bold dark:border-gray-700">
        <span>Total</span>
        <span>${(total / 100).toFixed(2)}</span>
      </div>
    </div>
  )
}
