import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '~/components/layout/Header'
import { Footer } from '~/components/layout/Footer'
import { getNavLinks } from '~/server/fns/navigation'
import { getEvent } from '~/server/fns/events'

export const Route = createFileRoute('/events/$eventId')({
  loader: async ({ params }) => {
    try {
      const [headerLinks, footerLinks, event] = await Promise.all([
        getNavLinks({ data: { position: 'header' } }),
        getNavLinks({ data: { position: 'footer' } }),
        getEvent({ data: { eventId: params.eventId } }),
      ])
      return { headerLinks, footerLinks, event }
    } catch {
      return { headerLinks: [], footerLinks: [], event: null }
    }
  },
  component: EventDetailPage,
})

function EventDetailPage() {
  const { headerLinks, footerLinks, event } = Route.useLoaderData()

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header links={headerLinks} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Event Not Found</h1>
            <p className="mt-2 text-gray-500">This event doesn't exist or is no longer available.</p>
            <Link to="/events" className="mt-4 inline-block text-indigo-600 hover:underline">Back to Events</Link>
          </div>
        </div>
        <Footer links={footerLinks} />
      </div>
    )
  }

  const startDate = new Date(event.startDate)
  const dateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const location = [event.venueName, event.city, event.country].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header links={headerLinks} />

      <div className="relative h-72 bg-gray-200 dark:bg-gray-700 md:h-96">
        {event.bannerImage ? (
          <img src={event.bannerImage} alt={event.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No Banner Image</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
          <div className="mx-auto max-w-7xl">
            {event.category && (
              <span className="mb-2 inline-block rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">{event.category.name}</span>
            )}
            <h1 className="text-3xl font-bold text-white md:text-4xl">{event.title}</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="flex-1">
            <div className="prose prose-lg max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: event.description }} />

            {event.tags && event.tags.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {event.tags.map((et: any) => (
                  <span key={et.tag.id} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    {et.tag.name}
                  </span>
                ))}
              </div>
            )}

            {event.images && event.images.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-4 text-xl font-bold">Gallery</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {event.images.map((img: any) => (
                    <div key={img.id} className="overflow-hidden rounded-lg">
                      <img src={img.imageUrl} alt={img.caption || ''} className="h-48 w-full object-cover" />
                      {img.caption && <p className="mt-1 text-sm text-gray-500">{img.caption}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="w-full shrink-0 md:sticky md:top-6 md:w-80 md:self-start">
            <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Date & Time</p>
                  <p className="mt-1 font-medium">{dateStr}</p>
                  {event.startTime && <p className="text-sm text-gray-500">{event.startTime}{event.endTime ? ` – ${event.endTime}` : ''}</p>}
                  {event.endDate && <p className="text-sm text-gray-500">Until {new Date(event.endDate).toLocaleDateString()}</p>}
                </div>

                {location && (
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Location</p>
                    <p className="mt-1 font-medium">{location}</p>
                    {event.address && <p className="text-sm text-gray-500">{event.address}</p>}
                  </div>
                )}

                {event.onlineUrl && (
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Online</p>
                    <a href={event.onlineUrl} target="_blank" rel="noopener noreferrer" className="mt-1 text-sm text-indigo-600 hover:underline">{event.onlineUrl}</a>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium uppercase text-gray-500">Price</p>
                  <p className="mt-1 text-xl font-bold">
                    {event.price && Number(event.price) > 0 ? `$${Number(event.price).toFixed(2)}` : 'Free'}
                  </p>
                </div>

                {event.capacity && (
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Capacity</p>
                    <p className="mt-1 font-medium">{event.capacity} spots</p>
                  </div>
                )}

                {event.ageRestriction && (
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Age Restriction</p>
                    <p className="mt-1 font-medium">{event.ageRestriction}</p>
                  </div>
                )}

                <button className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700">
                  Buy Tickets
                </button>

                <div className="border-t pt-4 dark:border-gray-700">
                  <p className="text-xs font-medium uppercase text-gray-500">Organized by</p>
                  <div className="mt-2 flex items-center gap-2">
                    {event.organizer?.image && <img src={event.organizer.image} alt="" className="h-8 w-8 rounded-full" />}
                    <span className="font-medium">{event.organizer?.name}</span>
                  </div>
                </div>

                {(event.contactEmail || event.contactPhone) && (
                  <div className="border-t pt-4 dark:border-gray-700">
                    <p className="text-xs font-medium uppercase text-gray-500">Contact</p>
                    {event.contactEmail && <p className="mt-1 text-sm">{event.contactEmail}</p>}
                    {event.contactPhone && <p className="text-sm">{event.contactPhone}</p>}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Footer links={footerLinks} />
    </div>
  )
}
