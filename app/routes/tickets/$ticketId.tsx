import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getSession } from '~/server/fns/auth-helpers'
import { getTicket } from '~/server/fns/tickets'
import { QrCodeDisplay } from '~/components/tickets/QrCodeDisplay'
import { TransferModal } from '~/components/tickets/TransferModal'
import { RefundModal } from '~/components/tickets/RefundModal'
import { RoleHeader } from '~/components/layout/RoleHeader'
import { useSession } from '~/lib/auth-client'
import { generateTicketPdf } from '~/lib/ticket-pdf'

export const Route = createFileRoute('/tickets/$ticketId')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  loader: async ({ params }) => {
    const ticket = await getTicket({ data: { ticketId: params.ticketId } })
    return { ticket }
  },
  component: TicketDetailPage,
})

function TicketDetailPage() {
  const { ticket } = Route.useLoaderData()
  const router = useRouter()
  const session = useSession()
  const [showTransfer, setShowTransfer] = useState(false)
  const [showRefund, setShowRefund] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      await generateTicketPdf({
        ticketId: ticket.id,
        qrCode: ticket.qrCode,
        eventTitle: ticket.event.title,
        startDate: ticket.event.startDate,
        startTime: ticket.event.startTime,
        venueName: ticket.event.venueName,
        city: ticket.event.city,
        country: ticket.event.country,
        tierName: ticket.tier.name,
        priceCents: ticket.tier.priceCents,
        attendeeName: session.data?.user?.name ?? 'Attendee',
        orderNumber: ticket.order?.orderNumber ?? null,
      })
    } catch (err) {
      console.error('Failed to generate PDF:', err)
      alert('Failed to generate ticket PDF.')
    } finally {
      setDownloading(false)
    }
  }

  const startDate = new Date(ticket.event.startDate)
  const eventStarted = startDate.getTime() <= Date.now()
  const canTransfer = ticket.status === 'valid' && !eventStarted
  const canRefund = ticket.status === 'valid' && !eventStarted

  function refresh() {
    setShowTransfer(false)
    setShowRefund(false)
    router.invalidate()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <RoleHeader />
      <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        to="/tickets"
        className="text-sm text-indigo-600 hover:underline dark:text-indigo-400"
      >
        ← My Tickets
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border dark:border-gray-700">
        {ticket.event.bannerImage && (
          <div className="h-40 bg-gray-200 dark:bg-gray-700">
            <img
              src={ticket.event.bannerImage}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-6">
          <h1 className="text-2xl font-bold">{ticket.event.title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {startDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
            {ticket.event.startTime && ` · ${ticket.event.startTime}`}
          </p>
          <p className="mt-2 text-sm">
            <span className="font-medium">{ticket.tier.name}</span>
            {ticket.tier.priceCents > 0 && (
              <span className="text-gray-500">
                {' '}
                · ${(ticket.tier.priceCents / 100).toFixed(2)}
              </span>
            )}
          </p>

          <div className="mt-6 flex flex-col items-center">
            {ticket.status === 'valid' ? (
              <>
                <QrCodeDisplay value={ticket.qrCode} />
                {eventStarted && (
                  <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
                    Present this at entry
                  </p>
                )}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  {downloading ? 'Generating...' : 'Download PDF'}
                </button>
              </>
            ) : ticket.status === 'checked_in' ? (
              <div className="rounded-lg border-2 border-green-600 bg-green-50 p-6 text-center dark:bg-green-950">
                <div className="text-lg font-bold text-green-700 dark:text-green-300">
                  Checked In
                </div>
                {ticket.checkedInAt && (
                  <p className="mt-1 text-sm text-green-600 dark:text-green-400">
                    {new Date(ticket.checkedInAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : ticket.status === 'refunded' ? (
              <div className="rounded-lg border-2 border-red-600 bg-red-50 p-6 text-center dark:bg-red-950">
                <div className="text-lg font-bold text-red-700 dark:text-red-300">
                  Refunded
                </div>
              </div>
            ) : (
              <div className="rounded-lg border p-6 text-center dark:border-gray-700">
                <div className="text-lg font-bold text-gray-500">
                  {ticket.status}
                </div>
              </div>
            )}
          </div>

          {(canTransfer || canRefund) && (
            <div className="mt-6 flex gap-3">
              {canTransfer && (
                <button
                  onClick={() => setShowTransfer(true)}
                  className="flex-1 rounded border px-4 py-2 text-sm font-semibold dark:border-gray-700"
                >
                  Transfer
                </button>
              )}
              {canRefund && (
                <button
                  onClick={() => setShowRefund(true)}
                  className="flex-1 rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 dark:border-red-700 dark:text-red-400"
                >
                  Refund
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showTransfer && (
        <TransferModal
          ticketId={ticket.id}
          onClose={() => setShowTransfer(false)}
          onSuccess={refresh}
        />
      )}
      {showRefund && (
        <RefundModal
          ticketId={ticket.id}
          amountCents={ticket.tier.priceCents}
          onClose={() => setShowRefund(false)}
          onSuccess={refresh}
        />
      )}
      </div>
    </div>
  )
}
