import type { Role } from '~/lib/permissions'

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  user: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-300' },
  organizer: { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-300' },
  distributor: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-300' },
  sponsor: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-300' },
  negotiator: { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-300' },
  service_provider: { bg: 'bg-sky-100 dark:bg-sky-900', text: 'text-sky-800 dark:text-sky-300' },
  marketing_agency: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-300' },
  staff: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-300' },
  admin: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-300' },
  superadmin: { bg: 'bg-red-200 dark:bg-red-900', text: 'text-red-900 dark:text-red-300' },
}

const ROLE_LABELS: Record<Role, string> = {
  user: 'User',
  organizer: 'Organizer',
  distributor: 'Distributor',
  sponsor: 'Sponsor',
  negotiator: 'Negotiator',
  service_provider: 'Service Provider',
  marketing_agency: 'Marketing Agency',
  staff: 'Staff',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

export function RoleBadge({ role }: { role: Role }) {
  const colors = ROLE_COLORS[role] ?? { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300' }
  const label = ROLE_LABELS[role] ?? role
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  )
}
