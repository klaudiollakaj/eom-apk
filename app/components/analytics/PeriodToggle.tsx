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
