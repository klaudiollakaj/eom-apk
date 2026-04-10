import { createFileRoute, redirect } from '@tanstack/react-router'
import { getSession } from '~/server/fns/auth-helpers'
import { getMyTickets } from '~/server/fns/tickets'
import { TicketCard } from '~/components/tickets/TicketCard'
import { RoleHeader } from '~/components/layout/RoleHeader'

export const Route = createFileRoute('/tickets/')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  loader: async () => {
    const data = await getMyTickets()
    return data
  },
  component: MyTicketsPage,
})

function MyTicketsPage() {
  const { upcoming, past } = Route.useLoaderData()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <RoleHeader />
      <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">My Tickets</h1>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed p-10 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            No tickets yet — browse events to get started.
          </p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-lg font-semibold">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((t: any) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-semibold text-gray-500">Past</h2>
              <div className="space-y-3 opacity-70">
                {past.map((t: any) => (
                  <TicketCard key={t.id} ticket={t} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
      </div>
    </div>
  )
}
