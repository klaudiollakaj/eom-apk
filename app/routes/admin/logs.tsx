import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listLogs } from '~/server/fns/logs'
import { DataTable } from '~/components/ui/DataTable'

const LOG_ACTIONS = [
  'user_created', 'user_updated', 'role_changed',
  'user_activated', 'user_deactivated',
  'user_suspended', 'user_resumed',
  'login', 'logout', 'password_reset',
  'permission_changed', 'capability_granted', 'capability_revoked',
  'nav_link_created', 'nav_link_updated', 'nav_link_deleted',
]

export const Route = createFileRoute('/admin/logs')({
  component: LogsPage,
})

function LogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState<{ logs: any[]; total: number }>({
    logs: [],
    total: 0,
  })

  useEffect(() => {
    listLogs({
      data: {
        page,
        perPage: 50,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    }).then(setData)
  }, [page, action, dateFrom, dateTo])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Activity Logs</h1>

      <div className="flex gap-4">
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        >
          <option value="">All Actions</option>
          {LOG_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
          placeholder="To"
        />
      </div>

      <DataTable
        columns={[
          {
            key: 'createdAt',
            header: 'Timestamp',
            render: (row: any) => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: 'user',
            header: 'User',
            render: (row: any) => row.user ? `${row.user.name} (${row.user.email})` : 'System',
          },
          { key: 'action', header: 'Action' },
          {
            key: 'details',
            header: 'Details',
            render: (row: any) => (
              <pre className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
                {row.details ? JSON.stringify(row.details) : '\u2014'}
              </pre>
            ),
          },
          { key: 'ipAddress', header: 'IP' },
        ]}
        data={data.logs}
        totalCount={data.total}
        page={page}
        perPage={50}
        onPageChange={setPage}
      />
    </div>
  )
}
