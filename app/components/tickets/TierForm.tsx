import { useState } from 'react'

export interface TierFormValues {
  name: string
  description: string
  priceDollars: string
  quantityTotal: string
  salesStartAt: string
  salesEndAt: string
  maxPerUser: string
  sortOrder: string
}

export interface TierFormProps {
  initial?: Partial<TierFormValues>
  onSubmit: (values: TierFormValues) => Promise<void>
  onCancel: () => void
  submitLabel?: string
}

const emptyValues: TierFormValues = {
  name: '',
  description: '',
  priceDollars: '0',
  quantityTotal: '100',
  salesStartAt: '',
  salesEndAt: '',
  maxPerUser: '10',
  sortOrder: '0',
}

export function TierForm({ initial, onSubmit, onCancel, submitLabel = 'Save' }: TierFormProps) {
  const [values, setValues] = useState<TierFormValues>({ ...emptyValues, ...initial })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof TierFormValues>(key: K, value: TierFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!values.name.trim()) return setError('Name is required')
    const price = Number(values.priceDollars)
    if (!Number.isFinite(price) || price < 0) return setError('Invalid price')
    const qty = Number(values.quantityTotal)
    if (!Number.isInteger(qty) || qty < 1) return setError('Invalid quantity')
    const mpu = Number(values.maxPerUser)
    if (!Number.isInteger(mpu) || mpu < 1) return setError('Invalid max per user')

    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (err: any) {
      setError(err?.message || 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="General Admission"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          rows={2}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Price (USD)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            value={values.priceDollars}
            onChange={(e) => set('priceDollars', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Quantity</label>
          <input
            type="number"
            min="1"
            className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            value={values.quantityTotal}
            onChange={(e) => set('quantityTotal', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Sales Start</label>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            value={values.salesStartAt}
            onChange={(e) => set('salesStartAt', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Sales End</label>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            value={values.salesEndAt}
            onChange={(e) => set('salesEndAt', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Max per user</label>
          <input
            type="number"
            min="1"
            className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            value={values.maxPerUser}
            onChange={(e) => set('maxPerUser', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Sort order</label>
          <input
            type="number"
            className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            value={values.sortOrder}
            onChange={(e) => set('sortOrder', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border px-4 py-2 text-sm dark:border-gray-700"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export function toServerPayload(values: TierFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    priceCents: Math.round(Number(values.priceDollars) * 100),
    quantityTotal: Number(values.quantityTotal),
    salesStartAt: values.salesStartAt ? new Date(values.salesStartAt).toISOString() : undefined,
    salesEndAt: values.salesEndAt ? new Date(values.salesEndAt).toISOString() : undefined,
    maxPerUser: Number(values.maxPerUser),
    sortOrder: Number(values.sortOrder),
  }
}
