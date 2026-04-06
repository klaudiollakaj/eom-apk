import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { signIn } from '~/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const DASHBOARD_ROUTES: Record<string, string> = {
  user: '/dashboard',
  organizer: '/organizer',
  distributor: '/distributor',
  sponsor: '/sponsor',
  negotiator: '/negotiator',
  service_provider: '/service-provider',
  marketing_agency: '/marketing',
  staff: '/staff',
  admin: '/admin',
  superadmin: '/admin',
}

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn.email({ email, password })
      if (result.error) {
        if (result.error.message === 'ACCOUNT_DEACTIVATED') {
          setError('Your account has been deactivated. Contact support.')
        } else {
          setError(result.error.message || 'Invalid email or password.')
        }
        setLoading(false)
        return
      }
      // Redirect unverified users to verify-email page
      if (result.data?.user && !result.data.user.emailVerified) {
        navigate({ to: '/verify-email', search: { email } })
        return
      }
      // Redirect based on role
      const role = result.data?.user?.role ?? 'user'
      const dashboardRoute = DASHBOARD_ROUTES[role] ?? '/dashboard'
      navigate({ to: dashboardRoute })
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">Login</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 flex justify-between text-sm">
          <Link to="/register" className="text-indigo-600 hover:underline">
            Create account
          </Link>
          <Link
            to="/forgot-password"
            className="text-indigo-600 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>
    </div>
  )
}
