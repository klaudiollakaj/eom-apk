import { useState } from 'react'

export interface MockPaymentValues {
  cardNumber: string
  expiry: string
  cvc: string
  name: string
}

export interface MockPaymentFormProps {
  values: MockPaymentValues
  onChange: (values: MockPaymentValues) => void
}

export function MockPaymentForm({ values, onChange }: MockPaymentFormProps) {
  function set<K extends keyof MockPaymentValues>(key: K, v: MockPaymentValues[K]) {
    onChange({ ...values, [key]: v })
  }

  return (
    <div className="space-y-3">
      <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
        Demo mode — no real charge. Use any valid-format card number.
      </div>
      <div>
        <label className="block text-sm font-medium">Cardholder Name</label>
        <input
          className="mt-1 w-full rounded border px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Jane Doe"
        />
      </div>
      <div>
        <label className="block text-sm font-medium">Card Number</label>
        <input
          className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900"
          value={values.cardNumber}
          onChange={(e) => set('cardNumber', e.target.value.replace(/[^\d\s]/g, ''))}
          placeholder="4242 4242 4242 4242"
          maxLength={19}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Expiry (MM/YY)</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900"
            value={values.expiry}
            onChange={(e) => set('expiry', e.target.value)}
            placeholder="12/28"
            maxLength={5}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">CVC</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm font-mono dark:border-gray-700 dark:bg-gray-900"
            value={values.cvc}
            onChange={(e) => set('cvc', e.target.value.replace(/\D/g, ''))}
            placeholder="123"
            maxLength={3}
          />
        </div>
      </div>
    </div>
  )
}
