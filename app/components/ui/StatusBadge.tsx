type Status = 'active' | 'inactive' | 'suspended'

const STATUS_STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-300', label: 'Active' },
  inactive: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-300', label: 'Inactive' },
  suspended: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-300', label: 'Suspended' },
}

export function StatusBadge({ status }: { status: Status }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  )
}

export function getUserStatus(user: {
  isActive: boolean
  isSuspended: boolean
}): Status {
  if (!user.isActive) return 'inactive'
  if (user.isSuspended) return 'suspended'
  return 'active'
}
