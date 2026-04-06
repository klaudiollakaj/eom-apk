import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { userCapabilities } from './schema'
import type { Role } from './permissions'

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
