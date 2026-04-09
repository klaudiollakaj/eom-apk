import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getReportedReviews, moderateReview } from '~/server/fns/reviews'
import { StarRating } from '~/components/reviews/StarRating'

export const Route = createFileRoute('/admin/reviews')({
  component: AdminReviewsPage,
})

function AdminReviewsPage() {
  const [data, setData] = useState<any>({ reviews: [], total: 0 })
  const [loading, setLoading] = useState(true)

  async function fetchReviews() {
    setLoading(true)
    try {
      const result = await getReportedReviews({ data: {} })
      setData(result)
    } catch (err) {
      console.error('Failed to fetch reported reviews:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReviews() }, [])

  async function handleModerate(reviewId: string, action: 'hide' | 'unhide' | 'dismiss') {
    await moderateReview({ data: { reviewId, action } })
    fetchReviews()
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Moderation</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {data.total} reported review{data.total !== 1 ? 's' : ''} pending moderation
      </p>

      {data.reviews.length === 0 ? (
        <div className="rounded-lg border p-8 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No reported reviews. All clear!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((r: any) => (
            <div
              key={r.id}
              className="rounded-lg border border-red-200 bg-red-50/30 p-4 dark:border-red-900 dark:bg-red-950/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} size="sm" />
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
                      Reported
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {r.comment || <em className="text-gray-400">No comment</em>}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    By: {r.reviewer.name} → About: {r.reviewee.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Service: {r.eventService.service.title} · Event: {r.eventService.event.title}
                  </p>
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Report reason: "{r.reportReason}"
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleModerate(r.id, 'dismiss')}
                    className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleModerate(r.id, 'hide')}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                  >
                    Hide Review
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
