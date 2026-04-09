import { StarRating } from './StarRating'

interface RatingSummaryProps {
  avgRating: number | null
  reviewCount: number
  distribution?: Record<number, number>
}

export function RatingSummary({ avgRating, reviewCount, distribution }: RatingSummaryProps) {
  if (reviewCount === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet</p>
    )
  }

  const displayRating = avgRating ? Math.round(avgRating * 10) / 10 : 0

  return (
    <div className="flex items-start gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold">{displayRating}</div>
        <StarRating rating={displayRating} size="sm" />
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</div>
      </div>

      {distribution && (
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] ?? 0
            const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-xs text-gray-500 dark:text-gray-400">{star}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
