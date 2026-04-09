import { useState } from 'react'
import { StarRating } from './StarRating'
import { reportReview } from '~/server/fns/reviews'

interface ReviewCardProps {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewer: { name: string; image?: string | null }
  event: { title: string }
  isOwner?: boolean
  isVisible?: boolean
  reportedAt?: string | null
}

export function ReviewCard({ id, rating, comment, createdAt, reviewer, event, isOwner, isVisible, reportedAt }: ReviewCardProps) {
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reported, setReported] = useState(!!reportedAt)

  async function handleReport() {
    if (!reportReason.trim()) return
    await reportReview({ data: { reviewId: id, reason: reportReason } })
    setReported(true)
    setShowReportForm(false)
  }

  const isHidden = isVisible === false

  return (
    <div className={`rounded-lg border p-4 dark:border-gray-700 ${
      isHidden ? 'opacity-50' : ''
    } ${reported && !isHidden ? 'border-amber-300 dark:border-amber-700' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StarRating rating={rating} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(createdAt).toLocaleDateString()}
            </span>
          </div>
          {comment ? (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{comment}</p>
          ) : (
            <p className="mt-2 text-sm italic text-gray-400 dark:text-gray-500">No comment</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {reviewer.name} · {event.title}
          </p>
          {isHidden && (
            <span className="mt-1 inline-block text-xs text-red-500">Hidden by admin</span>
          )}
        </div>

        {isOwner && !reported && !isHidden && (
          <button
            onClick={() => setShowReportForm(true)}
            className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950"
          >
            Report
          </button>
        )}
        {isOwner && reported && (
          <span className="shrink-0 rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            Reported
          </span>
        )}
      </div>

      {showReportForm && (
        <div className="mt-3 space-y-2 border-t pt-3 dark:border-gray-700">
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Why are you reporting this review?"
            className="w-full rounded border p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleReport}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
            >
              Submit Report
            </button>
            <button
              onClick={() => setShowReportForm(false)}
              className="rounded border px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
