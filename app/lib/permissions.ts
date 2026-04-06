import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { userCapabilities } from './schema'

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

export async function hasCapability(
  userId: string,
  role: Role,
  capability: string,
): Promise<boolean> {
  if (role === 'superadmin') return true
  const record = await db.query.userCapabilities.findFirst({
    where: and(
      eq(userCapabilities.userId, userId),
      eq(userCapabilities.capability, capability),
      eq(userCapabilities.granted, true),
    ),
  })
  return !!record
}

export async function requireCapability(
  session: { user: { id: string; role: string } },
  capability: string,
) {
  const has = await hasCapability(
    session.user.id,
    session.user.role as Role,
    capability,
  )
  if (!has) throw new Error('FORBIDDEN')
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
