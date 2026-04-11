import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, adminClient } from 'better-auth/client/plugins'
import type { auth } from './auth.server'

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
})

export const { signIn, signUp, signOut, useSession } = authClient

export function useRole() {
  const session = useSession()
  return session.data?.user?.role ?? null
}
