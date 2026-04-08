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
  archived: '#cbd5e1',
}

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
                <Tooltip formatter={(v: number) => `€${v}`} />
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
    </div>
  )
}
