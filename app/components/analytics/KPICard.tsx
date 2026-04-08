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
