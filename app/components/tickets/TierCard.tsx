import { Link } from '@tanstack/react-router'

export interface TierCardProps {
  tier: {
    id: string
    name: string
    description?: string | null
    priceCents: number
    quantityAvailable: number
    salesStartAt?: Date | string | null
    salesEndAt?: Date | string | null
  }
  eventId: string
}

export function TierCard({ tier, eventId }: TierCardProps) {
  const now = Date.now()
  const start = tier.salesStartAt ? new Date(tier.salesStartAt).getTime() : null
  const end = tier.salesEndAt ? new Date(tier.salesEndAt).getTime() : null

  const notYet = start && start > now
  const closed = end && end < now
  const soldOut = tier.quantityAvailable <= 0

  let status: { label: string; disabled: boolean } = { label: 'Buy', disabled: false }
  if (soldOut) status = { label: 'Sold Out', disabled: true }
  else if (notYet) status = { label: 'Not Yet On Sale', disabled: true }
  else if (closed) status = { label: 'Sales Ended', disabled: true }

  return (
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold">{tier.name}</h3>
          {tier.description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {tier.description}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {soldOut
              ? 'No tickets available'
              : `${tier.quantityAvailable} available`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">
            {tier.priceCents === 0 ? 'Free' : `$${(tier.priceCents / 100).toFixed(2)}`}
          </div>
        </div>
      </div>
      {status.disabled ? (
        <button
          disabled
          className="mt-3 block w-full cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2 text-center text-sm font-semibold text-gray-500 dark:bg-gray-700 dark:text-gray-400"
        >
          {status.label}
        </button>
      ) : (
        <Link
          to="/events/$eventId/checkout"
          params={{ eventId }}
          search={{ tier: tier.id }}
          className="mt-3 block rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {status.label}
        </Link>
      )}
    </div>
  )
}
