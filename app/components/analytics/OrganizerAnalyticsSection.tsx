import { useState, useEffect } from 'react'
import {
  getOrganizerAnalytics,
  getOrganizerEventBreakdown,
  getOrganizerSpendByEvent,
  getOrganizerNegotiationTrend,
  getOrganizerTicketSalesOverTime,
  getOrganizerRevenueByTier,
  getOrganizerTopEventsByRevenue,
  getOrganizerAttendanceRate,
} from '~/server/fns/analytics'
import { KPICard } from './KPICard'
import { EmptyChart } from './EmptyChart'
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis,
  LineChart, Line, CartesianGrid,
} from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  published: '#22c55e',
  draft: '#64748b',
  cancelled: '#f87171',
  archived: '#cbd5e1',
}

const TIER_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6', '#f87171']

export function OrganizerAnalyticsSection() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [eventBreakdown, setEventBreakdown] = useState<any[]>([])
  const [spendByEvent, setSpendByEvent] = useState<any[]>([])
  const [trend, setTrend] = useState<any[]>([])
  const [ticketSales, setTicketSales] = useState<any[]>([])
  const [revenueByTier, setRevenueByTier] = useState<any[]>([])
  const [topEvents, setTopEvents] = useState<any[]>([])
  const [attendance, setAttendance] = useState<{ total: number; checkedIn: number; rate: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getOrganizerAnalytics(),
      getOrganizerEventBreakdown(),
      getOrganizerSpendByEvent({ data: { limit: 5 } }),
      getOrganizerNegotiationTrend(),
      getOrganizerTicketSalesOverTime(),
      getOrganizerRevenueByTier(),
      getOrganizerTopEventsByRevenue({ data: { limit: 5 } }),
      getOrganizerAttendanceRate(),
    ]).then(([a, b, s, t, ts, rt, te, att]) => {
      setAnalytics(a ?? null)
      setEventBreakdown(Array.isArray(b) ? b : [])
      setSpendByEvent(Array.isArray(s) ? s : [])
      setTrend(Array.isArray(t) ? t : [])
      setTicketSales(Array.isArray(ts) ? ts : [])
      setRevenueByTier(Array.isArray(rt) ? rt : [])
      setTopEvents(Array.isArray(te) ? te : [])
      setAttendance(att ?? null)
      setLoading(false)
    }).catch((err) => {
      console.error('Failed to load organizer analytics:', err)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="mt-6 text-sm text-gray-500">Loading analytics...</p>

  const totalTicketRevenue = revenueByTier.reduce((sum, r) => sum + Number(r.revenue || 0), 0)
  const totalTicketsSold = revenueByTier.reduce((sum, r) => sum + Number(r.sold || 0), 0)

  return (
    <div className="mt-8 space-y-6 border-t pt-8 dark:border-gray-700">
      <h2 className="text-lg font-bold">Analytics</h2>

      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Negotiations" value={analytics.totalNegotiations} subtitle={`${analytics.activeNegotiations} active`} />
          <KPICard label="Deals Closed" value={analytics.dealsClosed} subtitle={`${analytics.successRate}% success rate`} />
          <KPICard label="Total Spent" value={`€${Number(analytics.totalSpent).toLocaleString()}`} subtitle="on services" />
          <KPICard label="Avg Deal Value" value={analytics.dealsClosed > 0 ? `€${Number(analytics.avgDealValue).toLocaleString()}` : '—'} />
        </div>
      )}

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
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || '#cbd5e1'} />
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
                <Tooltip formatter={(v) => `€${v}`} />
                <Bar dataKey="totalSpend" fill="#818cf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

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

      {/* ── Ticketing ── */}
      <div className="border-t pt-6 dark:border-gray-700">
        <h2 className="mb-4 text-lg font-bold">Ticketing</h2>

        <div className="mb-4 grid grid-cols-4 gap-4">
          <KPICard label="Tickets Sold" value={totalTicketsSold} />
          <KPICard label="Ticket Revenue" value={`€${totalTicketRevenue.toLocaleString()}`} />
          <KPICard
            label="Checked In"
            value={attendance ? `${attendance.checkedIn}/${attendance.total}` : '—'}
          />
          <KPICard
            label="Attendance Rate"
            value={attendance ? `${attendance.rate}%` : '—'}
            subtitle={attendance && attendance.total > 0 ? 'of sold tickets' : undefined}
          />
        </div>

        <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 className="mb-3 text-sm font-semibold">Ticket Sales (Last 30 Days)</h3>
          {ticketSales.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={ticketSales}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis yAxisId="left" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                <Tooltip formatter={(value, name) => name === 'Revenue' ? `€${value}` : value} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} name="Tickets" />
                <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold">Revenue by Tier</h3>
            {revenueByTier.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={revenueByTier}
                    dataKey="revenue"
                    nameKey="tierName"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    label={(entry: any) => entry.tierName}
                  >
                    {revenueByTier.map((_, i) => (
                      <Cell key={i} fill={TIER_COLORS[i % TIER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `€${v}`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-3 text-sm font-semibold">Top Events by Revenue</h3>
            {topEvents.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="divide-y text-sm dark:divide-gray-700">
                {topEvents.map((e, i) => (
                  <div key={e.eventId} className="flex items-center justify-between py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 text-xs text-gray-400">#{i + 1}</span>
                      <span className="truncate font-medium">{e.title}</span>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-3">
                      <span className="text-xs text-gray-500">{e.sold} sold</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        €{Number(e.revenue).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
