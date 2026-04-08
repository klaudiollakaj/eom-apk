// app/components/services/PackageCard.tsx
interface PackageCardProps {
  name: string
  description: string | null
  price: string | null
  priceIsPublic: boolean
  onRequestQuote?: () => void
  onSendOffer?: () => void
}

export function PackageCard({ name, description, price, priceIsPublic, onRequestQuote, onSendOffer }: PackageCardProps) {
  const showPrice = priceIsPublic && price !== null

  return (
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{name}</h4>
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        <div className="text-right">
          {showPrice ? (
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{"\u20AC"}{Number(price).toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-500">Price on request</p>
          )}
        </div>
      </div>
      <div className="mt-3">
        {showPrice && onSendOffer ? (
          <button
            onClick={onSendOffer}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Send Offer
          </button>
        ) : onRequestQuote ? (
          <button
            onClick={onRequestQuote}
            className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Request a Quote
          </button>
        ) : null}
      </div>
    </div>
  )
}
