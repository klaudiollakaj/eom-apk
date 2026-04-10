import { Link } from '@tanstack/react-router'

interface EventCardProps {
  id: string
  title: string
  bannerImage: string | null
  startDate: string
  city?: string | null
  country?: string | null
  price?: string | null
  category?: { name: string } | null
  isFeatured?: boolean
  isTrending?: boolean
}

export function EventCard({
  id, title, bannerImage, startDate, city, country, price, category, isFeatured, isTrending,
}: EventCardProps) {
  const date = new Date(startDate)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const location = [city, country].filter(Boolean).join(', ')

  const daysUntil = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const startingSoon = daysUntil >= 0 && daysUntil <= 7

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: id }}
      className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
        {bannerImage ? (
          <img src={bannerImage} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No Image</div>
        )}
        {category && (
          <span className="absolute left-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            {category.name}
          </span>
        )}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {isFeatured && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              ★ Featured
            </span>
          )}
          {isTrending && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              🔥 Trending
            </span>
          )}
          {startingSoon && !isFeatured && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil}d`}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">{dateStr}</p>
        <h3 className="mt-1 text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
          {title}
        </h3>
        {location && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{location}</p>
        )}
        <p className="mt-2 text-sm font-medium">
          {price && Number(price) > 0 ? `$${Number(price).toFixed(2)}` : 'Free'}
        </p>
      </div>
    </Link>
  )
}
