import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/events/')({
  component: EventsPage,
})

function EventsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-indigo-600">
            EOM
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/events" className="font-medium text-indigo-600">
              Events
            </Link>
            <Link to="/posts" className="text-gray-700 hover:text-indigo-600">
              News
            </Link>
            <Link
              to="/login"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <h1 className="text-3xl font-bold">All Events</h1>
        <p className="mt-2 text-gray-600">
          Browse upcoming festivals, concerts, and events
        </p>

        {/* Filters */}
        <div className="mt-6 flex gap-3">
          <button className="rounded-full bg-indigo-600 px-4 py-1.5 text-sm text-white">
            All
          </button>
          <button className="rounded-full bg-white px-4 py-1.5 text-sm text-gray-700 border hover:bg-gray-50">
            Available
          </button>
          <button className="rounded-full bg-white px-4 py-1.5 text-sm text-gray-700 border hover:bg-gray-50">
            Coming Soon
          </button>
          <button className="rounded-full bg-white px-4 py-1.5 text-sm text-gray-700 border hover:bg-gray-50">
            Sold Out
          </button>
        </div>

        {/* Events Grid */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="relative h-48 bg-gray-200">
              <span className="absolute left-3 top-3 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                Available
              </span>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold">Sample Event</h3>
              <p className="mt-1 text-sm text-gray-500">
                Events will be listed here once published by organizers.
              </p>
              <Link
                to="/login"
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
              >
                Buy Tickets
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
