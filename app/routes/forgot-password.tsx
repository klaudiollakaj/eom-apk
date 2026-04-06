import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await authClient.forgetPassword({ email, redirectTo: '/reset-password' })
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold">Check Your Email</h1>
          <p className="text-gray-600 dark:text-gray-400">
            If an account exists with that email, we sent a password reset link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold">
          Forgot Password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700"
          >
            Send Reset Link
          </button>
        </form>
      </div>
    </div>
  )
}
