import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/events/$eventId')({
  component: EventDetailPage,
})

function EventDetailPage() {
  const { eventId } = Route.useParams()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-indigo-600">
            EOM
          </Link>
          <Link
            to="/login"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
          >
            Login
          </Link>
        </div>
      </nav>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {/* Event Banner */}
        <div className="h-64 rounded-xl bg-gray-200" />

        <h1 className="mt-6 text-3xl font-bold">Event #{eventId}</h1>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">Date: TBD</span>
          <span className="flex items-center gap-1">Location: TBD</span>
          <span className="flex items-center gap-1">Category: TBD</span>
        </div>

        <p className="mt-6 text-gray-700">
          Event description will appear here. Includes banner, details, date,
          location with map integration, and Pay-Per-View links when available.
        </p>

        {/* Map Placeholder */}
        <div className="mt-6 h-48 rounded-lg bg-gray-200 flex items-center justify-center text-gray-400">
          Google Maps Integration
        </div>

        {/* Buy Ticket CTA */}
        <div className="mt-8">
          <Link
            to="/login"
            className="rounded-lg bg-indigo-600 px-8 py-3 text-lg font-semibold text-white hover:bg-indigo-700"
          >
            Buy Tickets — Login Required
          </Link>
        </div>
      </div>
    </div>
  )
}
