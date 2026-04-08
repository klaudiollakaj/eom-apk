// app/components/negotiations/NegotiationStatusBadge.tsx
type NegotiationStatus = 'requested' | 'offered' | 'countered' | 'accepted' | 'rejected' | 'cancelled' | 'expired'

const STATUS_STYLES: Record<NegotiationStatus, { bg: string; text: string; label: string }> = {
  requested: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-300', label: 'Quote Requested' },
  offered: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-300', label: 'Offer Pending' },
  countered: { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-300', label: 'Counteroffer' },
  accepted: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-300', label: 'Accepted' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-300', label: 'Rejected' },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Cancelled' },
  expired: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Expired' },
}

export function NegotiationStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as NegotiationStatus] ?? STATUS_STYLES.requested
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}
