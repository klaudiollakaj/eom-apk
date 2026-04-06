import { createServerFn } from '@tanstack/react-start'
import { eq, and, or, like, count, desc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { users, userLogs, sessions } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import {
  isSuperadmin,
  isBusinessRole,
  creatableRoles,
  type Role,
} from '~/lib/permissions'
import { auth } from '~/lib/auth'

export const listUsers = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      page: number
      perPage: number
      search?: string
      roleFilter?: string
      statusFilter?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    const conditions = []

    if (data.search) {
      conditions.push(
        or(
          like(users.name, `%${data.search}%`),
          like(users.email, `%${data.search}%`),
        ),
      )
    }

    if (data.roleFilter) {
      conditions.push(eq(users.role, data.roleFilter))
    }

    if (data.statusFilter === 'active') {
      conditions.push(
        and(eq(users.isActive, true), eq(users.isSuspended, false)),
      )
    } else if (data.statusFilter === 'inactive') {
      conditions.push(eq(users.isActive, false))
    } else if (data.statusFilter === 'suspended') {
      conditions.push(
        and(eq(users.isActive, true), eq(users.isSuspended, true)),
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [userList, [{ total }]] = await Promise.all([
      db.query.users.findMany({
        where,
        with: { profile: true },
        orderBy: [desc(users.createdAt)],
        limit: data.perPage,
        offset: (data.page - 1) * data.perPage,
      }),
      db.select({ total: count() }).from(users).where(where),
    ])

    return { users: userList, total }
  })

export const createUser = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      name: string
      email: string
      password: string
      role: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    const actorRole = session.user.role as Role
    const targetRole = data.role as Role
    const allowed = creatableRoles(actorRole)

    if (!allowed.includes(targetRole)) {
      throw new Error('FORBIDDEN: Cannot create this role')
    }

    // Create user via Better Auth admin API
    const result = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
    })

    if (!result?.user?.id) {
      throw new Error('Failed to create user')
    }

    // Set role and mark email as verified (admin-created users)
    await db
      .update(users)
      .set({ role: targetRole, emailVerified: true })
      .where(eq(users.id, result.user.id))

    // Profile is auto-created by databaseHooks.user.create.after
    // No explicit insert needed here

    // Log
    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'user_created',
      details: {
        createdUserId: result.user.id,
        role: targetRole,
        email: data.email,
      },
    })

    return { id: result.user.id }
  })

export const updateUser = createServerFn({ method: 'POST' })
  .validator(
    (input: { id: string; name?: string; email?: string; role?: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.id),
    })
    if (!target) throw new Error('NOT_FOUND')

    // Self-protection: cannot demote yourself
    if (data.id === session.user.id && data.role && data.role !== target.role) {
      throw new Error('FORBIDDEN: Cannot change your own role')
    }

    // Admin cannot edit Admin or Superadmin users
    const actorRole = session.user.role as Role
    if (
      !isSuperadmin(actorRole) &&
      (target.role === 'admin' || target.role === 'superadmin')
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can edit admin accounts')
    }

    // Role change to admin requires Superadmin
    if (data.role === 'admin' && !isSuperadmin(actorRole)) {
      throw new Error('FORBIDDEN: Only Superadmin can assign admin role')
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name) updates.name = data.name
    if (data.email) updates.email = data.email

    const logDetails: Record<string, unknown> = { targetUserId: data.id }

    if (data.role && data.role !== target.role) {
      updates.role = data.role
      logDetails.oldRole = target.role
      logDetails.newRole = data.role

      await db.insert(userLogs).values({
        userId: session.user.id,
        action: 'role_changed',
        details: logDetails,
      })
    }

    await db.update(users).set(updates).where(eq(users.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'user_updated',
      details: logDetails,
    })
  })

export const toggleUserStatus = createServerFn({ method: 'POST' })
  .validator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    // Self-protection
    if (data.id === session.user.id) {
      throw new Error('FORBIDDEN: Cannot change your own status')
    }

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.id),
    })
    if (!target) throw new Error('NOT_FOUND')

    // Last superadmin protection
    if (target.role === 'superadmin' && !data.active) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(users)
        .where(
          and(eq(users.role, 'superadmin'), eq(users.isActive, true)),
        )
      if (total <= 1) throw new Error('LAST_SUPERADMIN')
    }

    // Admin cannot deactivate Admin/Superadmin users
    if (
      !isSuperadmin(session.user.role as Role) &&
      (target.role === 'admin' || target.role === 'superadmin')
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can change admin status')
    }

    await db
      .update(users)
      .set({ isActive: data.active, updatedAt: new Date() })
      .where(eq(users.id, data.id))

    // Invalidate sessions when deactivating
    if (!data.active) {
      await db.delete(sessions).where(eq(sessions.userId, data.id))
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.active ? 'user_activated' : 'user_deactivated',
      details: { targetUserId: data.id },
    })
  })

export const toggleSuspension = createServerFn({ method: 'POST' })
  .validator((input: { userId: string; suspended: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:suspend:manage')

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })
    if (!target) throw new Error('NOT_FOUND')

    if (!isBusinessRole(target.role as Role)) {
      throw new Error('INVALID_ROLE_FOR_SUSPENSION')
    }

    await db
      .update(users)
      .set({ isSuspended: data.suspended, updatedAt: new Date() })
      .where(eq(users.id, data.userId))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.suspended ? 'user_suspended' : 'user_resumed',
      details: { targetUserId: data.userId },
    })
  })

export const bulkUpdateRole = createServerFn({ method: 'POST' })
  .validator((input: { userIds: string[]; role: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    if (
      data.role === 'admin' &&
      !isSuperadmin(session.user.role as Role)
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can assign admin role')
    }

    if (data.role === 'superadmin') {
      throw new Error('FORBIDDEN: Cannot assign superadmin role')
    }

    for (const userId of data.userIds) {
      if (userId === session.user.id) continue // skip self

      const target = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
      if (!target) continue

      // Admin cannot change role of admin/superadmin users
      if (
        !isSuperadmin(session.user.role as Role) &&
        (target.role === 'admin' || target.role === 'superadmin')
      ) {
        continue // skip — only Superadmin can modify admin accounts
      }

      await db
        .update(users)
        .set({ role: data.role, updatedAt: new Date() })
        .where(eq(users.id, userId))

      await db.insert(userLogs).values({
        userId: session.user.id,
        action: 'role_changed',
        details: {
          targetUserId: userId,
          oldRole: target.role,
          newRole: data.role,
        },
      })
    }
  })

export const bulkToggleStatus = createServerFn({ method: 'POST' })
  .validator((input: { userIds: string[]; active: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    for (const userId of data.userIds) {
      if (userId === session.user.id) continue // skip self

      // Protect admin/superadmin from non-superadmin actors
      const target = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { role: true },
      })
      if (!target) continue
      if (
        !isSuperadmin(session.user.role as Role) &&
        (target.role === 'admin' || target.role === 'superadmin')
      ) {
        continue // only Superadmin can toggle admin accounts
      }

      await db
        .update(users)
        .set({ isActive: data.active, updatedAt: new Date() })
        .where(eq(users.id, userId))

      if (!data.active) {
        await db.delete(sessions).where(eq(sessions.userId, userId))
      }

      await db.insert(userLogs).values({
        userId: session.user.id,
        action: data.active ? 'user_activated' : 'user_deactivated',
        details: { targetUserId: userId },
      })
    }
  })
