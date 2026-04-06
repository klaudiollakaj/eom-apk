import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/verify-email')({
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) ?? '',
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const { email } = Route.useSearch()
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    if (!email) return
    setLoading(true)
    try {
      await authClient.sendVerificationEmail({
        email,
        callbackURL: '/login',
      })
      setResent(true)
    } catch {
      // Silently fail — don't reveal if email exists
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
        <h1 className="mb-4 text-2xl font-bold">Check Your Email</h1>
        <p className="text-gray-600 dark:text-gray-400">
          We sent a verification link to your email address. Please click the
          link to verify your account.
        </p>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Didn't receive the email?{' '}
          {resent ? (
            <span className="text-green-600 dark:text-green-400">Verification email sent!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
            >
              {loading ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
