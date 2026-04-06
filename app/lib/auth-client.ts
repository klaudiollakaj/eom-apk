import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient

export function useRole() {
  const session = useSession()
  return session.data?.user?.role ?? null
}
