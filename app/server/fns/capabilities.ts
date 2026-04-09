import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { db } from '~/lib/db'
import { userCapabilities, userLogs, users } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import { isSuperadmin, type Role } from '~/lib/permissions'

export const getUserCapabilities = createServerFn({ method: 'GET' })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })
    if (!target) throw new Error('NOT_FOUND')

    // For Admin-role targets, only Superadmin can view
    if (
      target.role === 'admin' &&
      !isSuperadmin(session.user.role as Role)
    ) {
      throw new Error('FORBIDDEN')
    }

    await requireCapability(session, 'admin:capabilities:manage')

    return db.query.userCapabilities.findMany({
      where: eq(userCapabilities.userId, data.userId),
    })
  })

export const updateUserCapability = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      userId: string
      capability: string
      granted: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })
    if (!target) throw new Error('NOT_FOUND')

    if (
      target.role === 'admin' &&
      !isSuperadmin(session.user.role as Role)
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can manage admin capabilities')
    }

    await requireCapability(session, 'admin:capabilities:manage')

    // Validate capability key against registry
    const VALID_CAPABILITY_PREFIXES = [
      'pages:edit:',
      'economics:view',
      'economics:export',
      'stats:view',
      'stats:export',
      'admin:users:manage',
      'admin:logs:view',
      'admin:navigation:manage',
      'admin:permissions:manage',
      'admin:capabilities:manage',
      'admin:suspend:manage',
      'admin:ads:manage',
      'admin:coupons:manage',
      'admin:viewer:access',
      'admin:categories:manage',
      'admin:events:manage',
      'admin:service-categories:manage',
      'admin:services:manage',
      'admin:negotiations:manage',
      'admin:analytics:view',
      'admin:reviews:moderate',
      'admin:chat:moderate',
    ]
    const isValidKey = VALID_CAPABILITY_PREFIXES.some(
      (prefix) =>
        data.capability === prefix || data.capability.startsWith(prefix),
    )
    if (!isValidKey) {
      throw new Error('INVALID_CAPABILITY_KEY')
    }

    // Upsert
    const existing = await db.query.userCapabilities.findFirst({
      where: and(
        eq(userCapabilities.userId, data.userId),
        eq(userCapabilities.capability, data.capability),
      ),
    })

    if (existing) {
      await db
        .update(userCapabilities)
        .set({
          granted: data.granted,
          grantedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(userCapabilities.id, existing.id))
    } else {
      await db.insert(userCapabilities).values({
        userId: data.userId,
        capability: data.capability,
        granted: data.granted,
        grantedBy: session.user.id,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.granted ? 'capability_granted' : 'capability_revoked',
      details: {
        targetUserId: data.userId,
        capability: data.capability,
      },
    })
  })

export const getMyCapabilities = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    if (isSuperadmin(session.user.role as Role)) {
      return { all: true, capabilities: [] }
    }

    const caps = await db.query.userCapabilities.findMany({
      where: and(
        eq(userCapabilities.userId, session.user.id),
        eq(userCapabilities.granted, true),
      ),
    })

    return {
      all: false,
      capabilities: caps.map((c) => c.capability),
    }
  },
)

export const listUsersWithCapabilities = createServerFn({ method: 'GET' })
  .validator((input: { roleFilter?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:capabilities:manage')

    const allCaps = await db.query.userCapabilities.findMany({
      where: eq(userCapabilities.granted, true),
      with: { user: true },
    })

    // Group by user
    const userMap = new Map<
      string,
      { user: typeof allCaps[0]['user']; capabilities: string[] }
    >()

    for (const cap of allCaps) {
      if (!cap.user) continue
      // Admin can't see other Admin capabilities
      if (
        cap.user.role === 'admin' &&
        !isSuperadmin(session.user.role as Role)
      ) {
        continue
      }
      if (data.roleFilter && cap.user.role !== data.roleFilter) continue

      const existing = userMap.get(cap.userId)
      if (existing) {
        existing.capabilities.push(cap.capability)
      } else {
        userMap.set(cap.userId, {
          user: cap.user,
          capabilities: [cap.capability],
        })
      }
    }

    return Array.from(userMap.values())
  })
