import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { Header } from '~/components/layout/Header'
import { Footer } from '~/components/layout/Footer'
import { EventCard } from '~/components/events/EventCard'
import { EventFilters, type FilterState } from '~/components/events/EventFilters'
import { getNavLinks } from '~/server/fns/navigation'
import { listPublicEvents } from '~/server/fns/events'

export const Route = createFileRoute('/events/')({
  loader: async () => {
    try {
      const [headerLinks, footerLinks] = await Promise.all([
        getNavLinks({ data: { position: 'header' } }),
        getNavLinks({ data: { position: 'footer' } }),
      ])
      return { headerLinks, footerLinks }
    } catch {
      return { headerLinks: [], footerLinks: [] }
    }
  },
  component: EventsPage,
})

function EventsPage() {
  const { headerLinks, footerLinks } = Route.useLoaderData()
  const [events, setEvents] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const limit = 12
  const [filters, setFilters] = useState<FilterState>({
    search: '', categoryId: '', startAfter: '', startBefore: '', priceFilter: '', tagIds: [],
  })

  async function fetchEvents() {
    const result = await listPublicEvents({
      data: {
        categoryId: filters.categoryId || undefined,
        startAfter: filters.startAfter || undefined,
        startBefore: filters.startBefore || undefined,
        priceFilter: (filters.priceFilter as any) || undefined,
        search: filters.search || undefined,
        tagIds: filters.tagIds.length > 0 ? filters.tagIds : undefined,
        offset,
        limit,
      },
    })
    setEvents(result.events)
    setTotal(result.total)
  }

  useEffect(() => { fetchEvents() }, [filters, offset])

  function handleFilterChange(newFilters: FilterState) {
    setFilters(newFilters)
    setOffset(0)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header links={headerLinks} />

      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold">All Events</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">Browse upcoming festivals, concerts, and events</p>

        <div className="mt-8 flex gap-8">
          <EventFilters filters={filters} onChange={handleFilterChange} />

          <div className="flex-1">
            {events.length > 0 ? (
              <>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {events.map((event: any) => (
                    <EventCard
                      key={event.id}
                      id={event.id}
                      title={event.title}
                      bannerImage={event.bannerImage}
                      startDate={event.startDate}
                      city={event.city}
                      country={event.country}
                      price={event.price}
                      category={event.category}
                    />
                  ))}
                </div>
                {total > offset + limit && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setOffset(offset + limit)}
                      className="rounded-lg bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700"
                    >
                      Load More
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400">No events found matching your filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer links={footerLinks} />
    </div>
  )
}
