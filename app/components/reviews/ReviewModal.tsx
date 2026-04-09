import { useState } from 'react'
import { StarRating } from './StarRating'
import { submitReview } from '~/server/fns/reviews'

interface ReviewModalProps {
  eventServiceId: string
  providerName: string
  eventTitle: string
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewModal({ eventServiceId, providerName, eventTitle, onClose, onSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitReview({ data: { eventServiceId, rating, comment: comment.trim() || undefined } })
      onSubmitted()
    } catch (e: any) {
      setError(e.message || 'Failed to submit review')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-xl border bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">Leave a Review</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          How was your experience with <span className="font-medium text-indigo-600 dark:text-indigo-400">{providerName}</span>?
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">For: {eventTitle}</p>

        <div className="mt-4 text-center">
          <StarRating rating={rating} interactive onChange={setRating} size="lg" />
          {rating > 0 && (
            <p className="mt-1 text-xs text-gray-500">{rating} out of 5</p>
          )}
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience working with this provider..."
            className="mt-1 w-full rounded-lg border p-3 text-sm dark:border-gray-600 dark:bg-gray-700"
            rows={3}
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
