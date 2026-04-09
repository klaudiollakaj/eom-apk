import { useState } from 'react'

interface StarRatingProps {
  rating: number
  interactive?: boolean
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
}

export function StarRating({ rating, interactive = false, onChange, size = 'md' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0)

  const displayRating = interactive && hoverRating > 0 ? hoverRating : rating

  return (
    <div className={`inline-flex gap-0.5 ${SIZES[size]}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayRating >= star
        const half = !filled && displayRating >= star - 0.5

        return (
          <span
            key={star}
            className={`${interactive ? 'cursor-pointer' : ''} ${
              filled ? 'text-amber-400' : half ? 'text-amber-300' : 'text-gray-300 dark:text-gray-600'
            }`}
            onClick={interactive && onChange ? () => onChange(star) : undefined}
            onMouseEnter={interactive ? () => setHoverRating(star) : undefined}
            onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
          >
            ★
          </span>
        )
      })}
    </div>
  )
}
