import { createFileRoute } from '@tanstack/react-router'
import { unsubscribeNewsletter } from '~/server/fns/newsletter'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/newsletter/unsubscribe')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || '',
  }),
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const { token } = Route.useSearch()
  const [status, setStatus] = useState<'loading' | 'unsubscribed' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    unsubscribeNewsletter({ data: { token } })
      .then(() => setStatus('unsubscribed'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
        {status === 'loading' && <p className="text-gray-500">Processing...</p>}
        {status === 'unsubscribed' && (
          <>
            <h1 className="mb-2 text-2xl font-bold">Unsubscribed</h1>
            <p className="text-gray-600 dark:text-gray-400">You've been unsubscribed from our newsletter.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 className="mb-2 text-2xl font-bold text-red-600">Invalid Link</h1>
            <p className="text-gray-600 dark:text-gray-400">This unsubscribe link is invalid.</p>
          </>
        )}
      </div>
    </div>
  )
}
