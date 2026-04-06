import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { signUp } from '~/lib/auth-client'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordChecks = useMemo(() => ({
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }), [password])

  const passwordValid = Object.values(passwordChecks).every(Boolean)
  const nameValid = name.trim().length >= 2
  const formValid = passwordValid && nameValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signUp.email({ name, email, password })
      if (result.error) {
        setError(result.error.message || 'Registration failed.')
        setLoading(false)
        return
      }
      navigate({ to: '/verify-email', search: { email } })
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold">Create Account</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              minLength={2}
            />
            {name.length > 0 && !nameValid && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                ○ At least 2 characters
              </p>
            )}
          </div>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-md border px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            {password.length > 0 && (
              <div className="mt-2 space-y-1 text-xs">
                <p className={passwordChecks.minLength ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                  {passwordChecks.minLength ? '✓' : '○'} At least 8 characters
                </p>
                <p className={passwordChecks.hasUppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                  {passwordChecks.hasUppercase ? '✓' : '○'} At least one uppercase letter
                </p>
                <p className={passwordChecks.hasLowercase ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                  {passwordChecks.hasLowercase ? '✓' : '○'} At least one lowercase letter
                </p>
                <p className={passwordChecks.hasNumber ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}>
                  {passwordChecks.hasNumber ? '✓' : '○'} At least one number
                </p>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !formValid}
            className="w-full rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline dark:text-indigo-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
