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
