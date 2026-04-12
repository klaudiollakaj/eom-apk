import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: 'string' as const, defaultValue: 'user', input: false },
        isActive: { type: 'boolean' as const, defaultValue: true, input: false },
        isSuspended: { type: 'boolean' as const, defaultValue: false, input: false },
      },
    }),
    adminClient(),
  ],
})

export const { signIn, signUp, signOut, useSession } = authClient

export function useRole() {
  const session = useSession()
  return session.data?.user?.role ?? null
}
