import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../app/lib/schema'

async function main() {
  let email = process.env.SUPERADMIN_EMAIL || ''
  let password = process.env.SUPERADMIN_PASSWORD || ''

  if (!email || !password) {
    const { input, password: passwordPrompt } = await import(
      '@inquirer/prompts'
    )
    if (!email) {
      email = await input({ message: 'Superadmin email:' })
    }
    if (!password) {
      password = await passwordPrompt({ message: 'Superadmin password:' })
    }
  }

  if (!email || !password) {
    console.error('Email and password are required.')
    process.exit(1)
  }

  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  // Check if superadmin already exists
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.role, 'superadmin'),
  })

  if (existing) {
    console.log('Superadmin already exists:', existing.email)
    await client.end()
    return
  }

  // Use Better Auth's API to create the user (handles password hashing)
  const { betterAuth } = await import('better-auth')
  const { drizzleAdapter } = await import('better-auth/adapters/drizzle')
  const { admin } = await import('better-auth/plugins')

  const authInstance = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    emailAndPassword: { enabled: true },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
        isActive: { type: 'boolean', defaultValue: true, input: false },
        isSuspended: { type: 'boolean', defaultValue: false, input: false },
      },
    },
    plugins: [admin()],
  })

  // Sign up the user via Better Auth API
  const result = await authInstance.api.signUpEmail({
    body: { name: 'Superadmin', email, password },
  })

  if (!result?.user?.id) {
    console.error('Failed to create superadmin user.')
    await client.end()
    process.exit(1)
  }

  // Update role to superadmin and set as verified
  await db
    .update(schema.users)
    .set({
      role: 'superadmin',
      emailVerified: true,
      isActive: true,
    })
    .where(eq(schema.users.id, result.user.id))

  // Profile is auto-created by databaseHooks.user.create.after
  // No explicit insert needed here

  // Log the creation
  await db.insert(schema.userLogs).values({
    userId: result.user.id,
    action: 'user_created',
    details: { role: 'superadmin', createdBy: 'seeder' },
  })

  console.log('Superadmin created:', email)
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
