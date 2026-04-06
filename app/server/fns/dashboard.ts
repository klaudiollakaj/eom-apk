import { createServerFn } from '@tanstack/react-start'
import { gte, count, desc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { users, userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { hasCapability } from '~/lib/permissions.server'
import type { Role } from '~/lib/permissions'

export const getDashboardStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    const role = session.user.role as Role
    const userId = session.user.id

    const result: {
      totalUsers?: number
      usersByRole?: Record<string, number>
      recentUsers?: { id: string; name: string; email: string; role: string; createdAt: Date }[]
      recentLogs?: { id: string; action: string; createdAt: Date; user?: { name: string } | null }[]
    } = {}

    // Users stats — only if has admin:users:manage
    if (await hasCapability(userId, role, 'admin:users:manage')) {
      const [{ total }] = await db.select({ total: count() }).from(users)
      result.totalUsers = total

      const allUsers = await db.query.users.findMany({
        columns: { role: true },
      })
      result.usersByRole = {}
      for (const u of allUsers) {
        result.usersByRole[u.role] = (result.usersByRole[u.role] || 0) + 1
      }

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      result.recentUsers = await db.query.users.findMany({
        where: gte(users.createdAt, sevenDaysAgo),
        orderBy: [desc(users.createdAt)],
        limit: 10,
        columns: { id: true, name: true, email: true, role: true, createdAt: true },
      })
    }

    // Logs — only if has admin:logs:view
    if (await hasCapability(userId, role, 'admin:logs:view')) {
      result.recentLogs = await db.query.userLogs.findMany({
        orderBy: [desc(userLogs.createdAt)],
        limit: 10,
        with: { user: { columns: { name: true } } },
      })
    }

    return result
  },
)
