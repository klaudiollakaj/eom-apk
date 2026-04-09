import { ReviewCard } from './ReviewCard'

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewer: { name: string; image?: string | null }
  event: { title: string }
  isVisible?: boolean
  reportedAt?: string | null
}

interface ReviewsListProps {
  reviews: Review[]
  isOwner?: boolean
  total?: number
  onLoadMore?: () => void
  hasMore?: boolean
}

export function ReviewsList({ reviews, isOwner, total, onLoadMore, hasMore }: ReviewsListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet</p>
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard
          key={r.id}
          id={r.id}
          rating={r.rating}
          comment={r.comment}
          createdAt={r.createdAt}
          reviewer={r.reviewer}
          event={r.event}
          isOwner={isOwner}
          isVisible={r.isVisible}
          reportedAt={r.reportedAt}
        />
      ))}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="w-full rounded border py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Load more reviews
        </button>
      )}
    </div>
  )
}
