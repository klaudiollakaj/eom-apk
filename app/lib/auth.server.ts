import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { APIError } from 'better-auth/api'
import { db } from './db.server'
import * as schema from './schema'
import { users } from './schema'
import { sendEmail } from './email.server'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Reset your password',
        text: `Reset your password: ${url}`,
      })
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: 'Verify your email',
        text: `Verify your email: ${url}`,
      })
    },
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'user',
        input: false,
      },
      isActive: {
        type: 'boolean',
        defaultValue: true,
        input: false,
      },
      isSuspended: {
        type: 'boolean',
        defaultValue: false,
        input: false,
      },
    },
  },
  plugins: [admin()],
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Auto-create empty user_profiles row for every new user
          // (covers both self-registration and admin-created users)
          const { userProfiles } = await import('./schema')
          await db.insert(userProfiles).values({ userId: user.id }).onConflictDoNothing()
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db.query.users.findFirst({
            where: eq(users.id, session.userId),
          })
          if (!user?.isActive) {
            throw new APIError('FORBIDDEN', {
              message: 'ACCOUNT_DEACTIVATED',
            })
          }
        },
      },
    },
  },
})
