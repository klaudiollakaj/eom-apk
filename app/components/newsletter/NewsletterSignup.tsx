import { useState } from 'react'
import { subscribeNewsletter } from '~/server/fns/newsletter'

export function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return

    setStatus('loading')
    try {
      const result = await subscribeNewsletter({ data: { email } })
      setStatus('success')
      if (result.status === 'already_subscribed') {
        setMessage('You\'re already subscribed!')
      } else if (result.status === 'resubscribed') {
        setMessage('Welcome back! You\'ve been resubscribed.')
      } else {
        setMessage('Check your email to confirm your subscription.')
      }
      setEmail('')
    } catch {
      setStatus('error')
      setMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="rounded-xl bg-indigo-600 p-8 text-center text-white">
      <h2 className="text-2xl font-bold">Stay Updated</h2>
      <p className="mx-auto mt-2 max-w-md text-indigo-100">
        Get notified about new events, exclusive offers, and community updates.
      </p>
      {status === 'success' ? (
        <p className="mt-4 rounded bg-white/20 px-4 py-2 text-sm">{message}</p>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto mt-4 flex max-w-md gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            className="flex-1 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-lg bg-white px-6 py-2 font-medium text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
          >
            {status === 'loading' ? 'Subscribing...' : 'Subscribe'}
          </button>
        </form>
      )}
      {status === 'error' && (
        <p className="mt-2 text-sm text-red-200">{message}</p>
      )}
    </div>
  )
}
