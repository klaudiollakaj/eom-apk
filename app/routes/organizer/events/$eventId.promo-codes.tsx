import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { getEvent } from '~/server/fns/events'
import {
  listEventPromoCodes,
  createPromoCode,
  updatePromoCode,
  deletePromoCode,
} from '~/server/fns/promo-codes'

export const Route = createFileRoute('/organizer/events/$eventId/promo-codes')({
  loader: async ({ params }) => {
    const [event, codes] = await Promise.all([
      getEvent({ data: { eventId: params.eventId } }),
      listEventPromoCodes({ data: { eventId: params.eventId } }),
    ])
    return { event, codes }
  },
  component: PromoCodesPage,
})

interface FormValues {
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: string
  maxUses: string
  expiresAt: string
}

const EMPTY_FORM: FormValues = {
  code: '',
  discountType: 'percent',
  discountValue: '',
  maxUses: '',
  expiresAt: '',
}

function promoToForm(p: any): FormValues {
  return {
    code: p.code,
    discountType: p.discountType,
    discountValue:
      p.discountType === 'percent'
        ? String(p.discountValue)
        : (p.discountValue / 100).toFixed(2),
    maxUses: p.maxUses !== null ? String(p.maxUses) : '',
    expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 16) : '',
  }
}

function formatDiscount(p: any) {
  if (p.discountType === 'percent') return `${p.discountValue}% off`
  return `$${(p.discountValue / 100).toFixed(2)} off`
}

function PromoCodesPage() {
  const { event, codes: initial } = Route.useLoaderData()
  const [codes, setCodes] = useState<any[]>(initial)
  const [modal, setModal] = useState<
    { mode: 'create' } | { mode: 'edit'; promo: any } | null
  >(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const fresh = await listEventPromoCodes({ data: { eventId: event.id } })
    setCodes(fresh)
  }

  async function handleSubmit(values: FormValues) {
    setError(null)
    try {
      const numericDiscount =
        values.discountType === 'percent'
          ? parseInt(values.discountValue, 10)
          : Math.round(parseFloat(values.discountValue) * 100)

      if (!Number.isFinite(numericDiscount) || numericDiscount < 1) {
        setError('Discount value must be at least 1.')
        return
      }
      if (values.discountType === 'percent' && numericDiscount > 100) {
        setError('Percent discount cannot exceed 100.')
        return
      }

      const maxUses = values.maxUses.trim() ? parseInt(values.maxUses, 10) : null
      const expiresAt = values.expiresAt ? new Date(values.expiresAt).toISOString() : null

      if (modal?.mode === 'create') {
        await createPromoCode({
          data: {
            eventId: event.id,
            code: values.code,
            discountType: values.discountType,
            discountValue: numericDiscount,
            maxUses,
            expiresAt,
          },
        })
      } else if (modal?.mode === 'edit') {
        await updatePromoCode({
          data: {
            promoCodeId: modal.promo.id,
            discountType: values.discountType,
            discountValue: numericDiscount,
            maxUses,
            expiresAt,
          },
        })
      }
      setModal(null)
      await refresh()
    } catch (err: any) {
      setError(
        err?.message === 'CODE_ALREADY_EXISTS'
          ? 'A promo code with that name already exists for this event.'
          : err?.message || 'Failed to save',
      )
    }
  }

  async function handleDelete(promoId: string) {
    if (!confirm('Delete this promo code?')) return
    try {
      await deletePromoCode({ data: { promoCodeId: promoId } })
      await refresh()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete')
    }
  }

  async function handleToggle(promoId: string, isActive: boolean) {
    await updatePromoCode({ data: { promoCodeId: promoId, isActive } })
    await refresh()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Promo Codes</p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/organizer/events/$eventId/tickets"
            params={{ eventId: event.id }}
            className="rounded border px-3 py-2 text-sm dark:border-gray-700"
          >
            Ticket Tiers
          </Link>
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            + Create Promo Code
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {codes.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed p-10 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            No promo codes yet. Create one to offer discounts at checkout.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Code</th>
                <th className="px-4 py-3 text-left font-medium">Discount</th>
                <th className="px-4 py-3 text-left font-medium">Usage</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {codes.map((p) => (
                <tr key={p.id} className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                  <td className="px-4 py-3">{formatDiscount(p)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.usedCount}
                    {p.maxUses !== null ? ` / ${p.maxUses}` : ' / ∞'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={p.isActive}
                        onChange={(e) => handleToggle(p.id, e.target.checked)}
                      />
                      <span
                        className={
                          p.isActive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-500'
                        }
                      >
                        {p.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setModal({ mode: 'edit', promo: p })}
                        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
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
        <PromoCodeModal
          mode={modal.mode}
          initial={modal.mode === 'edit' ? promoToForm(modal.promo) : EMPTY_FORM}
          onCancel={() => {
            setModal(null)
            setError(null)
          }}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  )
}

function PromoCodeModal({
  mode,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: 'create' | 'edit'
  initial: FormValues
  onCancel: () => void
  onSubmit: (v: FormValues) => void | Promise<void>
}) {
  const [values, setValues] = useState<FormValues>(initial)
  const [submitting, setSubmitting] = useState(false)

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-bold">
          {mode === 'create' ? 'Create Promo Code' : 'Edit Promo Code'}
        </h2>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Code</label>
            <input
              type="text"
              required
              disabled={mode === 'edit'}
              value={values.code}
              onChange={(e) =>
                setValues({ ...values, code: e.target.value.toUpperCase() })
              }
              placeholder="SUMMER25"
              className="w-full rounded border px-3 py-2 font-mono text-sm dark:border-gray-700 dark:bg-gray-800 disabled:opacity-60"
            />
            {mode === 'edit' && (
              <p className="mt-1 text-xs text-gray-500">Code cannot be changed.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Discount type</label>
              <select
                value={values.discountType}
                onChange={(e) =>
                  setValues({
                    ...values,
                    discountType: e.target.value as 'percent' | 'fixed',
                  })
                }
                className="w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed ($)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Value {values.discountType === 'percent' ? '(%)' : '($)'}
              </label>
              <input
                type="number"
                required
                min={values.discountType === 'percent' ? 1 : 0.01}
                max={values.discountType === 'percent' ? 100 : undefined}
                step={values.discountType === 'percent' ? 1 : 0.01}
                value={values.discountValue}
                onChange={(e) => setValues({ ...values, discountValue: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Max uses (optional)</label>
              <input
                type="number"
                min={1}
                value={values.maxUses}
                onChange={(e) => setValues({ ...values, maxUses: e.target.value })}
                placeholder="Unlimited"
                className="w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expires (optional)</label>
              <input
                type="datetime-local"
                value={values.expiresAt}
                onChange={(e) => setValues({ ...values, expiresAt: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border px-4 py-2 text-sm dark:border-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
