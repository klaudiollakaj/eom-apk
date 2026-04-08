export function EmptyChart({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center">
      <p className="text-sm text-gray-400 dark:text-gray-500">{message}</p>
    </div>
  )
}
