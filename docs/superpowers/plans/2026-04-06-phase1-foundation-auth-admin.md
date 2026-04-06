# Phase 1: Foundation + Auth + Admin — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the EOM platform — replace SQLite with PostgreSQL, configure Better Auth with 10 roles and granular capabilities, build the admin panel, and establish layouts/routing for all roles.

**Architecture:** TanStack Start full-stack app with PostgreSQL via Docker Compose, Better Auth for authentication with 10 roles, Drizzle ORM for database access, and a capability-gated admin panel. Server functions handle all mutations; route guards protect pages.

**Tech Stack:** TanStack Start (React 19, Vinxi), PostgreSQL 16, Drizzle ORM (postgres.js), Better Auth, Tailwind CSS v4, Zod, nodemailer + Mailpit (dev email)

**Spec:** `docs/superpowers/specs/2026-04-06-phase1-foundation-auth-admin-design.md`

---

## Chunk 1: Infrastructure & Database

### Task 1: Docker Compose & Environment

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env` (from example, gitignored)
- Modify: `.gitignore`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: eom
      POSTGRES_PASSWORD: eom
      POSTGRES_DB: eom
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U eom"]
      interval: 5s
      timeout: 3s
      retries: 5

  mailpit:
    image: axllent/mailpit:latest
    ports:
      - "1025:1025"
      - "8025:8025"
    environment:
      MP_MAX_MESSAGES: 100
      MP_SMTP_AUTH_ACCEPT_ANY: true
      MP_SMTP_AUTH_ALLOW_INSECURE: true

volumes:
  pgdata:
```

Note: The `app` service from the spec is omitted for now — during development we run the app locally with `npm run dev`. The Dockerfile and app service are added in Task 13.

- [ ] **Step 2: Create `.env.example`**

```env
# Database
DATABASE_URL=postgresql://eom:eom@localhost:5432/eom

# Auth
BETTER_AUTH_SECRET=change-me-to-a-random-string
BETTER_AUTH_URL=http://localhost:3000

# Seeder (CI/CD only — never commit values)
SUPERADMIN_EMAIL=
SUPERADMIN_PASSWORD=

# Email (dev — Mailpit SMTP; replaced by Resend in Phase 7)
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=noreply@eom.local
```

- [ ] **Step 3: Copy `.env.example` to `.env` and fill in values**

```bash
cp .env.example .env
# Edit .env: set BETTER_AUTH_SECRET to a random string (e.g. openssl rand -base64 32)
```

- [ ] **Step 4: Update `.gitignore`**

Add these lines (some may already exist):
```
*.env
*.env.local
.env
```

- [ ] **Step 5: Start Docker services and verify**

```bash
docker compose up -d
docker compose ps
# Expected: postgres (healthy), mailpit (running)
# Verify Mailpit UI: open http://localhost:8025
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "feat: add Docker Compose with PostgreSQL and Mailpit"
```

---

### Task 2: SQLite → PostgreSQL Migration

**Files:**
- Remove: `db/schema.ts`
- Remove: `db/index.ts`
- Remove: `drizzle.config.ts` (will be recreated)
- Modify: `package.json` (swap dependencies)
- Create: `app/lib/db.ts`
- Create: `app/lib/schema.ts` (empty for now — full schema in Task 3)
- Modify: `drizzle.config.ts` (new PostgreSQL config)

- [ ] **Step 1: Remove SQLite dependencies**

```bash
npm uninstall better-sqlite3
```

- [ ] **Step 2: Install PostgreSQL dependencies**

```bash
npm install postgres
```

- [ ] **Step 3: Delete old SQLite files**

```bash
rm -rf db/
rm -f db.sqlite db.sqlite-wal db.sqlite-shm
```

- [ ] **Step 4: Create `app/lib/db.ts`**

```typescript
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

- [ ] **Step 5: Create empty `app/lib/schema.ts`** (placeholder — filled in Task 3)

```typescript
// Schema will be defined in Task 3
export {}
```

- [ ] **Step 6: Overwrite `drizzle.config.ts`**

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './app/lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- [ ] **Step 7: Update `app/lib/auth.ts`** — change import path and adapter

Replace the current content with this temporary placeholder (full auth config comes in Task 5):

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { db } from './db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [admin()],
})
```

- [ ] **Step 8: Delete old drizzle migrations if any**

```bash
rm -rf drizzle/
```

- [ ] **Step 9: Verify the app still compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (or only errors from the empty schema export, which is fine).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: migrate from SQLite to PostgreSQL (postgres.js + Drizzle)"
```

---

### Task 3: Database Schema

**Files:**
- Modify: `app/lib/schema.ts` (full schema)

- [ ] **Step 1: Write the complete schema in `app/lib/schema.ts`**

```typescript
import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  date,
  unique,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ============================================================
// Auth Tables (managed by Better Auth)
// ============================================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  isSuspended: boolean('is_suspended').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ============================================================
// Domain Tables
// ============================================================

export const userProfiles = pgTable('user_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  phone: text('phone'),
  bio: text('bio'),
  dateOfBirth: date('date_of_birth'),
  location: text('location'),
  avatarUrl: text('avatar_url'),
  companyName: text('company_name'),
  nipt: text('nipt'),
  qkb: text('qkb'),
  operatingField: text('operating_field'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const userLogs = pgTable('user_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const navigationLinks = pgTable('navigation_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text('label').notNull(),
  url: text('url').notNull(),
  position: text('position').notNull(), // 'header' | 'footer' | 'both'
  sortOrder: integer('sort_order').notNull(),
  isVisible: boolean('is_visible').notNull().default(true),
  isExternal: boolean('is_external').notNull().default(false),
  isDeletable: boolean('is_deletable').notNull().default(true),
  isPublishable: boolean('is_publishable').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const publishingPermissions = pgTable(
  'publishing_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    role: text('role').notNull(),
    targetPage: text('target_page').notNull(),
    canPublish: boolean('can_publish').notNull().default(true),
    grantedBy: text('granted_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.role, table.targetPage)],
)

export const userCapabilities = pgTable(
  'user_capabilities',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    capability: text('capability').notNull(),
    granted: boolean('granted').notNull().default(true),
    grantedBy: text('granted_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.capability)],
)

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  logs: many(userLogs),
  capabilities: many(userCapabilities),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}))

export const userLogsRelations = relations(userLogs, ({ one }) => ({
  user: one(users, {
    fields: [userLogs.userId],
    references: [users.id],
  }),
}))

export const userCapabilitiesRelations = relations(
  userCapabilities,
  ({ one }) => ({
    user: one(users, {
      fields: [userCapabilities.userId],
      references: [users.id],
    }),
  }),
)
```

- [ ] **Step 2: Generate the Drizzle migration**

```bash
npx drizzle-kit generate
```

Expected: Migration file created in `drizzle/` directory.

- [ ] **Step 3: Run the migration**

```bash
npx drizzle-kit migrate
```

Expected: Tables created in PostgreSQL. Verify with:
```bash
docker compose exec postgres psql -U eom -d eom -c "\dt"
```
Expected output: 9 tables listed (users, sessions, accounts, verifications, user_profiles, user_logs, navigation_links, publishing_permissions, user_capabilities).

- [ ] **Step 4: Commit**

```bash
git add app/lib/schema.ts drizzle/
git commit -m "feat: add complete Phase 1 database schema with migrations"
```

---

### Task 4: Email Helper

**Files:**
- Create: `app/lib/email.ts`

- [ ] **Step 1: Install nodemailer**

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

- [ ] **Step 2: Create `app/lib/email.ts`**

```typescript
import { createTransport } from 'nodemailer'

const transporter = createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
})

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eom.local',
    to,
    subject,
    text,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/lib/email.ts package.json package-lock.json
git commit -m "feat: add email helper with nodemailer (Mailpit SMTP for dev)"
```

---

## Chunk 2: Auth, Permissions & Scripts

### Task 5: Better Auth Configuration

**Files:**
- Modify: `app/lib/auth.ts` (full config)
- Modify: `app/lib/auth-client.ts` (add useRole)

- [ ] **Step 1: Write the full `app/lib/auth.ts`**

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { eq } from 'drizzle-orm'
import { APIError } from 'better-auth/api'
import { db } from './db'
import { users } from './schema'
import { sendEmail } from './email'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
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
```

- [ ] **Step 2: Update `app/lib/auth-client.ts`**

```typescript
import { createAuthClient } from 'better-auth/react'

export const authClient = createAuthClient()

export const { signIn, signUp, signOut, useSession } = authClient

export function useRole() {
  const session = useSession()
  return session.data?.user?.role ?? null
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/lib/auth.ts app/lib/auth-client.ts
git commit -m "feat: configure Better Auth with 10 roles, deactivation hook, email verification"
```

---

### Task 6: Permissions Helper

**Files:**
- Create: `app/lib/permissions.ts`

- [ ] **Step 1: Create `app/lib/permissions.ts`**

```typescript
import { and, eq } from 'drizzle-orm'
import { db } from './db'
import { userCapabilities } from './schema'

export type Role =
  | 'user'
  | 'organizer'
  | 'distributor'
  | 'sponsor'
  | 'negotiator'
  | 'service_provider'
  | 'marketing_agency'
  | 'staff'
  | 'admin'
  | 'superadmin'

export const ROLES: Role[] = [
  'user',
  'organizer',
  'distributor',
  'sponsor',
  'negotiator',
  'service_provider',
  'marketing_agency',
  'staff',
  'admin',
  'superadmin',
]

export const BUSINESS_ROLES: Role[] = [
  'organizer',
  'distributor',
  'sponsor',
  'service_provider',
  'marketing_agency',
  'negotiator',
]

const ADMIN_ROLES: Role[] = ['admin', 'superadmin']

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}

export function isSuperadmin(role: Role): boolean {
  return role === 'superadmin'
}

export function isBusinessRole(role: Role): boolean {
  return BUSINESS_ROLES.includes(role)
}

export async function hasCapability(
  userId: string,
  role: Role,
  capability: string,
): Promise<boolean> {
  if (role === 'superadmin') return true
  const record = await db.query.userCapabilities.findFirst({
    where: and(
      eq(userCapabilities.userId, userId),
      eq(userCapabilities.capability, capability),
      eq(userCapabilities.granted, true),
    ),
  })
  return !!record
}

export async function requireCapability(
  session: { user: { id: string; role: string } },
  capability: string,
) {
  const has = await hasCapability(
    session.user.id,
    session.user.role as Role,
    capability,
  )
  if (!has) throw new Error('FORBIDDEN')
}

/** Roles an admin of the given role is allowed to create */
export function creatableRoles(actorRole: Role): Role[] {
  if (actorRole === 'superadmin') {
    return ROLES.filter((r) => r !== 'superadmin')
  }
  if (actorRole === 'admin') {
    return ROLES.filter((r) => r !== 'admin' && r !== 'superadmin')
  }
  return []
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/permissions.ts
git commit -m "feat: add permissions helper with role checks and capability system"
```

---

### Task 7: Auth Server Helpers

**Files:**
- Create: `app/server/fns/auth-helpers.ts`

- [ ] **Step 1: Create `app/server/fns/auth-helpers.ts`**

`getSession` must be a `createServerFn` because it is called from route `beforeLoad` hooks, which run on the client during client-side navigations. Plain server functions would fail in that context.

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { getHeaders } from '@tanstack/react-start/server'
import { auth } from '~/lib/auth'
import { isAdmin } from '~/lib/permissions'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    return auth.api.getSession({ headers: getHeaders() })
  },
)

export async function requireAuth() {
  const session = await getSession()
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

export async function requireAdmin() {
  const session = await requireAuth()
  if (!isAdmin(session.user.role)) throw new Error('FORBIDDEN')
  return session
}
```

Note: `requireAuth` and `requireAdmin` are plain functions called only from other server functions (never from route hooks), so they don't need `createServerFn`.

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/auth-helpers.ts
git commit -m "feat: add auth server helpers (getSession, requireAuth, requireAdmin)"
```

---

### Task 8: Seeder Scripts

**Files:**
- Create: `scripts/migrate.ts`
- Create: `scripts/seed-superadmin.ts`
- Create: `scripts/seed-navigation.ts`
- Modify: `package.json` (add script entries)

- [ ] **Step 1: Install inquirer prompts**

```bash
npm install -D @inquirer/prompts
```

- [ ] **Step 2: Create `scripts/migrate.ts`**

```typescript
import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client)
  console.log('Running migrations...')
  await migrate(db, { migrationsFolder: './drizzle' })
  console.log('Migrations complete.')
  await client.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Create `scripts/seed-superadmin.ts`**

```typescript
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
  // For seeding, we create directly and use the auth context
  const { betterAuth } = await import('better-auth')
  const { drizzleAdapter } = await import('better-auth/adapters/drizzle')
  const { admin } = await import('better-auth/plugins')

  const authInstance = betterAuth({
    database: drizzleAdapter(db, { provider: 'pg' }),
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

  // Create empty profile
  await db.insert(schema.userProfiles).values({
    userId: result.user.id,
  })

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
```

- [ ] **Step 4: Create `scripts/seed-navigation.ts`**

```typescript
import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../app/lib/schema'

const CORE_LINKS = [
  {
    label: 'Home',
    url: '/',
    position: 'both',
    sortOrder: 1,
    isDeletable: false,
    isPublishable: false,
  },
  {
    label: 'Events',
    url: '/events',
    position: 'both',
    sortOrder: 2,
    isDeletable: false,
    isPublishable: true,
  },
  {
    label: 'News',
    url: '/posts',
    position: 'header',
    sortOrder: 3,
    isDeletable: false,
    isPublishable: true,
  },
  {
    label: 'FAQ',
    url: '/faq',
    position: 'header',
    sortOrder: 4,
    isDeletable: false,
    isPublishable: false,
  },
  {
    label: 'Login',
    url: '/login',
    position: 'header',
    sortOrder: 5,
    isDeletable: false,
    isPublishable: false,
  },
  {
    label: 'Contact',
    url: '/contact',
    position: 'footer',
    sortOrder: 6,
    isDeletable: false,
    isPublishable: false,
  },
]

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  for (const link of CORE_LINKS) {
    const existing = await db.query.navigationLinks.findFirst({
      where: eq(schema.navigationLinks.url, link.url),
    })
    if (existing) {
      console.log(`Skipping existing link: ${link.label} (${link.url})`)
      continue
    }
    await db.insert(schema.navigationLinks).values(link)
    console.log(`Created link: ${link.label} (${link.url})`)
  }

  console.log('Navigation seeding complete.')
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 5: Install dotenv for scripts**

```bash
npm install -D dotenv
```

- [ ] **Step 6: Add npm scripts to `package.json`**

Add to `"scripts"`:
```json
"db:seed:superadmin": "npx tsx scripts/seed-superadmin.ts",
"db:seed:navigation": "npx tsx scripts/seed-navigation.ts",
"db:seed": "npm run db:seed:superadmin && npm run db:seed:navigation"
```

Also add `tsx` as dev dependency if not present:
```bash
npm install -D tsx
```

- [ ] **Step 7: Run seeds and verify**

```bash
npm run db:generate
npm run db:migrate
npm run db:seed:navigation
# For superadmin, set env vars or use interactive prompts:
SUPERADMIN_EMAIL=admin@eom.local SUPERADMIN_PASSWORD=admin123 npm run db:seed:superadmin
```

Verify:
```bash
docker compose exec postgres psql -U eom -d eom -c "SELECT id, email, role FROM users;"
docker compose exec postgres psql -U eom -d eom -c "SELECT label, url, position FROM navigation_links;"
```

- [ ] **Step 8: Commit**

```bash
git add scripts/ package.json package-lock.json
git commit -m "feat: add migration and seed scripts (superadmin + navigation links)"
```

---

## Chunk 3: Shared Components & Layouts

### Task 9: Shared UI Components

**Files:**
- Create: `app/components/ui/RoleBadge.tsx`
- Create: `app/components/ui/DataTable.tsx`
- Create: `app/components/ui/StatusBadge.tsx`

- [ ] **Step 1: Create `app/components/ui/RoleBadge.tsx`**

```tsx
import type { Role } from '~/lib/permissions'

const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  user: { bg: 'bg-blue-100', text: 'text-blue-800' },
  organizer: { bg: 'bg-orange-100', text: 'text-orange-800' },
  distributor: { bg: 'bg-green-100', text: 'text-green-800' },
  sponsor: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  negotiator: { bg: 'bg-pink-100', text: 'text-pink-800' },
  service_provider: { bg: 'bg-sky-100', text: 'text-sky-800' },
  marketing_agency: { bg: 'bg-purple-100', text: 'text-purple-800' },
  staff: { bg: 'bg-amber-100', text: 'text-amber-800' },
  admin: { bg: 'bg-red-100', text: 'text-red-800' },
  superadmin: { bg: 'bg-red-200', text: 'text-red-900' },
}

const ROLE_LABELS: Record<Role, string> = {
  user: 'User',
  organizer: 'Organizer',
  distributor: 'Distributor',
  sponsor: 'Sponsor',
  negotiator: 'Negotiator',
  service_provider: 'Service Provider',
  marketing_agency: 'Marketing Agency',
  staff: 'Staff',
  admin: 'Admin',
  superadmin: 'Superadmin',
}

export function RoleBadge({ role }: { role: Role }) {
  const colors = ROLE_COLORS[role] ?? { bg: 'bg-gray-100', text: 'text-gray-800' }
  const label = ROLE_LABELS[role] ?? role
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Create `app/components/ui/StatusBadge.tsx`**

```tsx
type Status = 'active' | 'inactive' | 'suspended'

const STATUS_STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
  inactive: { bg: 'bg-red-100', text: 'text-red-800', label: 'Inactive' },
  suspended: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Suspended' },
}

export function StatusBadge({ status }: { status: Status }) {
  const style = STATUS_STYLES[status]
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  )
}

export function getUserStatus(user: {
  isActive: boolean
  isSuspended: boolean
}): Status {
  if (!user.isActive) return 'inactive'
  if (user.isSuspended) return 'suspended'
  return 'active'
}
```

- [ ] **Step 3: Create `app/components/ui/DataTable.tsx`**

```tsx
import { useState } from 'react'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  totalCount: number
  page: number
  perPage: number
  onPageChange: (page: number) => void
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  totalCount,
  page,
  perPage,
  onPageChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
}: DataTableProps<T>) {
  const totalPages = Math.ceil(totalCount / perPage)

  return (
    <div className="space-y-4">
      {onSearchChange && (
        <input
          type="text"
          value={searchValue ?? ''}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-gray-500"
                >
                  No results found.
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.key} className="whitespace-nowrap px-4 py-3 text-sm">
                      {col.render
                        ? col.render(row)
                        : String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {(page - 1) * perPage + 1}–
            {Math.min(page * perPage, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/components/ui/
git commit -m "feat: add shared UI components (RoleBadge, StatusBadge, DataTable)"
```

---

### Task 10: Layout Components

**Files:**
- Create: `app/components/layout/Header.tsx`
- Create: `app/components/layout/Footer.tsx`
- Create: `app/components/layout/UserDropdown.tsx`
- Create: `app/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Create `app/components/layout/UserDropdown.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { signOut, useSession } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'
import { useState } from 'react'

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

export function UserDropdown() {
  const session = useSession()
  const [open, setOpen] = useState(false)

  if (!session.data?.user) return null

  const user = session.data.user
  const dashboardRoute = DASHBOARD_ROUTES[user.role] ?? '/dashboard'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-gray-100"
      >
        <span>{user.name}</span>
        <RoleBadge role={user.role as Role} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-md border bg-white py-1 shadow-lg">
          <Link
            to={dashboardRoute}
            className="block px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            My Dashboard
          </Link>
          <Link
            to="/profile"
            className="block px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <button
            onClick={() => {
              signOut()
              setOpen(false)
            }}
            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/components/layout/Header.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { useSession } from '~/lib/auth-client'
import { UserDropdown } from './UserDropdown'

interface NavLink {
  id: string
  label: string
  url: string
  isExternal: boolean
}

export function Header({ links }: { links: NavLink[] }) {
  const session = useSession()

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-indigo-600">
          EOM
        </Link>

        <nav className="flex items-center gap-6">
          {links.map((link) =>
            link.isExternal ? (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.id}
                to={link.url}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                {link.label}
              </Link>
            ),
          )}

          {session.data?.user ? (
            <UserDropdown />
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Create `app/components/layout/Footer.tsx`**

```tsx
import { Link } from '@tanstack/react-router'

interface NavLink {
  id: string
  label: string
  url: string
  isExternal: boolean
}

export function Footer({ links }: { links: NavLink[] }) {
  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} EOM — Event Of Mine
          </p>
          <nav className="flex gap-4">
            {links.map((link) =>
              link.isExternal ? (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.id}
                  to={link.url}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Create `app/components/layout/AdminSidebar.tsx`**

```tsx
import { Link, useLocation } from '@tanstack/react-router'
import { useSession } from '~/lib/auth-client'
import { useEffect, useState } from 'react'

interface SidebarItem {
  label: string
  href: string
  capability: string | null // null = always visible
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dashboard', href: '/admin', capability: null },
  { label: 'Users', href: '/admin/users', capability: 'admin:users:manage' },
  { label: 'Logs', href: '/admin/logs', capability: 'admin:logs:view' },
  {
    label: 'Navigation',
    href: '/admin/navigation',
    capability: 'admin:navigation:manage',
  },
  {
    label: 'Permissions',
    href: '/admin/permissions',
    capability: 'admin:permissions:manage',
  },
  {
    label: 'Capabilities',
    href: '/admin/capabilities',
    capability: 'admin:capabilities:manage',
  },
]

export function AdminSidebar({
  capabilities,
}: {
  capabilities: string[]
}) {
  const location = useLocation()
  const session = useSession()
  const isSuperadmin = session.data?.user?.role === 'superadmin'

  const visibleItems = SIDEBAR_ITEMS.filter(
    (item) =>
      item.capability === null ||
      isSuperadmin ||
      capabilities.includes(item.capability),
  )

  return (
    <aside className="w-64 border-r bg-gray-50">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
      </div>
      <nav className="space-y-1 px-2">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                isActive
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/components/layout/
git commit -m "feat: add layout components (Header, Footer, UserDropdown, AdminSidebar)"
```

---

## Chunk 4: Auth Routes & Navigation Server Functions

### Task 11: Navigation Server Functions

**Files:**
- Create: `app/server/fns/navigation.ts`

- [ ] **Step 1: Create `app/server/fns/navigation.ts`**

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { navigationLinks, userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions'

export const getNavLinks = createServerFn({ method: 'GET' })
  .validator((input: { position: 'header' | 'footer' }) => input)
  .handler(async ({ data }) => {
    const links = await db.query.navigationLinks.findMany({
      where: and(
        eq(navigationLinks.isVisible, true),
        // 'both' matches both header and footer
      ),
      orderBy: [asc(navigationLinks.sortOrder)],
    })

    return links.filter(
      (link) =>
        link.position === data.position || link.position === 'both',
    )
  })

export const listAllNavLinks = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    return db.query.navigationLinks.findMany({
      orderBy: [asc(navigationLinks.sortOrder)],
    })
  },
)

export const createNavLink = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      label: string
      url: string
      position: string
      sortOrder: number
      isExternal: boolean
      isPublishable: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    const [link] = await db
      .insert(navigationLinks)
      .values(data)
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'nav_link_created',
      details: { linkId: link.id, label: data.label, url: data.url },
    })

    return link
  })

export const updateNavLink = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      id: string
      label?: string
      url?: string
      position?: string
      sortOrder?: number
      isVisible?: boolean
      isExternal?: boolean
      isPublishable?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    const { id, ...updates } = data
    const [link] = await db
      .update(navigationLinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(navigationLinks.id, id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'nav_link_updated',
      details: { linkId: id, updates },
    })

    return link
  })

export const deleteNavLink = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    const link = await db.query.navigationLinks.findFirst({
      where: eq(navigationLinks.id, data.id),
    })

    if (!link) throw new Error('NOT_FOUND')
    if (!link.isDeletable) throw new Error('CANNOT_DELETE_CORE_LINK')

    await db
      .delete(navigationLinks)
      .where(eq(navigationLinks.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'nav_link_deleted',
      details: { linkId: data.id, label: link.label, url: link.url },
    })
  })
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/navigation.ts
git commit -m "feat: add navigation server functions (CRUD + logging)"
```

---

### Task 12: Auth Routes

**Files:**
- Create: `app/routes/login.tsx`
- Create: `app/routes/register.tsx`
- Create: `app/routes/forgot-password.tsx`
- Create: `app/routes/reset-password.tsx`
- Create: `app/routes/verify-email.tsx`

- [ ] **Step 1: Create `app/routes/login.tsx`**

```tsx
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
        navigate({ to: '/verify-email' })
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
```

- [ ] **Step 2: Create `app/routes/register.tsx`**

```tsx
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
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
      navigate({ to: '/verify-email' })
    } catch {
      setError('An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">Create Account</h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
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
              minLength={8}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/routes/verify-email.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/verify-email')({
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const [resent, setResent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleResend() {
    setLoading(true)
    try {
      await authClient.sendVerificationEmail({
        email: '', // Better Auth uses the current session's email
        callbackURL: '/login',
      })
      setResent(true)
    } catch {
      // Silently fail — don't reveal if email exists
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
        <h1 className="mb-4 text-2xl font-bold">Check Your Email</h1>
        <p className="text-gray-600">
          We sent a verification link to your email address. Please click the
          link to verify your account.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Didn't receive the email?{' '}
          {resent ? (
            <span className="text-green-600">Verification email sent!</span>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-indigo-600 hover:underline disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Resend verification email'}
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create `app/routes/forgot-password.tsx`**

```tsx
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <h1 className="mb-4 text-2xl font-bold">Check Your Email</h1>
          <p className="text-gray-600">
            If an account exists with that email, we sent a password reset link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">
          Forgot Password
        </h1>
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
```

- [ ] **Step 5: Create `app/routes/reset-password.tsx`**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setError('')
    setLoading(true)

    try {
      await authClient.resetPassword({ newPassword: password })
      navigate({ to: '/login' })
    } catch {
      setError('Failed to reset password. The link may have expired.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-center text-2xl font-bold">
          Reset Password
        </h1>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-indigo-600 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/routes/login.tsx app/routes/register.tsx app/routes/verify-email.tsx app/routes/forgot-password.tsx app/routes/reset-password.tsx
git commit -m "feat: add auth routes (login, register, forgot/reset password, verify email)"
```

---

## Chunk 5: Admin Server Functions

### Task 13: Admin Server Functions

**Files:**
- Create: `app/server/fns/admin.ts`
- Create: `app/server/fns/logs.ts`
- Create: `app/server/fns/capabilities.ts`
- Create: `app/server/fns/permissions.ts`

- [ ] **Step 1: Create `app/server/fns/admin.ts`**

This is the largest server function file. It contains user management (list, create, update, toggle status, bulk operations, suspension).

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { eq, and, or, like, count, desc, inArray } from 'drizzle-orm'
import { db } from '~/lib/db'
import { users, userProfiles, userLogs, sessions } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import {
  requireCapability,
  isSuperadmin,
  isBusinessRole,
  creatableRoles,
  type Role,
} from '~/lib/permissions'
import { auth } from '~/lib/auth'

export const listUsers = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      page: number
      perPage: number
      search?: string
      roleFilter?: string
      statusFilter?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    const conditions = []

    if (data.search) {
      conditions.push(
        or(
          like(users.name, `%${data.search}%`),
          like(users.email, `%${data.search}%`),
        ),
      )
    }

    if (data.roleFilter) {
      conditions.push(eq(users.role, data.roleFilter))
    }

    if (data.statusFilter === 'active') {
      conditions.push(
        and(eq(users.isActive, true), eq(users.isSuspended, false)),
      )
    } else if (data.statusFilter === 'inactive') {
      conditions.push(eq(users.isActive, false))
    } else if (data.statusFilter === 'suspended') {
      conditions.push(
        and(eq(users.isActive, true), eq(users.isSuspended, true)),
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [userList, [{ total }]] = await Promise.all([
      db.query.users.findMany({
        where,
        with: { profile: true },
        orderBy: [desc(users.createdAt)],
        limit: data.perPage,
        offset: (data.page - 1) * data.perPage,
      }),
      db.select({ total: count() }).from(users).where(where),
    ])

    return { users: userList, total }
  })

export const createUser = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      name: string
      email: string
      password: string
      role: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    const actorRole = session.user.role as Role
    const targetRole = data.role as Role
    const allowed = creatableRoles(actorRole)

    if (!allowed.includes(targetRole)) {
      throw new Error('FORBIDDEN: Cannot create this role')
    }

    // Create user via Better Auth admin API
    const result = await auth.api.signUpEmail({
      body: { name: data.name, email: data.email, password: data.password },
    })

    if (!result?.user?.id) {
      throw new Error('Failed to create user')
    }

    // Set role and mark email as verified (admin-created users)
    await db
      .update(users)
      .set({ role: targetRole, emailVerified: true })
      .where(eq(users.id, result.user.id))

    // Create empty profile
    await db.insert(userProfiles).values({ userId: result.user.id })

    // Log
    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'user_created',
      details: {
        createdUserId: result.user.id,
        role: targetRole,
        email: data.email,
      },
    })

    return { id: result.user.id }
  })

export const updateUser = createServerFn({ method: 'POST' })
  .validator(
    (input: { id: string; name?: string; email?: string; role?: string }) =>
      input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.id),
    })
    if (!target) throw new Error('NOT_FOUND')

    // Self-protection: cannot demote yourself
    if (data.id === session.user.id && data.role && data.role !== target.role) {
      throw new Error('FORBIDDEN: Cannot change your own role')
    }

    // Admin cannot edit Admin or Superadmin users
    const actorRole = session.user.role as Role
    if (
      !isSuperadmin(actorRole) &&
      (target.role === 'admin' || target.role === 'superadmin')
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can edit admin accounts')
    }

    // Role change to admin requires Superadmin
    if (data.role === 'admin' && !isSuperadmin(actorRole)) {
      throw new Error('FORBIDDEN: Only Superadmin can assign admin role')
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name) updates.name = data.name
    if (data.email) updates.email = data.email

    const logDetails: Record<string, unknown> = { targetUserId: data.id }

    if (data.role && data.role !== target.role) {
      updates.role = data.role
      logDetails.oldRole = target.role
      logDetails.newRole = data.role

      await db.insert(userLogs).values({
        userId: session.user.id,
        action: 'role_changed',
        details: logDetails,
      })
    }

    await db.update(users).set(updates).where(eq(users.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'user_updated',
      details: logDetails,
    })
  })

export const toggleUserStatus = createServerFn({ method: 'POST' })
  .validator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    // Self-protection
    if (data.id === session.user.id) {
      throw new Error('FORBIDDEN: Cannot change your own status')
    }

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.id),
    })
    if (!target) throw new Error('NOT_FOUND')

    // Last superadmin protection
    if (target.role === 'superadmin' && !data.active) {
      const [{ total }] = await db
        .select({ total: count() })
        .from(users)
        .where(
          and(eq(users.role, 'superadmin'), eq(users.isActive, true)),
        )
      if (total <= 1) throw new Error('LAST_SUPERADMIN')
    }

    // Admin cannot deactivate Admin/Superadmin users
    if (
      !isSuperadmin(session.user.role as Role) &&
      (target.role === 'admin' || target.role === 'superadmin')
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can change admin status')
    }

    await db
      .update(users)
      .set({ isActive: data.active, updatedAt: new Date() })
      .where(eq(users.id, data.id))

    // Invalidate sessions when deactivating
    if (!data.active) {
      await db.delete(sessions).where(eq(sessions.userId, data.id))
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.active ? 'user_activated' : 'user_deactivated',
      details: { targetUserId: data.id },
    })
  })

export const toggleSuspension = createServerFn({ method: 'POST' })
  .validator((input: { userId: string; suspended: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:suspend:manage')

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })
    if (!target) throw new Error('NOT_FOUND')

    if (!isBusinessRole(target.role as Role)) {
      throw new Error('INVALID_ROLE_FOR_SUSPENSION')
    }

    await db
      .update(users)
      .set({ isSuspended: data.suspended, updatedAt: new Date() })
      .where(eq(users.id, data.userId))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.suspended ? 'user_suspended' : 'user_resumed',
      details: { targetUserId: data.userId },
    })
  })

export const bulkUpdateRole = createServerFn({ method: 'POST' })
  .validator((input: { userIds: string[]; role: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    if (
      data.role === 'admin' &&
      !isSuperadmin(session.user.role as Role)
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can assign admin role')
    }

    if (data.role === 'superadmin') {
      throw new Error('FORBIDDEN: Cannot assign superadmin role')
    }

    for (const userId of data.userIds) {
      if (userId === session.user.id) continue // skip self

      const target = await db.query.users.findFirst({
        where: eq(users.id, userId),
      })
      if (!target) continue

      // Admin cannot change role of admin/superadmin users
      if (
        !isSuperadmin(session.user.role as Role) &&
        (target.role === 'admin' || target.role === 'superadmin')
      ) {
        continue // skip — only Superadmin can modify admin accounts
      }

      await db
        .update(users)
        .set({ role: data.role, updatedAt: new Date() })
        .where(eq(users.id, userId))

      await db.insert(userLogs).values({
        userId: session.user.id,
        action: 'role_changed',
        details: {
          targetUserId: userId,
          oldRole: target.role,
          newRole: data.role,
        },
      })
    }
  })

export const bulkToggleStatus = createServerFn({ method: 'POST' })
  .validator((input: { userIds: string[]; active: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:users:manage')

    for (const userId of data.userIds) {
      if (userId === session.user.id) continue // skip self

      await db
        .update(users)
        .set({ isActive: data.active, updatedAt: new Date() })
        .where(eq(users.id, userId))

      if (!data.active) {
        await db.delete(sessions).where(eq(sessions.userId, userId))
      }

      await db.insert(userLogs).values({
        userId: session.user.id,
        action: data.active ? 'user_activated' : 'user_deactivated',
        details: { targetUserId: userId },
      })
    }
  })
```

- [ ] **Step 2: Create `app/server/fns/logs.ts`**

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { eq, and, gte, lte, desc, count } from 'drizzle-orm'
import { db } from '~/lib/db'
import { userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions'

export const listLogs = createServerFn({ method: 'GET' })
  .validator(
    (input: {
      page: number
      perPage: number
      userId?: string
      action?: string
      dateFrom?: string
      dateTo?: string
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:logs:view')

    const conditions = []

    if (data.userId) {
      conditions.push(eq(userLogs.userId, data.userId))
    }
    if (data.action) {
      conditions.push(eq(userLogs.action, data.action))
    }
    if (data.dateFrom) {
      conditions.push(gte(userLogs.createdAt, new Date(data.dateFrom)))
    }
    if (data.dateTo) {
      conditions.push(lte(userLogs.createdAt, new Date(data.dateTo)))
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [logs, [{ total }]] = await Promise.all([
      db.query.userLogs.findMany({
        where,
        with: { user: true },
        orderBy: [desc(userLogs.createdAt)],
        limit: data.perPage,
        offset: (data.page - 1) * data.perPage,
      }),
      db.select({ total: count() }).from(userLogs).where(where),
    ])

    return { logs, total }
  })
```

- [ ] **Step 3: Create `app/server/fns/capabilities.ts`**

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { eq, and, count } from 'drizzle-orm'
import { db } from '~/lib/db'
import { userCapabilities, userLogs, users } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import {
  requireCapability,
  isSuperadmin,
  type Role,
} from '~/lib/permissions'

export const getUserCapabilities = createServerFn({ method: 'GET' })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })
    if (!target) throw new Error('NOT_FOUND')

    // For Admin-role targets, only Superadmin can view
    if (
      target.role === 'admin' &&
      !isSuperadmin(session.user.role as Role)
    ) {
      throw new Error('FORBIDDEN')
    }

    await requireCapability(session, 'admin:capabilities:manage')

    return db.query.userCapabilities.findMany({
      where: eq(userCapabilities.userId, data.userId),
    })
  })

export const updateUserCapability = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      userId: string
      capability: string
      granted: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const target = await db.query.users.findFirst({
      where: eq(users.id, data.userId),
    })
    if (!target) throw new Error('NOT_FOUND')

    if (
      target.role === 'admin' &&
      !isSuperadmin(session.user.role as Role)
    ) {
      throw new Error('FORBIDDEN: Only Superadmin can manage admin capabilities')
    }

    await requireCapability(session, 'admin:capabilities:manage')

    // Validate capability key against registry
    const VALID_CAPABILITY_PREFIXES = [
      'pages:edit:',
      'economics:view',
      'economics:export',
      'stats:view',
      'stats:export',
      'admin:users:manage',
      'admin:logs:view',
      'admin:navigation:manage',
      'admin:permissions:manage',
      'admin:capabilities:manage',
      'admin:suspend:manage',
      'admin:ads:manage',
      'admin:coupons:manage',
      'admin:viewer:access',
    ]
    const isValidKey = VALID_CAPABILITY_PREFIXES.some(
      (prefix) =>
        data.capability === prefix || data.capability.startsWith(prefix),
    )
    if (!isValidKey) {
      throw new Error('INVALID_CAPABILITY_KEY')
    }

    // Upsert
    const existing = await db.query.userCapabilities.findFirst({
      where: and(
        eq(userCapabilities.userId, data.userId),
        eq(userCapabilities.capability, data.capability),
      ),
    })

    if (existing) {
      await db
        .update(userCapabilities)
        .set({
          granted: data.granted,
          grantedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(userCapabilities.id, existing.id))
    } else {
      await db.insert(userCapabilities).values({
        userId: data.userId,
        capability: data.capability,
        granted: data.granted,
        grantedBy: session.user.id,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: data.granted ? 'capability_granted' : 'capability_revoked',
      details: {
        targetUserId: data.userId,
        capability: data.capability,
      },
    })
  })

export const getMyCapabilities = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    if (isSuperadmin(session.user.role as Role)) {
      return { all: true, capabilities: [] }
    }

    const caps = await db.query.userCapabilities.findMany({
      where: and(
        eq(userCapabilities.userId, session.user.id),
        eq(userCapabilities.granted, true),
      ),
    })

    return {
      all: false,
      capabilities: caps.map((c) => c.capability),
    }
  },
)

export const listUsersWithCapabilities = createServerFn({ method: 'GET' })
  .validator((input: { roleFilter?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:capabilities:manage')

    const allCaps = await db.query.userCapabilities.findMany({
      where: eq(userCapabilities.granted, true),
      with: { user: true },
    })

    // Group by user
    const userMap = new Map<
      string,
      { user: typeof allCaps[0]['user']; capabilities: string[] }
    >()

    for (const cap of allCaps) {
      if (!cap.user) continue
      // Admin can't see other Admin capabilities
      if (
        cap.user.role === 'admin' &&
        !isSuperadmin(session.user.role as Role)
      ) {
        continue
      }
      if (data.roleFilter && cap.user.role !== data.roleFilter) continue

      const existing = userMap.get(cap.userId)
      if (existing) {
        existing.capabilities.push(cap.capability)
      } else {
        userMap.set(cap.userId, {
          user: cap.user,
          capabilities: [cap.capability],
        })
      }
    }

    return Array.from(userMap.values())
  })
```

- [ ] **Step 4: Create `app/server/fns/permissions.ts`**

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { eq, and } from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  publishingPermissions,
  navigationLinks,
  userLogs,
} from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import {
  requireCapability,
  isAdmin,
  type Role,
} from '~/lib/permissions'

export const getPublishingPermissions = createServerFn({
  method: 'GET',
}).handler(async () => {
  const session = await requireAuth()
  await requireCapability(session, 'admin:permissions:manage')

  const [perms, pages] = await Promise.all([
    db.query.publishingPermissions.findMany(),
    db.query.navigationLinks.findMany({
      where: eq(navigationLinks.isPublishable, true),
    }),
  ])

  return { permissions: perms, publishablePages: pages }
})

export const updatePublishingPermission = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      role: string
      targetPage: string
      canPublish: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:permissions:manage')

    const existing = await db.query.publishingPermissions.findFirst({
      where: and(
        eq(publishingPermissions.role, data.role),
        eq(publishingPermissions.targetPage, data.targetPage),
      ),
    })

    if (existing) {
      await db
        .update(publishingPermissions)
        .set({
          canPublish: data.canPublish,
          grantedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(publishingPermissions.id, existing.id))
    } else {
      await db.insert(publishingPermissions).values({
        role: data.role,
        targetPage: data.targetPage,
        canPublish: data.canPublish,
        grantedBy: session.user.id,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'permission_changed',
      details: data,
    })
  })

export const getMyPublishingPermissions = createServerFn({
  method: 'GET',
}).handler(async () => {
  const session = await requireAuth()

  if (isAdmin(session.user.role as Role)) {
    const pages = await db.query.navigationLinks.findMany({
      where: eq(navigationLinks.isPublishable, true),
    })
    return pages.map((p) => p.url)
  }

  const perms = await db.query.publishingPermissions.findMany({
    where: and(
      eq(publishingPermissions.role, session.user.role),
      eq(publishingPermissions.canPublish, true),
    ),
  })

  return perms.map((p) => p.targetPage)
})
```

- [ ] **Step 5: Commit**

```bash
git add app/server/fns/admin.ts app/server/fns/logs.ts app/server/fns/capabilities.ts app/server/fns/permissions.ts
git commit -m "feat: add all admin server functions (users, logs, capabilities, permissions)"
```

---

## Chunk 6: Admin Pages

### Task 14: Admin Layout Route

**Files:**
- Create: `app/routes/admin/route.tsx`
- Create: `app/routes/admin/index.tsx`

- [ ] **Step 1: Create `app/routes/admin/route.tsx`**

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AdminSidebar } from '~/components/layout/AdminSidebar'
import { getMyCapabilities } from '~/server/fns/capabilities'
import { getSession } from '~/server/fns/auth-helpers'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
    const role = session.user.role
    if (role !== 'admin' && role !== 'superadmin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  loader: async () => {
    const result = await getMyCapabilities()
    return { capabilities: result.all ? 'all' : result.capabilities }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { capabilities } = Route.useLoaderData()
  const capList =
    capabilities === 'all'
      ? [
          'admin:users:manage',
          'admin:logs:view',
          'admin:navigation:manage',
          'admin:permissions:manage',
          'admin:capabilities:manage',
          'admin:suspend:manage',
        ]
      : (capabilities as string[])

  return (
    <div className="flex min-h-screen">
      <AdminSidebar capabilities={capList} />
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/server/fns/dashboard.ts`** — server functions for dashboard stats

```typescript
import { createServerFn } from '@tanstack/react-start/server'
import { eq, and, gte, count, desc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { users, userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { hasCapability, type Role } from '~/lib/permissions'

export const getDashboardStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    const role = session.user.role as Role
    const userId = session.user.id

    const result: {
      totalUsers?: number
      usersByRole?: Record<string, number>
      recentUsers?: { id: string; name: string; email: string; role: string; createdAt: Date }[]
      recentLogs?: { id: string; action: string; createdAt: Date; user?: { name: string } | null }[]
    } = {}

    // Users stats — only if has admin:users:manage
    if (await hasCapability(userId, role, 'admin:users:manage')) {
      const [{ total }] = await db.select({ total: count() }).from(users)
      result.totalUsers = total

      const allUsers = await db.query.users.findMany({
        columns: { role: true },
      })
      result.usersByRole = {}
      for (const u of allUsers) {
        result.usersByRole[u.role] = (result.usersByRole[u.role] || 0) + 1
      }

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      result.recentUsers = await db.query.users.findMany({
        where: gte(users.createdAt, sevenDaysAgo),
        orderBy: [desc(users.createdAt)],
        limit: 10,
        columns: { id: true, name: true, email: true, role: true, createdAt: true },
      })
    }

    // Logs — only if has admin:logs:view
    if (await hasCapability(userId, role, 'admin:logs:view')) {
      result.recentLogs = await db.query.userLogs.findMany({
        orderBy: [desc(userLogs.createdAt)],
        limit: 10,
        with: { user: { columns: { name: true } } },
      })
    }

    return result
  },
)
```

- [ ] **Step 3: Create `app/routes/admin/index.tsx`** — capability-gated dashboard

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getDashboardStats } from '~/server/fns/dashboard'
import { useSession } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

function AdminDashboard() {
  const session = useSession()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    getDashboardStats().then(setStats)
  }, [])

  if (!stats) return <p>Loading...</p>

  const hasAnyStats =
    stats.totalUsers != null || stats.recentLogs != null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      {!hasAnyStats && (
        <div className="rounded-lg border bg-gray-50 p-6 text-center">
          <p className="text-gray-600">
            Welcome! Contact your Superadmin to get access to admin features.
          </p>
        </div>
      )}

      {stats.totalUsers != null && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-bold">{stats.totalUsers}</p>
          </div>
          {stats.usersByRole &&
            Object.entries(stats.usersByRole).map(([role, ct]) => (
              <div key={role} className="rounded-lg border bg-white p-4">
                <RoleBadge role={role as Role} />
                <p className="mt-1 text-lg font-semibold">{ct as number}</p>
              </div>
            ))}
        </div>
      )}

      {stats.recentUsers && stats.recentUsers.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            Recent Accounts (last 7 days)
          </h2>
          <div className="rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {stats.recentUsers.map((u: any) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 text-sm">{u.name}</td>
                    <td className="px-4 py-2 text-sm">{u.email}</td>
                    <td className="px-4 py-2 text-sm">
                      <RoleBadge role={u.role as Role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {stats.recentLogs && stats.recentLogs.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            Recent Activity (last 10)
          </h2>
          <div className="rounded-lg border">
            <table className="min-w-full divide-y">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Action
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    User
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {stats.recentLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="px-4 py-2 text-sm">{log.action}</td>
                    <td className="px-4 py-2 text-sm">
                      {log.user?.name ?? 'System'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/admin/
git commit -m "feat: add admin layout route with capability-gated sidebar"
```

---

### Task 15: Admin User Management Page

**Files:**
- Create: `app/routes/admin/users.tsx`

- [ ] **Step 1: Create `app/routes/admin/users.tsx`**

This is a large page with list, create form, edit, status toggle, and suspension toggle. Write it as a single route file with inline state management.

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { DataTable } from '~/components/ui/DataTable'
import { RoleBadge } from '~/components/ui/RoleBadge'
import { StatusBadge, getUserStatus } from '~/components/ui/StatusBadge'
import {
  listUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  toggleSuspension,
} from '~/server/fns/admin'
import { useSession } from '~/lib/auth-client'
import { ROLES, BUSINESS_ROLES, type Role } from '~/lib/permissions'

export const Route = createFileRoute('/admin/users')({
  component: UsersPage,
})

function UsersPage() {
  const session = useSession()
  const actorRole = (session.data?.user?.role ?? 'admin') as Role
  const isSuperadmin = actorRole === 'superadmin'

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [data, setData] = useState<{ users: any[]; total: number }>({
    users: [],
    total: 0,
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)

  async function fetchUsers() {
    setLoading(true)
    const result = await listUsers({
      data: { page, perPage: 20, search, roleFilter, statusFilter },
    })
    setData(result)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [page, search, roleFilter, statusFilter])

  const creatableRolesList = isSuperadmin
    ? ROLES.filter((r) => r !== 'superadmin')
    : ROLES.filter((r) => r !== 'admin' && r !== 'superadmin')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          {showCreateForm ? 'Cancel' : 'Create User'}
        </button>
      </div>

      {showCreateForm && (
        <CreateUserForm
          roles={creatableRolesList}
          onCreated={() => {
            setShowCreateForm(false)
            fetchUsers()
          }}
        />
      )}

      <div className="flex gap-4">
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'email', header: 'Email' },
          {
            key: 'role',
            header: 'Role',
            render: (row: any) => <RoleBadge role={row.role} />,
          },
          {
            key: 'status',
            header: 'Status',
            render: (row: any) => (
              <StatusBadge status={getUserStatus(row)} />
            ),
          },
          {
            key: 'actions',
            header: 'Actions',
            render: (row: any) => (
              <UserActions
                user={row}
                isSuperadmin={isSuperadmin}
                onUpdated={fetchUsers}
              />
            ),
          },
        ]}
        data={data.users}
        totalCount={data.total}
        page={page}
        perPage={20}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchPlaceholder="Search by name or email..."
      />
    </div>
  )
}

function CreateUserForm({
  roles,
  onCreated,
}: {
  roles: Role[]
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>(roles[0] ?? 'user')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createUser({ data: { name, email, password, role } })
      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-gray-50 p-4 space-y-4"
    >
      {error && (
        <div className="rounded bg-red-50 p-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Full Name"
          required
          className="rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="rounded-md border px-3 py-2 text-sm"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={8}
          className="rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Creating...' : 'Create User'}
      </button>
    </form>
  )
}

function UserActions({
  user,
  isSuperadmin,
  onUpdated,
}: {
  user: any
  isSuperadmin: boolean
  onUpdated: () => void
}) {
  const [editing, setEditing] = useState(false)
  const canEdit =
    isSuperadmin ||
    (user.role !== 'admin' && user.role !== 'superadmin')

  if (editing) {
    return (
      <EditUserForm
        user={user}
        isSuperadmin={isSuperadmin}
        onDone={() => {
          setEditing(false)
          onUpdated()
        }}
      />
    )
  }

  return (
    <div className="flex gap-2">
      {canEdit && (
        <>
          <button
            onClick={() => setEditing(true)}
            className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700"
          >
            Edit
          </button>
          <button
            onClick={async () => {
              await toggleUserStatus({
                data: { id: user.id, active: !user.isActive },
              })
              onUpdated()
            }}
            className={`rounded px-2 py-1 text-xs ${
              user.isActive
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {user.isActive ? 'Deactivate' : 'Activate'}
          </button>

          {user.isActive &&
            BUSINESS_ROLES.includes(user.role) && (
              <button
                onClick={async () => {
                  await toggleSuspension({
                    data: {
                      userId: user.id,
                      suspended: !user.isSuspended,
                    },
                  })
                  onUpdated()
                }}
                className={`rounded px-2 py-1 text-xs ${
                  user.isSuspended
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {user.isSuspended ? 'Resume' : 'Suspend'}
              </button>
            )}

          {(user.role === 'staff' || user.role === 'admin') && (
            <a
              href={`/admin/users/${user.id}/caps`}
              className="rounded bg-purple-100 px-2 py-1 text-xs text-purple-700"
            >
              Capabilities
            </a>
          )}
        </>
      )}
    </div>
  )
}

function EditUserForm({
  user,
  isSuperadmin,
  onDone,
}: {
  user: any
  isSuperadmin: boolean
  onDone: () => void
}) {
  const [name, setName] = useState(user.name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState(user.role)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const editableRoles = isSuperadmin
    ? ROLES.filter((r) => r !== 'superadmin')
    : ROLES.filter((r) => r !== 'admin' && r !== 'superadmin')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await updateUser({ data: { id: user.id, name, email, role } })
      onDone()
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded border px-2 py-1 text-xs"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border px-2 py-1 text-xs"
      />
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="w-full rounded border px-2 py-1 text-xs"
      >
        {editableRoles.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded border px-2 py-1 text-xs"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/users.tsx
git commit -m "feat: add admin user management page (list, create, status, suspension)"
```

---

### Task 16: Admin Logs Page

**Files:**
- Create: `app/routes/admin/logs.tsx`

- [ ] **Step 1: Create `app/routes/admin/logs.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listLogs } from '~/server/fns/logs'
import { DataTable } from '~/components/ui/DataTable'

const LOG_ACTIONS = [
  'user_created', 'user_updated', 'role_changed',
  'user_activated', 'user_deactivated',
  'user_suspended', 'user_resumed',
  'login', 'logout', 'password_reset',
  'permission_changed', 'capability_granted', 'capability_revoked',
  'nav_link_created', 'nav_link_updated', 'nav_link_deleted',
]

export const Route = createFileRoute('/admin/logs')({
  component: LogsPage,
})

function LogsPage() {
  const [page, setPage] = useState(1)
  const [action, setAction] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [data, setData] = useState<{ logs: any[]; total: number }>({
    logs: [],
    total: 0,
  })

  useEffect(() => {
    listLogs({
      data: {
        page,
        perPage: 50,
        action: action || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      },
    }).then(setData)
  }, [page, action, dateFrom, dateTo])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Activity Logs</h1>

      <div className="flex gap-4">
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1) }}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Actions</option>
          {LOG_ACTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="rounded-md border px-3 py-2 text-sm"
          placeholder="To"
        />
      </div>

      <DataTable
        columns={[
          {
            key: 'createdAt',
            header: 'Timestamp',
            render: (row: any) => new Date(row.createdAt).toLocaleString(),
          },
          {
            key: 'user',
            header: 'User',
            render: (row: any) => row.user ? `${row.user.name} (${row.user.email})` : 'System',
          },
          { key: 'action', header: 'Action' },
          {
            key: 'details',
            header: 'Details',
            render: (row: any) => (
              <pre className="max-w-xs truncate text-xs text-gray-500">
                {row.details ? JSON.stringify(row.details) : '—'}
              </pre>
            ),
          },
          { key: 'ipAddress', header: 'IP' },
        ]}
        data={data.logs}
        totalCount={data.total}
        page={page}
        perPage={50}
        onPageChange={setPage}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/logs.tsx
git commit -m "feat: add admin activity logs page"
```

---

### Task 16b: Admin Navigation Management Page

**Files:**
- Create: `app/routes/admin/navigation.tsx`

- [ ] **Step 1: Create `app/routes/admin/navigation.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  listAllNavLinks,
  createNavLink,
  updateNavLink,
  deleteNavLink,
} from '~/server/fns/navigation'

export const Route = createFileRoute('/admin/navigation')({
  component: NavigationPage,
})

function NavigationPage() {
  const [links, setLinks] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)

  async function fetchLinks() {
    const result = await listAllNavLinks()
    setLinks(result)
  }

  useEffect(() => { fetchLinks() }, [])

  const headerLinks = links.filter(
    (l) => l.position === 'header' || l.position === 'both',
  )
  const footerLinks = links.filter(
    (l) => l.position === 'footer' || l.position === 'both',
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Navigation Management</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
        >
          {showForm ? 'Cancel' : 'Add Link'}
        </button>
      </div>

      {showForm && (
        <NavLinkForm
          onSaved={() => { setShowForm(false); fetchLinks() }}
        />
      )}

      <LinkSection title="Header Links" links={headerLinks} onUpdated={fetchLinks} />
      <LinkSection title="Footer Links" links={footerLinks} onUpdated={fetchLinks} />
    </div>
  )
}

function LinkSection({
  title,
  links,
  onUpdated,
}: {
  title: string
  links: any[]
  onUpdated: () => void
}) {
  return (
    <div>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {links.map((link) => (
          <div
            key={link.id}
            className="flex items-center justify-between rounded-lg border bg-white p-3"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{link.label}</span>
              <span className="text-xs text-gray-500">{link.url}</span>
              {link.isExternal && (
                <span className="rounded bg-blue-100 px-1 text-xs text-blue-700">
                  External
                </span>
              )}
              {link.isPublishable && (
                <span className="rounded bg-green-100 px-1 text-xs text-green-700">
                  Publishable
                </span>
              )}
              <span className="text-xs text-gray-400">
                Order: {link.sortOrder}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  await updateNavLink({
                    data: { id: link.id, isVisible: !link.isVisible },
                  })
                  onUpdated()
                }}
                className={`rounded px-2 py-1 text-xs ${
                  link.isVisible
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {link.isVisible ? 'Visible' : 'Hidden'}
              </button>
              {link.isDeletable && (
                <button
                  onClick={async () => {
                    if (confirm(`Delete "${link.label}"?`)) {
                      await deleteNavLink({ data: { id: link.id } })
                      onUpdated()
                    }
                  }}
                  className="rounded bg-red-100 px-2 py-1 text-xs text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NavLinkForm({ onSaved }: { onSaved: () => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [position, setPosition] = useState('header')
  const [sortOrder, setSortOrder] = useState(10)
  const [isExternal, setIsExternal] = useState(false)
  const [isPublishable, setIsPublishable] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await createNavLink({
      data: { label, url, position, sortOrder, isExternal, isPublishable },
    })
    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-gray-50 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" required className="rounded border px-3 py-2 text-sm" />
        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL (e.g. /about)" required className="rounded border px-3 py-2 text-sm" />
        <select value={position} onChange={(e) => setPosition(e.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="header">Header</option>
          <option value="footer">Footer</option>
          <option value="both">Both</option>
        </select>
        <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="Sort Order" className="rounded border px-3 py-2 text-sm" />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={isExternal} onChange={(e) => setIsExternal(e.target.checked)} /> External
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={isPublishable} onChange={(e) => setIsPublishable(e.target.checked)} /> Publishable
        </label>
      </div>
      <button type="submit" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white">Add Link</button>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/navigation.tsx
git commit -m "feat: add admin navigation management page"
```

---

### Task 16c: Admin Permissions Matrix Page

**Files:**
- Create: `app/routes/admin/permissions.tsx`

- [ ] **Step 1: Create `app/routes/admin/permissions.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getPublishingPermissions,
  updatePublishingPermission,
} from '~/server/fns/permissions'
import { ROLES, type Role } from '~/lib/permissions'

// Roles shown in the matrix (exclude staff — they edit pages, not publish)
const MATRIX_ROLES = ROLES.filter((r) => r !== 'staff')

export const Route = createFileRoute('/admin/permissions')({
  component: PermissionsPage,
})

function PermissionsPage() {
  const [pages, setPages] = useState<any[]>([])
  const [perms, setPerms] = useState<any[]>([])

  async function fetchData() {
    const result = await getPublishingPermissions()
    setPages(result.publishablePages)
    setPerms(result.permissions)
  }

  useEffect(() => { fetchData() }, [])

  function isGranted(role: string, targetPage: string) {
    if (role === 'admin' || role === 'superadmin') return true
    return perms.some(
      (p: any) => p.role === role && p.targetPage === targetPage && p.canPublish,
    )
  }

  async function togglePerm(role: string, targetPage: string) {
    const current = isGranted(role, targetPage)
    await updatePublishingPermission({
      data: { role, targetPage, canPublish: !current },
    })
    fetchData()
  }

  if (pages.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Publishing Permissions</h1>
        <p className="text-gray-500">
          No publishable pages configured. Mark navigation links as
          "publishable" in Navigation Management first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Publishing Permissions</h1>
      <p className="text-sm text-gray-500">
        Control which roles can publish content to each page.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                Role
              </th>
              {pages.map((page: any) => (
                <th
                  key={page.url}
                  className="px-4 py-3 text-center text-xs font-medium text-gray-500"
                >
                  {page.label}
                  <br />
                  <span className="font-normal text-gray-400">
                    {page.url}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {MATRIX_ROLES.map((role) => {
              const isAdminRole = role === 'admin' || role === 'superadmin'
              return (
                <tr key={role}>
                  <td className="px-4 py-3 text-sm font-medium">{role}</td>
                  {pages.map((page: any) => (
                    <td key={page.url} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isGranted(role, page.url)}
                        disabled={isAdminRole}
                        onChange={() => togglePerm(role, page.url)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/permissions.tsx
git commit -m "feat: add admin publishing permissions matrix page"
```

---

### Task 16d: Admin Capabilities Overview Page

**Files:**
- Create: `app/routes/admin/capabilities.tsx`

- [ ] **Step 1: Create `app/routes/admin/capabilities.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listUsersWithCapabilities } from '~/server/fns/capabilities'
import { RoleBadge } from '~/components/ui/RoleBadge'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/admin/capabilities')({
  component: CapabilitiesPage,
})

function CapabilitiesPage() {
  const [roleFilter, setRoleFilter] = useState('')
  const [data, setData] = useState<any[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  useEffect(() => {
    listUsersWithCapabilities({
      data: { roleFilter: roleFilter || undefined },
    }).then(setData)
  }, [roleFilter])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Capability Overview</h1>

      <select
        value={roleFilter}
        onChange={(e) => setRoleFilter(e.target.value)}
        className="rounded-md border px-3 py-2 text-sm"
      >
        <option value="">All Roles</option>
        <option value="staff">Staff</option>
        <option value="admin">Admin</option>
      </select>

      <div className="rounded-lg border">
        <table className="min-w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Capabilities</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {data.map((item: any) => (
              <>
                <tr key={item.user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{item.user.name}</td>
                  <td className="px-4 py-3 text-sm">{item.user.email}</td>
                  <td className="px-4 py-3 text-sm"><RoleBadge role={item.user.role as Role} /></td>
                  <td className="px-4 py-3 text-sm">
                    <button
                      onClick={() => setExpandedUser(expandedUser === item.user.id ? null : item.user.id)}
                      className="text-indigo-600 hover:underline"
                    >
                      {item.capabilities.length} capabilities
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      to={`/admin/users/${item.user.id}/caps`}
                      className="text-indigo-600 hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
                {expandedUser === item.user.id && (
                  <tr key={`${item.user.id}-caps`}>
                    <td colSpan={5} className="bg-gray-50 px-8 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.capabilities.map((cap: string) => (
                          <span key={cap} className="rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700">
                            {cap}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/capabilities.tsx
git commit -m "feat: add admin capabilities overview page"
```

---

### Task 16e: Per-User Capability Management Page

**Files:**
- Create: `app/routes/admin/users.$userId.caps.tsx`

- [ ] **Step 1: Create `app/routes/admin/users.$userId.caps.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  getUserCapabilities,
  updateUserCapability,
} from '~/server/fns/capabilities'
import { listAllNavLinks } from '~/server/fns/navigation'
import { RoleBadge } from '~/components/ui/RoleBadge'
import { useSession } from '~/lib/auth-client'
import type { Role } from '~/lib/permissions'

const STAFF_CAPABILITIES = [
  { key: 'economics:view', label: 'View Economics', category: 'Economics' },
  { key: 'economics:export', label: 'Export Economics', category: 'Economics' },
  { key: 'stats:view', label: 'View Statistics', category: 'Statistics' },
  { key: 'stats:export', label: 'Export Statistics', category: 'Statistics' },
]

const ADMIN_CAPABILITIES = [
  { key: 'admin:users:manage', label: 'Manage Users', category: 'Admin' },
  { key: 'admin:logs:view', label: 'View Logs', category: 'Admin' },
  { key: 'admin:navigation:manage', label: 'Manage Navigation', category: 'Admin' },
  { key: 'admin:permissions:manage', label: 'Manage Permissions', category: 'Admin' },
  { key: 'admin:capabilities:manage', label: 'Manage Capabilities', category: 'Admin' },
  { key: 'admin:suspend:manage', label: 'Manage Suspension', category: 'Admin' },
  { key: 'admin:ads:manage', label: 'Manage Ads (Phase 7)', category: 'Admin' },
  { key: 'admin:coupons:manage', label: 'Manage Coupons (Phase 5)', category: 'Admin' },
  { key: 'admin:viewer:access', label: 'Viewer Access (Phase 7)', category: 'Admin' },
]

export const Route = createFileRoute('/admin/users/$userId/caps')({
  component: UserCapsPage,
})

function UserCapsPage() {
  const { userId } = Route.useParams()
  const session = useSession()
  const [userCaps, setUserCaps] = useState<any[]>([])
  const [targetUser, setTargetUser] = useState<any>(null)
  const [pageCapabilities, setPageCapabilities] = useState<
    { key: string; label: string; category: string }[]
  >([])

  async function fetchData() {
    const caps = await getUserCapabilities({ data: { userId } })
    setUserCaps(caps)

    // Get internal nav links for pages:edit:* capabilities
    const navLinks = await listAllNavLinks()
    const pageCaps = navLinks
      .filter((l: any) => !l.isExternal)
      .map((l: any) => ({
        key: `pages:edit:${l.url.replace(/^\//, '')}`,
        label: `Edit ${l.label} (${l.url})`,
        category: 'Public Pages',
      }))
    setPageCapabilities(pageCaps)
  }

  useEffect(() => { fetchData() }, [userId])

  function isGranted(capKey: string) {
    return userCaps.some((c: any) => c.capability === capKey && c.granted)
  }

  async function toggleCap(capKey: string) {
    const current = isGranted(capKey)
    await updateUserCapability({
      data: { userId, capability: capKey, granted: !current },
    })
    fetchData()
  }

  // Determine which capabilities to show based on target user's role
  // (We don't have the user object from the caps endpoint, so we derive from the caps or
  //  use the admin list. For simplicity, show all and let the server validate.)
  const allCaps = [...pageCapabilities, ...STAFF_CAPABILITIES, ...ADMIN_CAPABILITIES]

  // Group by category
  const grouped = allCaps.reduce(
    (acc, cap) => {
      if (!acc[cap.category]) acc[cap.category] = []
      acc[cap.category].push(cap)
      return acc
    },
    {} as Record<string, typeof allCaps>,
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manage Capabilities</h1>
      <p className="text-sm text-gray-500">User ID: {userId}</p>

      {Object.entries(grouped).map(([category, caps]) => (
        <div key={category}>
          <h2 className="mb-2 text-lg font-semibold">{category}</h2>
          <div className="space-y-2 rounded-lg border bg-white p-4">
            {caps.map((cap) => (
              <label
                key={cap.key}
                className="flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-medium">{cap.label}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    {cap.key}
                  </span>
                </div>
                <button
                  onClick={() => toggleCap(cap.key)}
                  className={`rounded px-3 py-1 text-xs font-medium ${
                    isGranted(cap.key)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {isGranted(cap.key) ? 'Granted' : 'Not Granted'}
                </button>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/users.\$userId.caps.tsx
git commit -m "feat: add per-user capability management page"
```

---

## Chunk 7: Dashboard Placeholders & Final Integration

### Task 17: Placeholder Dashboard Routes

**Files:**
- Create: `app/routes/dashboard.tsx`
- Create: `app/routes/organizer.tsx`
- Create: `app/routes/distributor.tsx`
- Create: `app/routes/sponsor.tsx`
- Create: `app/routes/negotiator.tsx`
- Create: `app/routes/service-provider.tsx`
- Create: `app/routes/marketing.tsx`
- Create: `app/routes/staff.tsx`
- Create: `app/routes/profile.tsx`

- [ ] **Step 1: Create placeholder dashboards**

Each placeholder follows this pattern (example for `/dashboard`):

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useSession } from '~/lib/auth-client'
import { RoleBadge } from '~/components/ui/RoleBadge'
import { signOut } from '~/lib/auth-client'
import type { Role } from '~/lib/permissions'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    // Route guard — implemented per-role
  },
  component: DashboardPage,
})

function DashboardPage() {
  const session = useSession()
  const user = session.data?.user

  if (!user) return null

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome, {user.name}</h1>
        <div className="mt-2">
          <RoleBadge role={user.role as Role} />
        </div>
        <p className="mt-4 text-gray-600">
          Your dashboard is coming soon.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm text-white"
        >
          Logout
        </button>
      </div>
    </div>
  )
}
```

Create one for each: `/dashboard` (user), `/organizer`, `/distributor`, `/sponsor`, `/negotiator`, `/service-provider`, `/marketing`, `/profile`.

For `/staff` — additionally show capability-driven content:
```tsx
// In staff.tsx, after the welcome:
// Show "Edit Pages" if any pages:edit:* capability
// Show "Economics" if economics:view capability
// Show "Statistics" if stats:view capability
// Otherwise show "Contact your admin to get access"
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/dashboard.tsx app/routes/organizer.tsx app/routes/distributor.tsx app/routes/sponsor.tsx app/routes/negotiator.tsx app/routes/service-provider.tsx app/routes/marketing.tsx app/routes/staff.tsx app/routes/profile.tsx
git commit -m "feat: add placeholder dashboards for all roles + staff capability view"
```

---

### Task 18: Update Existing Pages with Dynamic Navigation

**Files:**
- Modify: `app/routes/index.tsx`
- Modify: `app/routes/events/index.tsx`
- Modify: `app/routes/events/$eventId.tsx`
- Modify: `app/routes/__root.tsx`

- [ ] **Step 1: Update `app/routes/__root.tsx`** — keep as-is (just the HTML shell)

- [ ] **Step 2: Update `app/routes/index.tsx`** — Replace the static header/footer with dynamic `<Header>` and `<Footer>` components. Load nav links via `getNavLinks` in the route loader.

- [ ] **Step 3: Update event routes similarly** — Use Header/Footer with dynamic nav links.

- [ ] **Step 4: Verify the app runs end-to-end**

```bash
npm run dev
# Open http://localhost:3000
# Verify: landing page loads with dynamic nav, login works, admin panel accessible
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/
git commit -m "feat: integrate dynamic Header/Footer into existing pages"
```

---

### Task 19: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Add `app` service to `docker-compose.yml`**

```yaml
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    env_file: .env
    environment:
      DATABASE_URL: postgresql://eom:eom@postgres:5432/eom
    depends_on:
      postgres:
        condition: service_healthy
```

- [ ] **Step 3: Build and test**

```bash
docker compose build app
docker compose up -d
# Verify: http://localhost:3000 loads
```

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfile and app service to Docker Compose"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Docker Compose + env | `docker-compose.yml`, `.env.example` |
| 2 | SQLite → PostgreSQL | `app/lib/db.ts`, `drizzle.config.ts` |
| 3 | Database schema | `app/lib/schema.ts` |
| 4 | Email helper | `app/lib/email.ts` |
| 5 | Better Auth config | `app/lib/auth.ts` |
| 6 | Permissions helper | `app/lib/permissions.ts` |
| 7 | Auth server helpers | `app/server/fns/auth-helpers.ts` |
| 8 | Seeder scripts | `scripts/migrate.ts`, `scripts/seed-*.ts` |
| 9 | Shared UI components | `app/components/ui/*` |
| 10 | Layout components | `app/components/layout/*` |
| 11 | Navigation server fns | `app/server/fns/navigation.ts` |
| 12 | Auth routes | `app/routes/login.tsx`, etc. |
| 13 | Admin server functions | `app/server/fns/admin.ts`, etc. |
| 14 | Admin layout + dashboard | `app/routes/admin/route.tsx` |
| 15 | User management page | `app/routes/admin/users.tsx` |
| 16 | Remaining admin pages | `app/routes/admin/logs.tsx`, etc. |
| 17 | Placeholder dashboards | `app/routes/dashboard.tsx`, etc. |
| 18 | Update existing pages | `app/routes/index.tsx`, etc. |
| 19 | Dockerfile | `Dockerfile` |
