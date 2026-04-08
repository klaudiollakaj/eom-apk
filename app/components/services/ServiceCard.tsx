// app/components/services/ServiceCard.tsx
import { Link } from '@tanstack/react-router'

interface ServiceCardProps {
  id: string
  title: string
  bannerImage: string | null
  city?: string | null
  country?: string | null
  category?: { name: string } | null
  packages?: { price: string | null; priceIsPublic: boolean }[]
  provider?: { name: string; image: string | null } | null
}

export function ServiceCard({ id, title, bannerImage, city, country, category, packages, provider }: ServiceCardProps) {
  const location = [city, country].filter(Boolean).join(', ')

  // Find the lowest public price
  const publicPrices = (packages ?? [])
    .filter((p) => p.priceIsPublic && p.price !== null)
    .map((p) => Number(p.price))
  const startingPrice = publicPrices.length > 0 ? Math.min(...publicPrices) : null

  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: id }}
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
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{title}</h3>
        {location && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{location}</p>}
        {provider && <p className="mt-1 text-xs text-gray-400">by {provider.name}</p>}
        <p className="mt-2 text-sm font-medium">
          {startingPrice !== null ? `From \u20AC${startingPrice.toFixed(2)}` : 'Get a Quote'}
        </p>
      </div>
    </Link>
  )
}
