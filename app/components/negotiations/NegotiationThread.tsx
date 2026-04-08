// app/components/negotiations/NegotiationThread.tsx
interface Round {
  id: string
  senderId: string
  action: string
  price: string | null
  message: string | null
  roundNumber: number
  createdAt: string
  sender?: { name: string; image: string | null }
}

interface NegotiationThreadProps {
  rounds: Round[]
  currentUserId: string
}

const ACTION_LABELS: Record<string, string> = {
  offer: 'Offer',
  counter: 'Counteroffer',
  accept: 'Accepted',
  reject: 'Rejected',
  cancel: 'Cancelled',
}

const ACTION_COLORS: Record<string, string> = {
  offer: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  counter: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20',
  accept: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
  reject: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
  cancel: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
}

export function NegotiationThread({ rounds, currentUserId }: NegotiationThreadProps) {
  return (
    <div className="space-y-4">
      {rounds.map((round) => {
        const isMe = round.senderId === currentUserId
        const colorClass = ACTION_COLORS[round.action] ?? ACTION_COLORS.offer
        const date = new Date(round.createdAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })

        return (
          <div
            key={round.id}
            className={`rounded-lg border p-4 ${colorClass} ${isMe ? 'ml-8' : 'mr-8'}`}
          >
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium">
                {isMe ? 'You' : round.sender?.name ?? 'Other party'} — {ACTION_LABELS[round.action] ?? round.action}
              </span>
              <span>{date}</span>
            </div>
            {round.price && (
              <p className="mt-2 text-lg font-bold">{"\u20AC"}{Number(round.price).toFixed(2)}</p>
            )}
            {round.message && (
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{round.message}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
