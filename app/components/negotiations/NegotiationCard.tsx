// app/components/negotiations/NegotiationCard.tsx
import { Link } from '@tanstack/react-router'
import { NegotiationStatusBadge } from './NegotiationStatusBadge'
import { ChatUnreadBadge } from '~/components/chat/ChatUnreadBadge'

interface NegotiationCardProps {
  id: string
  status: string
  event: { id: string; title: string }
  service: { id: string; title: string }
  otherParty: { name: string; image: string | null }
  lastPrice: string | null
  updatedAt: string
  linkPrefix: string
  unreadCount?: number
}

export function NegotiationCard({
  id, status, event, service, otherParty, lastPrice, updatedAt, linkPrefix, unreadCount,
}: NegotiationCardProps) {
  const timeAgo = new Date(updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Link
      to={`${linkPrefix}/${id}` as any}
      className="block rounded-lg border p-4 transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{service.title}</h3>
            {unreadCount != null && unreadCount > 0 && <ChatUnreadBadge count={unreadCount} />}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">for {event.title}</p>
          <div className="mt-1 flex items-center gap-2">
            {otherParty.image && (
              <img src={otherParty.image} alt="" className="h-5 w-5 rounded-full" />
            )}
            <span className="text-xs text-gray-400">{otherParty.name}</span>
          </div>
        </div>
        <div className="text-right">
          <NegotiationStatusBadge status={status} />
          {lastPrice && (
            <p className="mt-1 text-sm font-medium">{"\u20AC"}{Number(lastPrice).toFixed(2)}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{timeAgo}</p>
        </div>
      </div>
    </Link>
  )
}
