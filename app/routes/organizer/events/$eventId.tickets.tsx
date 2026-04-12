import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getEvent } from '~/server/fns/events'
import {
  listEventTiers,
  createTier,
  updateTier,
  deleteTier,
  toggleTierActive,
} from '~/server/fns/tickets'
import { TierForm, toServerPayload, type TierFormValues } from '~/components/tickets/TierForm'

export const Route = createFileRoute('/organizer/events/$eventId/tickets')({
  loader: async ({ params }) => {
    const [event, tiers] = await Promise.all([
      getEvent({ data: { eventId: params.eventId } }),
      listEventTiers({ data: { eventId: params.eventId, includeInactive: true } }),
    ])
    return { event, tiers }
  },
  component: TierManagementPage,
})

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function tierToFormValues(t: any): TierFormValues {
  return {
    name: t.name,
    description: t.description ?? '',
    priceDollars: (t.priceCents / 100).toString(),
    quantityTotal: String(t.quantityTotal),
    salesStartAt: t.salesStartAt
      ? new Date(t.salesStartAt).toISOString().slice(0, 16)
      : '',
    salesEndAt: t.salesEndAt
      ? new Date(t.salesEndAt).toISOString().slice(0, 16)
      : '',
    maxPerUser: String(t.maxPerUser),
    sortOrder: String(t.sortOrder),
  }
}

function TierManagementPage() {
  const { event, tiers: initialTiers } = Route.useLoaderData()
  const [tiers, setTiers] = useState<any[]>(initialTiers)
  const [modal, setModal] = useState<
    { mode: 'create' } | { mode: 'edit'; tier: any } | null
  >(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function refresh() {
    const fresh = await listEventTiers({
      data: { eventId: event.id, includeInactive: true },
    })
    setTiers(fresh)
  }

  async function handleCreate(values: TierFormValues) {
    await createTier({
      data: { eventId: event.id, ...toServerPayload(values) },
    })
    setModal(null)
    await refresh()
  }

  async function handleUpdate(tierId: string, values: TierFormValues) {
    await updateTier({
      data: { tierId, ...toServerPayload(values) },
    })
    setModal(null)
    await refresh()
  }

  async function handleDelete(tierId: string) {
    setDeleteError(null)
    if (!confirm('Delete this tier? This cannot be undone.')) return
    try {
      await deleteTier({ data: { tierId } })
      await refresh()
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete')
    }
  }

  async function handleToggle(tierId: string, isActive: boolean) {
    await toggleTierActive({ data: { tierId, isActive } })
    await refresh()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ticket Tiers</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/organizer/events/$eventId/sales"
            params={{ eventId: event.id }}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            View Sales
          </Link>
          <Link
            to="/organizer/events/$eventId/promo-codes"
            params={{ eventId: event.id }}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            Promo Codes
          </Link>
          <Link
            to="/organizer/events/$eventId/edit"
            params={{ eventId: event.id }}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            Edit Event
          </Link>
          <Link
            to="/organizer/events/$eventId/invites"
            params={{ eventId: event.id }}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            Invites
          </Link>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            + Create Tier
          </button>
        </div>
      </div>

      {deleteError && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {deleteError === 'HAS_SALES'
            ? 'Cannot delete: this tier already has ticket sales.'
            : deleteError}
        </div>
      )}

      {tiers.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed p-10 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            No ticket tiers yet. Create your first tier to start selling tickets.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Price</th>
                <th className="px-4 py-3 text-left font-medium">Sold / Total</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {tiers.map((tier) => (
                <tr key={tier.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3">
                    <div className="font-medium">{tier.name}</div>
                    {tier.description && (
                      <div className="text-xs text-gray-500">{tier.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tier.priceCents === 0 ? 'Free' : formatPrice(tier.priceCents)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {tier.quantitySold} / {tier.quantityTotal}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={tier.isActive}
                        onChange={(e) => handleToggle(tier.id, e.target.checked)}
                      />
                      <span
                        className={
                          tier.isActive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500'
                        }
                      >
                        {tier.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setModal({ mode: 'edit', tier })}
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(tier.id)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-bold">
              {modal.mode === 'create' ? 'Create Ticket Tier' : 'Edit Ticket Tier'}
            </h2>
            <TierForm
              initial={modal.mode === 'edit' ? tierToFormValues(modal.tier) : undefined}
              submitLabel={modal.mode === 'create' ? 'Create' : 'Update'}
              onCancel={() => setModal(null)}
              onSubmit={(values) =>
                modal.mode === 'create'
                  ? handleCreate(values)
                  : handleUpdate(modal.tier.id, values)
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
