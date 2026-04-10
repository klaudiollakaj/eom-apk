import { createFileRoute, Link } from '@tanstack/react-router'
import { Header } from '~/components/layout/Header'
import { Footer } from '~/components/layout/Footer'
import { EventCard } from '~/components/events/EventCard'
import { getNavLinks } from '~/server/fns/navigation'
import {
  getFeaturedEvents, getLatestEvents, getStartingSoonEvents, getTrendingEventIds,
} from '~/server/fns/events'

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const [headerLinks, footerLinks, featured, latest, startingSoon, trendingIds] = await Promise.all([
        getNavLinks({ data: { position: 'header' } }),
        getNavLinks({ data: { position: 'footer' } }),
        getFeaturedEvents(),
        getLatestEvents(),
        getStartingSoonEvents(),
        getTrendingEventIds({ data: { limit: 10 } }),
      ])
      return { headerLinks, footerLinks, featured, latest, startingSoon, trendingIds }
    } catch {
      return { headerLinks: [], footerLinks: [], featured: [], latest: [], startingSoon: [], trendingIds: [] }
    }
  },
  component: Home,
})

function Home() {
  const { headerLinks, footerLinks, featured, latest, startingSoon, trendingIds } = Route.useLoaderData()
  const trendingSet = new Set(trendingIds)

  return (
    <div className="min-h-screen">
      <Header links={headerLinks} />

      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 px-6 py-24 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold">Event Of Mine</h1>
          <p className="mt-4 text-xl text-indigo-100">
            Discover, organize, and attend events. From ticket purchase to hotel
            reservations — everything in one platform.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/events" className="rounded-lg bg-white px-6 py-3 font-semibold text-indigo-600 hover:bg-indigo-50">Browse Events</Link>
            <Link to="/register" className="rounded-lg border-2 border-white px-6 py-3 font-semibold text-white hover:bg-white/10">Get Started</Link>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="px-6 py-16">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-3xl font-bold">Featured Events</h2>
            <p className="mt-2 text-center text-gray-600 dark:text-gray-400">Hand-picked events you don't want to miss</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((event: any) => (
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
                  isFeatured
                  isTrending={trendingSet.has(event.id)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {startingSoon.length > 0 && (
        <section className="bg-gradient-to-b from-transparent to-gray-100 px-6 py-16 dark:to-gray-800/50">
          <div className="mx-auto max-w-7xl">
            <h2 className="text-center text-3xl font-bold">Starting Soon</h2>
            <p className="mt-2 text-center text-gray-600 dark:text-gray-400">
              Don't miss these events happening in the next 7 days
            </p>
            <div className="mt-10 flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
              {startingSoon.map((event: any) => (
                <div key={event.id} className="w-72 shrink-0 snap-start">
                  <EventCard
                    id={event.id}
                    title={event.title}
                    bannerImage={event.bannerImage}
                    startDate={event.startDate}
                    city={event.city}
                    country={event.country}
                    price={event.price}
                    category={event.category}
                    isTrending={trendingSet.has(event.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-center text-3xl font-bold">
            {featured.length > 0 ? 'Latest Events' : 'Upcoming Events'}
          </h2>
          <p className="mt-2 text-center text-gray-600 dark:text-gray-400">Check out the latest events happening near you</p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {latest.length > 0 ? (
              latest.map((event: any) => (
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
                  isTrending={trendingSet.has(event.id)}
                />
              ))
            ) : (
              <div className="col-span-3 rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="h-40 rounded-lg bg-gray-200 dark:bg-gray-700" />
                <h3 className="mt-4 text-lg font-semibold">Coming Soon</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Events will appear here once organizers publish them.</p>
              </div>
            )}
          </div>
          <div className="mt-8 text-center">
            <Link to="/events" className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">View All Events &rarr;</Link>
          </div>
        </div>
      </section>

      <section className="bg-gray-100 px-6 py-16 dark:bg-gray-800">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold">Stay Updated</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Subscribe to get notified about new events and news</p>
          <form className="mt-6 flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input type="email" placeholder="Your email address" className="flex-1 rounded-lg border px-4 py-2 focus:border-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400" />
            <button type="submit" className="rounded-lg bg-indigo-600 px-6 py-2 text-white hover:bg-indigo-700">Subscribe</button>
          </form>
        </div>
      </section>

      <Footer links={footerLinks} />
    </div>
  )
}
