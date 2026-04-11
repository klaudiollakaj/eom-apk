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

      {analytics && (
        <div className="grid grid-cols-4 gap-4">
          <KPICard label="Total Revenue" value={`€${Number(analytics.totalRevenue).toLocaleString()}`} subtitle="from accepted deals" />
          <KPICard label="Avg Deal Value" value={Number(analytics.avgDealValue) > 0 ? `€${Number(analytics.avgDealValue).toLocaleString()}` : '—'} />
          <KPICard label="Success Rate" value={analytics.successRate > 0 ? `${analytics.successRate}%` : '—'} />
          <KPICard label="Avg Rounds" value={analytics.avgRounds > 0 ? analytics.avgRounds : '—'} subtitle="per negotiation" />
        </div>
      )}

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
                <Tooltip formatter={(v) => `€${v}`} />
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
