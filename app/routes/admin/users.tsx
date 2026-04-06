import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { DataTable } from '~/components/ui/DataTable'
import { RoleBadge } from '~/components/ui/RoleBadge'
import { StatusBadge, getUserStatus } from '~/components/ui/StatusBadge'
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  toggleSuspension,
} from '~/server/fns/admin'
import { useSession } from '~/lib/auth-client'
import { ROLES, BUSINESS_ROLES, type Role } from '~/lib/permissions'

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
})

function UsersPage() {
  const session = useSession()
  const actorRole = (session.data?.user?.role ?? 'admin') as Role
  const isSuperadmin = actorRole === 'superadmin'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [data, setData] = useState<{ users: any[]; total: number }>({
    users: [],
    total: 0,
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchUsers() {
    setLoading(true)
    const result = await listUsers({
      data: { page, perPage: 20, search, roleFilter, statusFilter },
    })
    setData(result)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search, roleFilter, statusFilter])

  const creatableRolesList = isSuperadmin
    ? ROLES.filter((r) => r !== 'superadmin')
    : ROLES.filter((r) => r !== 'admin' && r !== 'superadmin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {showCreateForm && (
        <CreateUserForm
          roles={creatableRolesList}
          onCreated={() => {
            setShowCreateForm(false)
            fetchUsers()
          }}
        />
      )}

      <div className="flex gap-4">
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'email', header: 'Email' },
          {
            key: 'role',
            header: 'Role',
            render: (row: any) => <RoleBadge role={row.role} />,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: any) => (
              <StatusBadge status={getUserStatus(row)} />
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row: any) => (
              <UserActions
                user={row}
                isSuperadmin={isSuperadmin}
                onUpdated={fetchUsers}
              />
            ),
          },
        ]}
        data={data.users}
        totalCount={data.total}
        page={page}
        perPage={20}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Search by name or email..."
      />
    </div>
  )
}

function CreateUserForm({
  roles,
  onCreated,
}: {
  roles: Role[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>(roles[0] ?? 'user')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createUser({ data: { name, email, password, role } })
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 space-y-4"
    >
      {error && (
        <div className="rounded bg-red-50 dark:bg-red-900/30 p-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          required
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={8}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create User'}
      </button>
    </form>
  )
}

function UserActions({
  user,
  isSuperadmin,
  onUpdated,
}: {
  user: any
  isSuperadmin: boolean
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const canEdit =
    isSuperadmin ||
    (user.role !== 'admin' && user.role !== 'superadmin')

  if (editing) {
    return (
      <EditUserForm
        user={user}
        isSuperadmin={isSuperadmin}
        onDone={() => {
          setEditing(false)
          onUpdated()
        }}
      />
    )
  }

  return (
    <div className="flex gap-2">
      {canEdit && (
        <>
          <button
            onClick={() => setEditing(true)}
            className="rounded bg-indigo-100 dark:bg-indigo-900 px-2 py-1 text-xs text-indigo-700 dark:text-indigo-300"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              await toggleUserStatus({
                data: { id: user.id, active: !user.isActive },
              })
              onUpdated()
            }}
            className={`rounded px-2 py-1 text-xs ${
              user.isActive
                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
            }`}
          >
            {user.isActive ? 'Deactivate' : 'Activate'}
          </button>

          {user.isActive &&
            BUSINESS_ROLES.includes(user.role) && (
              <button
                onClick={async () => {
                  await toggleSuspension({
                    data: {
                      userId: user.id,
                      suspended: !user.isSuspended,
                    },
                  })
                  onUpdated()
                }}
                className={`rounded px-2 py-1 text-xs ${
                  user.isSuspended
                    ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-400'
                }`}
              >
                {user.isSuspended ? 'Resume' : 'Suspend'}
              </button>
            )}

          {(user.role === 'staff' || user.role === 'admin') && (
            <Link
              to={`/admin/users/${user.id}/caps`}
              className="rounded bg-purple-100 dark:bg-purple-900 px-2 py-1 text-xs text-purple-700 dark:text-purple-300"
            >
              Capabilities
            </Link>
          )}
        </>
      )}
    </div>
  )
}

function EditUserForm({
  user,
  isSuperadmin,
  onDone,
}: {
  user: any
  isSuperadmin: boolean
  onDone: () => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const editableRoles = isSuperadmin
    ? ROLES.filter((r) => r !== 'superadmin')
    : ROLES.filter((r) => r !== 'admin' && r !== 'superadmin')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await updateUser({ data: { id: user.id, name, email, role } })
      onDone()
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-xs"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-xs"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border dark:border-gray-600 dark:bg-gray-700 dark:text-white px-2 py-1 text-xs"
      >
        {editableRoles.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border dark:border-gray-600 px-2 py-1 text-xs dark:text-gray-300"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
