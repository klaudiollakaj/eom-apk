export type Role =
  | 'user'
  | 'organizer'
  | 'distributor'
  | 'sponsor'
  | 'negotiator'
  | 'service_provider'
  | 'marketing_agency'
  | 'staff'
  | 'admin'
  | 'superadmin'

export const ROLES: Role[] = [
  'user',
  'organizer',
  'distributor',
  'sponsor',
  'negotiator',
  'service_provider',
  'marketing_agency',
  'staff',
  'admin',
  'superadmin',
]

export const BUSINESS_ROLES: Role[] = [
  'organizer',
  'distributor',
  'sponsor',
  'service_provider',
  'marketing_agency',
  'negotiator',
]

const ADMIN_ROLES: Role[] = ['admin', 'superadmin']

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}

export function isSuperadmin(role: Role): boolean {
  return role === 'superadmin'
}

export function isBusinessRole(role: Role): boolean {
  return BUSINESS_ROLES.includes(role)
}

/** Roles an admin of the given role is allowed to create */
export function creatableRoles(actorRole: Role): Role[] {
  if (actorRole === 'superadmin') {
    return ROLES.filter((r) => r !== 'superadmin')
  }
  if (actorRole === 'admin') {
    return ROLES.filter((r) => r !== 'admin' && r !== 'superadmin')
  }
  return []
}

/** The role-specific dashboard path for a given role. */
export function getDashboardPath(role: Role | null | undefined): string {
  switch (role) {
    case 'admin':
    case 'superadmin':
      return '/admin'
    case 'organizer':
      return '/organizer'
    case 'service_provider':
      return '/service-provider'
    case 'sponsor':
      return '/sponsor'
    case 'distributor':
      return '/distributor'
    case 'negotiator':
      return '/negotiator'
    case 'marketing_agency':
      return '/marketing'
    case 'staff':
      return '/staff'
    default:
      return '/dashboard'
  }
}
