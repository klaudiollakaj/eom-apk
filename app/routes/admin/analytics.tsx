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

      {kpis && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Total Users" value={kpis.totalUsers} delta={`+${kpis.newUsers} this period`} />
          <KPICard label="Published Events" value={kpis.publishedEvents} delta={`+${kpis.newEvents} this period`} />
          <KPICard label="Active Services" value={kpis.activeServices} delta={`+${kpis.newServices} this period`} />
          <KPICard label="Deals Closed" value={kpis.dealsClosed} subtitle={`€${Number(kpis.totalRevenue).toLocaleString()} total value`} />
        </div>
      )}

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
