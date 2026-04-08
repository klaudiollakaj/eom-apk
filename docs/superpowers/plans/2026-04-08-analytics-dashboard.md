# Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add analytics dashboards with charts and KPIs for admin, organizer, and service provider roles.

**Architecture:** New `app/server/fns/analytics.ts` with aggregation queries returning pre-computed stats. Shared UI components in `app/components/analytics/`. Recharts for charts. Admin gets a new `/admin/analytics` route; organizer and provider dashboards get new analytics sections appended below existing content.

**Tech Stack:** Recharts, Drizzle ORM aggregations (count, sum, sql), TanStack Start server functions

---

## File Map

**Create:**
- `app/server/fns/analytics.ts` — all analytics server functions (admin, organizer, provider)
- `app/components/analytics/KPICard.tsx` — reusable stat card
- `app/components/analytics/PeriodToggle.tsx` — 7d/30d toggle (admin only)
- `app/components/analytics/FunnelChart.tsx` — horizontal progress bar funnel
- `app/components/analytics/EmptyChart.tsx` — "No data yet" placeholder
- `app/components/analytics/OrganizerAnalyticsSection.tsx` — organizer charts section
- `app/components/analytics/ProviderAnalyticsSection.tsx` — provider charts section
- `app/routes/admin/analytics.tsx` — admin analytics page

**Modify:**
- `app/server/fns/capabilities.ts` — add `admin:analytics:view` prefix
- `app/routes/admin/route.tsx` — add `admin:analytics:view` to capList
- `app/components/layout/AdminSidebar.tsx` — add Analytics menu item
- `app/routes/organizer/index.tsx` — import and render OrganizerAnalyticsSection
- `app/routes/service-provider/index.tsx` — import and render ProviderAnalyticsSection
- `package.json` — add recharts dependency

---

## Chunk 1: Dependencies + Shared Components + Capability

### Task 1: Install Recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install recharts**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK && npm install recharts
```

- [ ] **Step 2: Verify installation**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK && node -e "require('recharts'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts dependency for analytics dashboards"
```

---

### Task 2: Add analytics capability prefix

**Files:**
- Modify: `app/server/fns/capabilities.ts`
- Modify: `app/routes/admin/route.tsx`
- Modify: `app/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add `admin:analytics:view` to VALID_CAPABILITY_PREFIXES**

In `app/server/fns/capabilities.ts`, find the `VALID_CAPABILITY_PREFIXES` array and add after `'admin:negotiations:manage'`:

```typescript
      'admin:analytics:view',
```

- [ ] **Step 2: Add to admin route capList**

In `app/routes/admin/route.tsx`, find the `capList` array inside `AdminLayout` and add after `'admin:negotiations:manage'`:

```typescript
          'admin:analytics:view',
```

- [ ] **Step 3: Add Analytics to AdminSidebar**

In `app/components/layout/AdminSidebar.tsx`, find the `SIDEBAR_ITEMS` array and add after the Negotiations entry:

```typescript
  {
    label: 'Analytics',
    href: '/admin/analytics',
    capability: 'admin:analytics:view',
  },
```

- [ ] **Step 4: Commit**

```bash
git add app/server/fns/capabilities.ts app/routes/admin/route.tsx app/components/layout/AdminSidebar.tsx
git commit -m "feat: add admin:analytics:view capability and sidebar item"
```

---

### Task 3: Create shared analytics components

**Files:**
- Create: `app/components/analytics/KPICard.tsx`
- Create: `app/components/analytics/PeriodToggle.tsx`
- Create: `app/components/analytics/FunnelChart.tsx`
- Create: `app/components/analytics/EmptyChart.tsx`

- [ ] **Step 1: Create KPICard**

```tsx
// app/components/analytics/KPICard.tsx
interface KPICardProps {
  label: string
  value: string | number
  subtitle?: string
  delta?: string
}

export function KPICard({ label, value, subtitle, delta }: KPICardProps) {
  return (
    <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value ?? '—'}</p>
      {delta && <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">{delta}</p>}
      {subtitle && !delta && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create PeriodToggle**

```tsx
// app/components/analytics/PeriodToggle.tsx
interface PeriodToggleProps {
  period: 7 | 30
  onChange: (p: 7 | 30) => void
}

export function PeriodToggle({ period, onChange }: PeriodToggleProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
      {([7, 30] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            period === p
              ? 'bg-indigo-600 text-white'
              : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          {p} days
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create FunnelChart**

```tsx
// app/components/analytics/FunnelChart.tsx
interface FunnelItem {
  label: string
  value: number
  color: string
}

interface FunnelChartProps {
  items: FunnelItem[]
}

export function FunnelChart({ items }: FunnelChartProps) {
  const max = Math.max(...items.map((i) => i.value), 1)

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span>{item.label}</span>
            <span className="text-gray-500 dark:text-gray-400">{item.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create EmptyChart**

```tsx
// app/components/analytics/EmptyChart.tsx
export function EmptyChart({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center">
      <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/components/analytics/
git commit -m "feat: add shared analytics components (KPICard, PeriodToggle, FunnelChart, EmptyChart)"
```

---

## Chunk 2: Admin Analytics Server Functions + Route

### Task 4: Create admin analytics server functions

**Files:**
- Create: `app/server/fns/analytics.ts`

This is the biggest task. Create the file with all admin functions first, then add organizer and provider functions in later tasks.

- [ ] **Step 1: Create analytics.ts with admin functions**

```tsx
// app/server/fns/analytics.ts
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

// ── Admin Functions ──

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

    // Ensure all 7 statuses are present
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
```

- [ ] **Step 2: Verify the file has no syntax errors**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK && npx tsc --noEmit app/server/fns/analytics.ts 2>&1 | head -20
```

Note: tsc may not work standalone with path aliases. As a fallback, check that dev server starts without errors.

- [ ] **Step 3: Commit**

```bash
git add app/server/fns/analytics.ts
git commit -m "feat: add admin analytics server functions (KPIs, user growth, funnel, categories)"
```

---

### Task 5: Create admin analytics route

**Files:**
- Create: `app/routes/admin/analytics.tsx`

- [ ] **Step 1: Create the admin analytics page**

```tsx
// app/routes/admin/analytics.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getAdminKPIs,
  getAdminUserGrowth,
  getAdminNegotiationFunnel,
  getAdminEventsByCategory,
  getAdminTopServiceCategories,
} from '~/server/fns/analytics'
import { KPICard } from '~/components/analytics/KPICard'
import { PeriodToggle } from '~/components/analytics/PeriodToggle'
import { FunnelChart } from '~/components/analytics/FunnelChart'
import { EmptyChart } from '~/components/analytics/EmptyChart'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const FUNNEL_COLORS: Record<string, string> = {
  requested: '#818cf8',
  offered: '#60a5fa',
  countered: '#a78bfa',
  accepted: '#34d399',
  rejected: '#f87171',
  cancelled: '#94a3b8',
  expired: '#fb923c',
}

const PIE_COLORS = ['#818cf8', '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#94a3b8']

export const Route = createFileRoute('/admin/analytics')({
  component: AdminAnalyticsPage,
})

function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<7 | 30>(7)
  const [kpis, setKpis] = useState<any>(null)
  const [userGrowth, setUserGrowth] = useState<any[]>([])
  const [funnel, setFunnel] = useState<any[]>([])
  const [eventCategories, setEventCategories] = useState<any[]>([])
  const [serviceCategories, setServiceCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    const [kpiData, growthData, funnelData, eventCatData, serviceCatData] = await Promise.all([
      getAdminKPIs({ data: { period } }),
      getAdminUserGrowth({ data: { period } }),
      getAdminNegotiationFunnel(),
      getAdminEventsByCategory(),
      getAdminTopServiceCategories({ data: { limit: 5 } }),
    ])
    setKpis(kpiData)
    setUserGrowth(growthData)
    setFunnel(funnelData)
    setEventCategories(eventCatData)
    setServiceCategories(serviceCatData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [period])

  if (loading && !kpis) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <PeriodToggle period={period} onChange={setPeriod} />
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Total Users" value={kpis.totalUsers} delta={`+${kpis.newUsers} this period`} />
          <KPICard label="Published Events" value={kpis.publishedEvents} delta={`+${kpis.newEvents} this period`} />
          <KPICard label="Active Services" value={kpis.activeServices} delta={`+${kpis.newServices} this period`} />
          <KPICard label="Deals Closed" value={kpis.dealsClosed} subtitle={`€${Number(kpis.totalRevenue).toLocaleString()} total value`} />
        </div>
      )}

      {/* Row 2: User Growth + Negotiation Funnel */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">User Registrations</h3>
          {userGrowth.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={userGrowth}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Negotiation Funnel (All Time)</h3>
          {funnel.length === 0 ? (
            <EmptyChart />
          ) : (
            <FunnelChart
              items={funnel.map((f) => ({
                label: f.status.charAt(0).toUpperCase() + f.status.slice(1),
                value: f.count,
                color: FUNNEL_COLORS[f.status] || '#94a3b8',
              }))}
            />
          )}
        </div>
      </div>

      {/* Row 3: Events by Category + Top Service Categories */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Events by Category (All Time)</h3>
          {eventCategories.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={eventCategories} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} label={({ name }) => name}>
                  {eventCategories.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Top Service Categories (All Time)</h3>
          {serviceCategories.length === 0 ? (
            <EmptyChart />
          ) : (
            <div className="space-y-2 text-sm">
              {serviceCategories.map((cat, i) => (
                <div key={cat.name} className="flex items-center justify-between border-b py-2 last:border-0 dark:border-gray-700">
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                    {cat.name}
                  </span>
                  <span className="font-semibold">{cat.count} services</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Delete stale route tree and verify dev server starts**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK && rm -f app/routeTree.gen.ts
```

Then start dev server to confirm route tree regenerates without errors.

- [ ] **Step 3: Commit**

```bash
git add app/routes/admin/analytics.tsx
git commit -m "feat: add admin analytics page with KPIs, charts, and funnel"
```

---

## Chunk 3: Organizer Analytics

### Task 6: Add organizer analytics server functions

**Files:**
- Modify: `app/server/fns/analytics.ts`

- [ ] **Step 1: Append organizer functions to analytics.ts**

Add at the bottom of `app/server/fns/analytics.ts`:

```typescript
// ── Organizer Functions ──

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

    // Merge into daily entries
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
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/analytics.ts
git commit -m "feat: add organizer analytics server functions"
```

---

### Task 7: Create OrganizerAnalyticsSection component

**Files:**
- Create: `app/components/analytics/OrganizerAnalyticsSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/analytics/OrganizerAnalyticsSection.tsx
import { useState, useEffect } from 'react'
import {
  getOrganizerAnalytics,
  getOrganizerEventBreakdown,
  getOrganizerSpendByEvent,
  getOrganizerNegotiationTrend,
} from '~/server/fns/analytics'
import { KPICard } from './KPICard'
import { EmptyChart } from './EmptyChart'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
  LineChart, Line,
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  published: '#22c55e',
  draft: '#64748b',
  cancelled: '#f87171',
  archived: '#e2e8f0',
}

const PIE_COLORS = ['#22c55e', '#64748b', '#f87171', '#cbd5e1']

export function OrganizerAnalyticsSection() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [eventBreakdown, setEventBreakdown] = useState<any[]>([])
  const [spendByEvent, setSpendByEvent] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getOrganizerAnalytics(),
      getOrganizerEventBreakdown(),
      getOrganizerSpendByEvent({ data: { limit: 5 } }),
      getOrganizerNegotiationTrend(),
    ]).then(([a, b, s, t]) => {
      setAnalytics(a)
      setEventBreakdown(b)
      setSpendByEvent(s)
      setTrend(t)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="mt-6 text-sm text-gray-500">Loading analytics...</p>

  return (
    <div className="mt-8 space-y-6 border-t pt-8 dark:border-gray-700">
      <h2 className="text-lg font-bold">Analytics</h2>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Negotiations" value={analytics.totalNegotiations} subtitle={`${analytics.activeNegotiations} active`} />
          <KPICard label="Deals Closed" value={analytics.dealsClosed} subtitle={`${analytics.successRate}% success rate`} />
          <KPICard label="Total Spent" value={`€${Number(analytics.totalSpent).toLocaleString()}`} subtitle="on services" />
          <KPICard label="Avg Deal Value" value={analytics.dealsClosed > 0 ? `€${Number(analytics.avgDealValue).toLocaleString()}` : '—'} />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Event Status Breakdown</h3>
          {eventBreakdown.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={eventBreakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                  {eventBreakdown.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Service Spend per Event (Top 5)</h3>
          {spendByEvent.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={spendByEvent} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                <YAxis type="category" dataKey="title" tick={{ fontSize: 10 }} width={120} />
                <Tooltip formatter={(v: number) => `€${v}`} />
                <Bar dataKey="totalSpend" fill="#818cf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Negotiation Activity */}
      <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold">Negotiation Activity (Last 30 Days)</h3>
        {trend.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={trend}>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="sent" stroke="#818cf8" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="accepted" stroke="#34d399" strokeWidth={2} strokeDasharray="4 4" dot={false} name="Accepted" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/analytics/OrganizerAnalyticsSection.tsx
git commit -m "feat: add OrganizerAnalyticsSection component"
```

---

### Task 8: Integrate into organizer dashboard

**Files:**
- Modify: `app/routes/organizer/index.tsx`

- [ ] **Step 1: Add import at top of file**

After existing imports in `app/routes/organizer/index.tsx`, add:

```typescript
import { OrganizerAnalyticsSection } from '~/components/analytics/OrganizerAnalyticsSection'
```

- [ ] **Step 2: Render section before closing `</div>`**

Find the final closing `</div>` of the return statement (the `mx-auto max-w-7xl` div) and add just before it:

```tsx
      <OrganizerAnalyticsSection />
```

This goes after the events table or the "No events yet" block, before the closing `</div>` tag.

- [ ] **Step 3: Commit**

```bash
git add app/routes/organizer/index.tsx
git commit -m "feat: integrate analytics section into organizer dashboard"
```

---

## Chunk 4: Provider Analytics

### Task 9: Add provider analytics server functions

**Files:**
- Modify: `app/server/fns/analytics.ts`

- [ ] **Step 1: Append provider functions to analytics.ts**

Add at the bottom of `app/server/fns/analytics.ts`:

```typescript
// ── Provider Functions ──

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
      const totalRounds = Array.from(maxByNeg.values()).reduce((a, b) => a + b, 0)
      avgRounds = Number((totalRounds / maxByNeg.size).toFixed(1))
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

    // Ensure all terminal statuses present
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
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/analytics.ts
git commit -m "feat: add provider analytics server functions"
```

---

### Task 10: Create ProviderAnalyticsSection component

**Files:**
- Create: `app/components/analytics/ProviderAnalyticsSection.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/components/analytics/ProviderAnalyticsSection.tsx
import { useState, useEffect } from 'react'
import {
  getProviderAnalytics,
  getProviderRevenueTrend,
  getProviderNegotiationOutcomes,
  getProviderServicePerformance,
} from '~/server/fns/analytics'
import { KPICard } from './KPICard'
import { EmptyChart } from './EmptyChart'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'

const OUTCOME_COLORS: Record<string, string> = {
  accepted: '#22c55e',
  rejected: '#f87171',
  expired: '#f59e0b',
  cancelled: '#94a3b8',
}

export function ProviderAnalyticsSection() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [revenueTrend, setRevenueTrend] = useState<any[]>([])
  const [outcomes, setOutcomes] = useState<any[]>([])
  const [performance, setPerformance] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getProviderAnalytics(),
      getProviderRevenueTrend(),
      getProviderNegotiationOutcomes(),
      getProviderServicePerformance(),
    ]).then(([a, r, o, p]) => {
      setAnalytics(a)
      setRevenueTrend(r)
      setOutcomes(o)
      setPerformance(p)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="mt-6 text-sm text-gray-500">Loading analytics...</p>

  return (
    <div className="mt-8 space-y-6 border-t pt-8 dark:border-gray-700">
      <h2 className="text-lg font-bold">Analytics</h2>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Total Revenue" value={`€${Number(analytics.totalRevenue).toLocaleString()}`} subtitle="from accepted deals" />
          <KPICard label="Avg Deal Value" value={Number(analytics.avgDealValue) > 0 ? `€${Number(analytics.avgDealValue).toLocaleString()}` : '—'} />
          <KPICard label="Success Rate" value={analytics.successRate > 0 ? `${analytics.successRate}%` : '—'} />
          <KPICard label="Avg Rounds" value={analytics.avgRounds > 0 ? analytics.avgRounds : '—'} subtitle="per negotiation" />
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Revenue Trend (Last 30 Days)</h3>
          {revenueTrend.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueTrend}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(v: number) => `€${v}`} />
                <Area type="monotone" dataKey="revenue" stroke="#818cf8" fill="#c7d2fe" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Negotiation Outcomes</h3>
          {outcomes.every((o) => o.count === 0) ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={outcomes.filter((o) => o.count > 0)} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={35} outerRadius={60}>
                  {outcomes.filter((o) => o.count > 0).map((entry, i) => (
                    <Cell key={i} fill={OUTCOME_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(value: string) => value.charAt(0).toUpperCase() + value.slice(1)} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Service Performance Table */}
      <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
        <h3 className="mb-3 text-sm font-semibold">Service Performance</h3>
        {performance.length === 0 ? (
          <EmptyChart message="No services yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="px-3 py-2 text-left">Service</th>
                  <th className="px-3 py-2 text-center">Inquiries</th>
                  <th className="px-3 py-2 text-center">Deals</th>
                  <th className="px-3 py-2 text-center">Rate</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-700">
                {performance.map((svc) => (
                  <tr key={svc.serviceId}>
                    <td className="px-3 py-2">{svc.title}</td>
                    <td className="px-3 py-2 text-center">{svc.inquiries}</td>
                    <td className="px-3 py-2 text-center">{svc.deals}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        svc.conversionRate >= 50
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      }`}>
                        {svc.conversionRate}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold">€{Number(svc.revenue).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/analytics/ProviderAnalyticsSection.tsx
git commit -m "feat: add ProviderAnalyticsSection component"
```

---

### Task 11: Integrate into service provider dashboard

**Files:**
- Modify: `app/routes/service-provider/index.tsx`

- [ ] **Step 1: Add import at top of file**

After existing imports in `app/routes/service-provider/index.tsx`, add:

```typescript
import { ProviderAnalyticsSection } from '~/components/analytics/ProviderAnalyticsSection'
```

- [ ] **Step 2: Render section before closing `</div>`**

Find the final closing `</div>` of the return statement (the `mx-auto max-w-6xl` div). Add just before it:

```tsx
      <ProviderAnalyticsSection />
```

This goes after the recent negotiations list.

- [ ] **Step 3: Commit**

```bash
git add app/routes/service-provider/index.tsx
git commit -m "feat: integrate analytics section into service provider dashboard"
```

---

### Task 12: Final verification and push

- [ ] **Step 1: Delete stale route tree**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK && rm -f app/routeTree.gen.ts
```

- [ ] **Step 2: Verify build succeeds**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK && npm run build 2>&1 | tail -20
```

Expected: Build completes without errors.

- [ ] **Step 3: Push to origin**

```bash
git push origin master
```
