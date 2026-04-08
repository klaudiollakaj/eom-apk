import { createServerFn } from '@tanstack/react-start'
import { eq, gte, count, sum, sql, and, desc } from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  users, events, services, serviceCategories, categories,
  negotiations, negotiationRounds, eventServices,
} from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

// ── Helpers ──

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

const TERMINAL_STATUSES = ['accepted', 'rejected', 'cancelled', 'expired']

// ══════════════════════════════════════════════════
// Admin Functions
// ══════════════════════════════════════════════════

export const getAdminKPIs = createServerFn({ method: 'GET' })
  .validator((input: { period: 7 | 30 }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const since = daysAgo(data.period)

    const [
      [{ total: totalUsers }],
      [{ total: newUsers }],
      [{ total: publishedEvents }],
      [{ total: newEvents }],
      [{ total: activeServices }],
      [{ total: newServices }],
      [{ total: dealsClosed }],
      [{ total: newDeals }],
      [{ total: totalRevenue }],
    ] = await Promise.all([
      db.select({ total: count() }).from(users),
      db.select({ total: count() }).from(users).where(gte(users.createdAt, since)),
      db.select({ total: count() }).from(events).where(eq(events.status, 'published')),
      db.select({ total: count() }).from(events).where(and(eq(events.status, 'published'), gte(events.createdAt, since))),
      db.select({ total: count() }).from(services).where(eq(services.isActive, true)),
      db.select({ total: count() }).from(services).where(and(eq(services.isActive, true), gte(services.createdAt, since))),
      db.select({ total: count() }).from(negotiations).where(eq(negotiations.status, 'accepted')),
      db.select({ total: count() }).from(negotiations).where(and(eq(negotiations.status, 'accepted'), gte(negotiations.updatedAt, since))),
      db.select({ total: sum(eventServices.agreedPrice) }).from(eventServices),
    ])

    return {
      totalUsers, newUsers,
      publishedEvents, newEvents,
      activeServices, newServices,
      dealsClosed, newDeals,
      totalRevenue: totalRevenue || '0',
    }
  })

export const getAdminUserGrowth = createServerFn({ method: 'GET' })
  .validator((input: { period: 7 | 30 }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const since = daysAgo(data.period)

    const rows = await db
      .select({
        date: sql<string>`DATE(${users.createdAt})`.as('date'),
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, since))
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`)

    return rows
  })

export const getAdminNegotiationFunnel = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const rows = await db
      .select({ status: negotiations.status, count: count() })
      .from(negotiations)
      .groupBy(negotiations.status)

    const allStatuses = ['requested', 'offered', 'countered', 'accepted', 'rejected', 'cancelled', 'expired']
    return allStatuses.map((status) => ({
      status,
      count: rows.find((r) => r.status === status)?.count ?? 0,
    }))
  },
)

export const getAdminEventsByCategory = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const rows = await db
      .select({ name: categories.name, count: count() })
      .from(events)
      .innerJoin(categories, eq(events.categoryId, categories.id))
      .groupBy(categories.name)
      .orderBy(desc(count()))

    return rows
  },
)

export const getAdminTopServiceCategories = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:analytics:view')

    const rows = await db
      .select({ name: serviceCategories.name, count: count() })
      .from(services)
      .innerJoin(serviceCategories, eq(services.categoryId, serviceCategories.id))
      .where(eq(services.isActive, true))
      .groupBy(serviceCategories.name)
      .orderBy(desc(count()))
      .limit(data.limit ?? 5)

    return rows
  })

// ══════════════════════════════════════════════════
// Organizer Functions
// ══════════════════════════════════════════════════

export const getOrganizerAnalytics = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const allNegs = await db.query.negotiations.findMany({
      where: eq(negotiations.organizerId, session.user.id),
    })

    const total = allNegs.length
    const active = allNegs.filter((n) => !TERMINAL_STATUSES.includes(n.status)).length
    const accepted = allNegs.filter((n) => n.status === 'accepted').length
    const terminal = allNegs.filter((n) => TERMINAL_STATUSES.includes(n.status)).length
    const successRate = terminal > 0 ? Math.round((accepted / terminal) * 100) : 0

    const [{ total: totalSpent }] = await db
      .select({ total: sum(eventServices.agreedPrice) })
      .from(eventServices)
      .innerJoin(events, eq(eventServices.eventId, events.id))
      .where(eq(events.organizerId, session.user.id))

    const spent = Number(totalSpent || 0)
    const avgDeal = accepted > 0 ? (spent / accepted).toFixed(2) : '0'

    return {
      totalNegotiations: total,
      activeNegotiations: active,
      dealsClosed: accepted,
      successRate,
      totalSpent: spent.toFixed(2),
      avgDealValue: avgDeal,
    }
  },
)

export const getOrganizerEventBreakdown = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const rows = await db
      .select({ status: events.status, count: count() })
      .from(events)
      .where(eq(events.organizerId, session.user.id))
      .groupBy(events.status)

    return rows
  },
)

export const getOrganizerSpendByEvent = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const rows = await db
      .select({
        eventId: eventServices.eventId,
        title: events.title,
        totalSpend: sum(eventServices.agreedPrice),
      })
      .from(eventServices)
      .innerJoin(events, eq(eventServices.eventId, events.id))
      .where(eq(events.organizerId, session.user.id))
      .groupBy(eventServices.eventId, events.title)
      .orderBy(desc(sum(eventServices.agreedPrice)))
      .limit(data.limit ?? 5)

    return rows.map((r) => ({
      eventId: r.eventId,
      title: r.title,
      totalSpend: r.totalSpend || '0',
    }))
  })

export const getOrganizerNegotiationTrend = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    const since = daysAgo(30)

    const sent = await db
      .select({
        date: sql<string>`DATE(${negotiations.createdAt})`.as('date'),
        count: count(),
      })
      .from(negotiations)
      .where(and(eq(negotiations.organizerId, session.user.id), gte(negotiations.createdAt, since)))
      .groupBy(sql`DATE(${negotiations.createdAt})`)

    const accepted = await db
      .select({
        date: sql<string>`DATE(${negotiations.updatedAt})`.as('date'),
        count: count(),
      })
      .from(negotiations)
      .where(and(
        eq(negotiations.organizerId, session.user.id),
        eq(negotiations.status, 'accepted'),
        gte(negotiations.updatedAt, since),
      ))
      .groupBy(sql`DATE(${negotiations.updatedAt})`)

    const sentMap = new Map(sent.map((r) => [r.date, r.count]))
    const accMap = new Map(accepted.map((r) => [r.date, r.count]))
    const allDates = new Set([...sentMap.keys(), ...accMap.keys()])

    return Array.from(allDates)
      .sort()
      .map((date) => ({
        date,
        sent: sentMap.get(date) ?? 0,
        accepted: accMap.get(date) ?? 0,
      }))
  },
)

// ══════════════════════════════════════════════════
// Provider Functions
// ══════════════════════════════════════════════════

export const getProviderAnalytics = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const allNegs = await db.query.negotiations.findMany({
      where: eq(negotiations.providerId, session.user.id),
    })

    const terminal = allNegs.filter((n) => TERMINAL_STATUSES.includes(n.status))
    const accepted = terminal.filter((n) => n.status === 'accepted')
    const successRate = terminal.length > 0 ? Math.round((accepted.length / terminal.length) * 100) : 0

    const [{ total: totalRevenue }] = await db
      .select({ total: sum(eventServices.agreedPrice) })
      .from(eventServices)
      .where(eq(eventServices.providerId, session.user.id))

    const revenue = Number(totalRevenue || 0)
    const avgDeal = accepted.length > 0 ? (revenue / accepted.length).toFixed(2) : '0'

    // Avg rounds across terminal negotiations
    let avgRounds = 0
    if (terminal.length > 0) {
      const negIds = terminal.map((n) => n.id)
      const rounds = await db.query.negotiationRounds.findMany({
        where: sql`${negotiationRounds.negotiationId} IN (${sql.join(negIds.map(id => sql`${id}`), sql`, `)})`
      })
      const maxByNeg = new Map<string, number>()
      for (const r of rounds) {
        const cur = maxByNeg.get(r.negotiationId) ?? 0
        if (r.roundNumber > cur) maxByNeg.set(r.negotiationId, r.roundNumber)
      }
      if (maxByNeg.size > 0) {
        const totalRounds = Array.from(maxByNeg.values()).reduce((a, b) => a + b, 0)
        avgRounds = Number((totalRounds / maxByNeg.size).toFixed(1))
      }
    }

    return {
      totalRevenue: revenue.toFixed(2),
      avgDealValue: avgDeal,
      successRate,
      avgRounds,
    }
  },
)

export const getProviderRevenueTrend = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    const since = daysAgo(30)

    const rows = await db
      .select({
        date: sql<string>`DATE(${eventServices.createdAt})`.as('date'),
        revenue: sum(eventServices.agreedPrice),
      })
      .from(eventServices)
      .where(and(eq(eventServices.providerId, session.user.id), gte(eventServices.createdAt, since)))
      .groupBy(sql`DATE(${eventServices.createdAt})`)
      .orderBy(sql`DATE(${eventServices.createdAt})`)

    return rows.map((r) => ({ date: r.date, revenue: r.revenue || '0' }))
  },
)

export const getProviderNegotiationOutcomes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const rows = await db
      .select({ status: negotiations.status, count: count() })
      .from(negotiations)
      .where(and(
        eq(negotiations.providerId, session.user.id),
        sql`${negotiations.status} IN ('accepted', 'rejected', 'cancelled', 'expired')`,
      ))
      .groupBy(negotiations.status)

    return TERMINAL_STATUSES.map((status) => ({
      status,
      count: rows.find((r) => r.status === status)?.count ?? 0,
    }))
  },
)

export const getProviderServicePerformance = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const myServices = await db.query.services.findMany({
      where: and(eq(services.providerId, session.user.id), eq(services.isActive, true)),
      columns: { id: true, title: true },
    })

    const result = []
    for (const svc of myServices) {
      const negs = await db.query.negotiations.findMany({
        where: eq(negotiations.serviceId, svc.id),
      })
      const deals = negs.filter((n) => n.status === 'accepted').length
      const inquiries = negs.length

      const [{ total }] = await db
        .select({ total: sum(eventServices.agreedPrice) })
        .from(eventServices)
        .where(eq(eventServices.serviceId, svc.id))

      result.push({
        serviceId: svc.id,
        title: svc.title,
        inquiries,
        deals,
        conversionRate: inquiries > 0 ? Math.round((deals / inquiries) * 100) : 0,
        revenue: total || '0',
      })
    }

    return result.sort((a, b) => Number(b.revenue) - Number(a.revenue))
  },
)
