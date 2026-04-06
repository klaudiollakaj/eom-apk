import type { Role } from '~/lib/permissions'

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  user: { bg: 'bg-blue-100', text: 'text-blue-800' },
  organizer: { bg: 'bg-orange-100', text: 'text-orange-800' },
  distributor: { bg: 'bg-green-100', text: 'text-green-800' },
  sponsor: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  negotiator: { bg: 'bg-pink-100', text: 'text-pink-800' },
  service_provider: { bg: 'bg-sky-100', text: 'text-sky-800' },
  marketing_agency: { bg: 'bg-purple-100', text: 'text-purple-800' },
  staff: { bg: 'bg-amber-100', text: 'text-amber-800' },
  admin: { bg: 'bg-red-100', text: 'text-red-800' },
  superadmin: { bg: 'bg-red-200', text: 'text-red-900' },
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
  const colors = ROLE_COLORS[role] ?? { bg: 'bg-gray-100', text: 'text-gray-800' }
  const label = ROLE_LABELS[role] ?? role
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  )
}
