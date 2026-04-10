import { useEffect, useState } from 'react'
import {
  getEventReviews,
  getEventRatingSummary,
  canReviewEvent,
  submitEventReview,
} from '~/server/fns/reviews'
import { StarRating } from './StarRating'

interface EventReviewsSectionProps {
  eventId: string
}

export function EventReviewsSection({ eventId }: EventReviewsSectionProps) {
  const [reviews, setReviews] = useState<any[]>([])
  const [summary, setSummary] = useState<{ avgRating: number | null; reviewCount: number }>({
    avgRating: null,
    reviewCount: 0,
  })
  const [eligibility, setEligibility] = useState<{
    canReview: boolean
    reason: string | null
    existingReviewId: string | null
  }>({ canReview: false, reason: null, existingReviewId: null })

  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const [r, s, e] = await Promise.all([
      getEventReviews({ data: { eventId } }),
      getEventRatingSummary({ data: { eventId } }),
      canReviewEvent({ data: { eventId } }),
    ])
    setReviews(r.reviews)
    setSummary(s)
    setEligibility(e)
  }

  useEffect(() => {
    refresh().catch(console.error)
  }, [eventId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (rating < 1 || rating > 5) {
      setError('Please select a rating')
      return
    }
    setSubmitting(true)
    try {
      await submitEventReview({ data: { eventId, rating, comment: comment.trim() || undefined } })
      setShowForm(false)
      setRating(0)
      setComment('')
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mt-10 border-t pt-8 dark:border-gray-700">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold">Attendee Reviews</h2>
          <div className="mt-2 flex items-center gap-3">
            <StarRating rating={summary.avgRating ?? 0} size="md" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {summary.avgRating !== null ? (
                <>
                  <span className="font-semibold">{summary.avgRating.toFixed(1)}</span>
                  {' '}
                  ({summary.reviewCount} {summary.reviewCount === 1 ? 'review' : 'reviews'})
                </>
              ) : (
                'No reviews yet'
              )}
            </span>
          </div>
        </div>

        {eligibility.canReview && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Write a review
          </button>
        )}
      </div>

      {!eligibility.canReview && eligibility.reason === 'NO_CHECKED_IN_TICKET' && (
        <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Only attendees who have been checked in at this event can leave a review.
        </p>
      )}

      {!eligibility.canReview && eligibility.reason === 'ALREADY_REVIEWED' && (
        <p className="mt-4 rounded-lg border border-dashed px-4 py-3 text-sm text-indigo-600 dark:border-indigo-800 dark:text-indigo-400">
          You've already reviewed this event. Thanks for sharing your experience!
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-xl border bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
        >
          <div>
            <label className="mb-1 block text-sm font-medium">Your rating</label>
            <StarRating rating={rating} interactive onChange={setRating} size="lg" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="How was the event?"
              className="w-full rounded border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false)
                setError(null)
              }}
              className="rounded border px-4 py-2 text-sm dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit review'}
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {reviews.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Be the first to share your experience.</p>
        ) : (
          reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {r.user.image ? (
                    <img src={r.user.image} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-700" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">{r.user.name}</p>
                    <StarRating rating={r.rating} size="sm" />
                  </div>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </div>
              {r.comment && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {r.comment}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
