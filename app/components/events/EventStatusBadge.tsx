type EventStatus = 'draft' | 'published' | 'cancelled' | 'archived'

const STATUS_STYLES: Record<EventStatus, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-300', label: 'Draft' },
  published: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-300', label: 'Published' },
  cancelled: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-300', label: 'Cancelled' },
  archived: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Archived' },
}

export function EventStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as EventStatus] ?? STATUS_STYLES.draft
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}
