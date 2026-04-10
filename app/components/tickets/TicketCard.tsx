import { Link } from '@tanstack/react-router'

export interface TicketCardProps {
  ticket: {
    id: string
    status: string
    tier: { name: string; priceCents: number }
    event: {
      id: string
      title: string
      startDate: Date | string
      images?: Array<{ imageUrl: string }>
      bannerImage?: string | null
    }
  }
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    valid: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    checked_in: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    refunded: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  }
  const labels: Record<string, string> = {
    valid: 'Valid',
    checked_in: 'Checked In',
    refunded: 'Refunded',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] || 'bg-gray-100 text-gray-800'
      }`}
    >
      {labels[status] || status}
    </span>
  )
}

export function TicketCard({ ticket }: TicketCardProps) {
  const img = ticket.event.bannerImage || ticket.event.images?.[0]?.imageUrl
  const date = new Date(ticket.event.startDate)

  return (
    <Link
      to="/tickets/$ticketId"
      params={{ ticketId: ticket.id }}
      className="flex overflow-hidden rounded-lg border hover:shadow-md dark:border-gray-700"
    >
      <div className="h-24 w-24 shrink-0 bg-gray-200 dark:bg-gray-700">
        {img && <img src={img} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold">{ticket.event.title}</h3>
            <p className="text-xs text-gray-500">
              {date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <p className="mt-1 text-sm">{ticket.tier.name}</p>
          </div>
          <StatusBadge status={ticket.status} />
        </div>
      </div>
    </Link>
  )
}
