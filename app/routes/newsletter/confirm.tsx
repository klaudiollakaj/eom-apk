import { createFileRoute } from '@tanstack/react-router'
import { confirmNewsletter } from '~/server/fns/newsletter'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/newsletter/confirm')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || '',
  }),
  component: ConfirmPage,
})

function ConfirmPage() {
  const { token } = Route.useSearch()
  const [status, setStatus] = useState<'loading' | 'confirmed' | 'already_confirmed' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    confirmNewsletter({ data: { token } })
      .then((r) => setStatus(r.status))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
        {status === 'loading' && <p className="text-gray-500">Confirming...</p>}
        {status === 'confirmed' && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-green-600">Subscribed!</h1>
            <p className="text-gray-600 dark:text-gray-400">Your newsletter subscription is confirmed.</p>
          </>
        )}
        {status === 'already_confirmed' && (
          <>
            <h1 className="mb-2 text-2xl font-bold">Already Confirmed</h1>
            <p className="text-gray-600 dark:text-gray-400">Your subscription was already confirmed.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-red-600">Invalid Link</h1>
            <p className="text-gray-600 dark:text-gray-400">This confirmation link is invalid or expired.</p>
          </>
        )}
      </div>
    </div>
  )
}
