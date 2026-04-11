import { createServerFn } from '@tanstack/react-start'
import { eq, and, gte, lte, desc, count } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

export const listLogs = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      page: number
      perPage: number
      userId?: string
      action?: string
      dateFrom?: string
      dateTo?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:logs:view')

    const conditions = []

    if (data.userId) {
      conditions.push(eq(userLogs.userId, data.userId))
    }
    if (data.action) {
      conditions.push(eq(userLogs.action, data.action))
    }
    if (data.dateFrom) {
      conditions.push(gte(userLogs.createdAt, new Date(data.dateFrom)))
    }
    if (data.dateTo) {
      conditions.push(lte(userLogs.createdAt, new Date(data.dateTo)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [logs, [{ total }]] = await Promise.all([
      db.query.userLogs.findMany({
        where,
        with: { user: true },
        orderBy: [desc(userLogs.createdAt)],
        limit: data.perPage,
        offset: (data.page - 1) * data.perPage,
      }),
      db.select({ total: count() }).from(userLogs).where(where),
    ])

    return { logs: logs as any[], total }
  })
