# EOM Phase 1 — Foundation + Auth + Admin
**Date:** 2026-04-06
**Status:** Approved
**Scope:** Project scaffold, authentication with 10 roles, admin panel with granular capabilities, dynamic navigation, publishing permissions, work suspension

---

## Overview

Bootstrap the EOM platform from the existing TanStack Start scaffold. Replace SQLite with PostgreSQL, configure Better Auth with 10 user roles, build the admin panel (user management, logs, navigation, publishing permissions, capability management, work suspension), and establish layouts/routing for all roles.

This is Phase 1 of 8 in the EOM MVP-first build plan:
1. **Foundation + Auth + Admin** ← this spec
2. Public Site + Events
3. Negotiation Engine
4. Business Profiles + Applications
5. Ticketing + Coupons + Payments
6. Reservations + PPV
7. Referrals + Ads + Polish
8. Production Hardening

---

## 1. Infrastructure

### 1.1 Database Migration: SQLite → PostgreSQL

**Remove:**
- `better-sqlite3` npm package
- `db/` directory (SQLite schema + index)
- `db.sqlite` file
- `drizzle.config.ts` SQLite dialect

**Add:**
- `postgres` (postgres.js) npm package

**New files:**

**`app/lib/db.ts`**
```typescript
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

**`drizzle.config.ts`**
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

### 1.2 Docker Compose (`docker-compose.yml`)

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

volumes:
  pgdata:
```

### 1.3 Dockerfile (Multi-stage)

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

Note: The `.output` path depends on TanStack Start's build output — verify during implementation.

### 1.4 Environment Variables

**`.env.example`**
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

### 1.5 Scripts

**`scripts/migrate.ts`**
Uses `drizzle-orm/postgres-js/migrator` with a dedicated postgres.js client. Runs migrations from `./drizzle`, then closes the client.

**`scripts/seed-superadmin.ts`**
- Reads `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` from environment
- Falls back to interactive prompts via `@inquirer/prompts` (password input masked)
- Exits with error if either value is empty
- Creates user with `role: 'superadmin'`, `isActive: true`
- Logs `user_created` action to `user_logs`
- Never logs the password

**`scripts/seed-navigation.ts`**
Seeds core navigation links (Home, Events, News, FAQ, Login) as default header/footer links. Idempotent — skips existing links.

### 1.6 New Dependencies

| Package | Type | Purpose |
|---|---|---|
| `postgres` | runtime | PostgreSQL client (postgres.js) |
| `nodemailer` | runtime | SMTP email sending (dev via Mailpit, replaced by Resend in Phase 7) |
| `@types/nodemailer` | devDependency | TypeScript types for nodemailer |
| `@inquirer/prompts` | devDependency | Interactive CLI prompts for seeder |

### 1.7 Dependencies to Remove

| Package | Reason |
|---|---|
| `better-sqlite3` | Replaced by PostgreSQL |

---

## 2. Authentication & Role System

### 2.1 Better Auth Configuration (`app/lib/auth.ts`)

```typescript
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { db } from './db'

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // In dev: sends via Mailpit SMTP (localhost:1025)
      // Uses SMTP_HOST, SMTP_PORT, EMAIL_FROM env vars
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
        input: false, // cannot be set by client during registration
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
  // Requires: import { eq } from 'drizzle-orm'
  // Requires: import { APIError } from 'better-auth/api'
  // Requires: import { users } from './schema'
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await db.query.users.findFirst({
            where: eq(users.id, session.userId),
          })
          if (!user?.isActive) {
            throw new APIError('FORBIDDEN', { message: 'ACCOUNT_DEACTIVATED' })
          }
        },
      },
    },
  },
})
```

**Sign-in blocking for deactivated users:** Uses Better Auth's `databaseHooks.session.create.before` hook. Before any session is created, the hook queries the user by ID and checks `isActive`. If `false`, it throws `APIError('FORBIDDEN', { message: 'ACCOUNT_DEACTIVATED' })`, which prevents the session from being created. The login page checks for this error code and displays "Your account has been deactivated. Contact support."

### 2.2 Roles

10 roles stored as text on the `users` table:

| Role | Value | Created By |
|---|---|---|
| User / Client | `user` | Self-registration |
| Organizer | `organizer` | Admin/Superadmin |
| Distributor | `distributor` | Admin/Superadmin |
| Sponsor | `sponsor` | Admin/Superadmin |
| Negotiator | `negotiator` | Admin/Superadmin |
| Service Provider | `service_provider` | Admin/Superadmin |
| Marketing Agency | `marketing_agency` | Admin/Superadmin |
| EOM Staff | `staff` | Admin/Superadmin |
| Admin | `admin` | Superadmin only |
| Superadmin | `superadmin` | Seeder script only |

### 2.3 Auth Routes

| Route | Purpose |
|---|---|
| `/login` | Email + password sign in |
| `/register` | Self-registration (User role only) |
| `/forgot-password` | Email input, generic response (prevents email enumeration) |
| `/reset-password?token=...` | New password + confirm form |
| `/verify-email` | "Check your inbox" + resend button |
| `/api/auth/$` | Better Auth catch-all handler (exists) |

**Login behaviour:**
- On success: redirect to role-appropriate dashboard
- If `isActive === false`: show "Account deactivated" error
- If `emailVerified === false`: redirect to `/verify-email`

**Registration behaviour:**
- Creates user with `role: 'user'`, `isActive: true`, `emailVerified: false`
- Creates an empty `user_profiles` row (same as admin-created users)
- Redirects to `/verify-email`

### 2.4 Auth Client (`app/lib/auth-client.ts`)

Exports: `signIn`, `signUp`, `signOut`, `useSession`

Add `useRole()` helper that derives role from session for conditional UI rendering.

### 2.5 Email Helper (`app/lib/email.ts`)

Phase 1 uses a simple SMTP-based `sendEmail` function that sends plain-text emails via Mailpit in development. This will be replaced with Resend + React Email templates in Phase 7.

```typescript
import { createTransport } from 'nodemailer'

const transporter = createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
})

export async function sendEmail({ to, subject, text }: {
  to: string; subject: string; text: string
}) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eom.local',
    to, subject, text,
  })
}
```

**New dependency:** `nodemailer` (runtime) + `@types/nodemailer` (devDependency)

### 2.6 Permissions Helper (`app/lib/permissions.ts`)

```typescript
type Role = 'user' | 'organizer' | 'distributor' | 'sponsor' | 'negotiator' |
            'service_provider' | 'marketing_agency' | 'staff' | 'admin' | 'superadmin'

const ADMIN_ROLES: Role[] = ['admin', 'superadmin']

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}

export function isSuperadmin(role: Role): boolean {
  return role === 'superadmin'
}
```

**Route-level protection** uses TanStack Router's `beforeLoad` guard on protected routes:

```typescript
// Admin layout route (app/routes/admin/route.tsx)
export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ context }) => {
    const session = await getSession()
    if (!session || !isAdmin(session.user.role)) {
      throw redirect({ to: '/login' })
    }
  },
})
```

Each role-specific dashboard route uses the same pattern, checking for the appropriate role. Unauthenticated users are redirected to `/login`. Authenticated users with the wrong role are redirected to their own dashboard.

**Server function protection:** Every server function that requires auth calls a shared `requireAuth()` helper that returns the session or throws. Role-specific functions additionally check the role:

```typescript
async function requireAuth() {
  const session = await auth.api.getSession({ headers: getHeaders() })
  if (!session) throw new Error('UNAUTHORIZED')
  return session
}

async function requireAdmin() {
  const session = await requireAuth()
  if (!isAdmin(session.user.role)) throw new Error('FORBIDDEN')
  return session
}
```

Server functions use these helpers to check access before executing.

---

## 3. Database Schema

### 3.1 Auth Tables (managed by Better Auth)

**`users`**
```
id              text        PK
name            text        not null
email           text        not null, unique
emailVerified   boolean     not null, default false
image           text        nullable
role            text        not null, default 'user'
isActive        boolean     not null, default true
isSuspended     boolean     not null, default false
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

**`sessions`**
```
id              text        PK
userId          text        not null, FK → users.id
token           text        not null, unique
expiresAt       timestamp   not null
ipAddress       text        nullable
userAgent       text        nullable
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

**`accounts`**
```
id                      text        PK
userId                  text        not null, FK → users.id
accountId               text        not null
providerId              text        not null
accessToken             text        nullable
refreshToken            text        nullable
accessTokenExpiresAt    timestamp   nullable
refreshTokenExpiresAt   timestamp   nullable
scope                   text        nullable
password                text        nullable (password hash stored here by Better Auth, not on users table)
createdAt               timestamp   not null, defaultNow()
updatedAt               timestamp   not null, defaultNow()
```

**`verifications`**
```
id              text        PK
identifier      text        not null
value           text        not null
expiresAt       timestamp   not null
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

### 3.2 Domain Tables

**`user_profiles`**
```
id              text        PK (crypto.randomUUID())
userId          text        not null, FK → users.id, unique (users are never deleted — no ON DELETE needed)
phone           text        nullable
bio             text        nullable
dateOfBirth     date        nullable
location        text        nullable
avatarUrl       text        nullable
companyName     text        nullable (for business roles)
nipt            text        nullable (NIPT — Albanian tax ID, for Distributor/Sponsor)
qkb             text        nullable (QKB — Albanian business registration number, for Distributor)
operatingField  text        nullable (for Sponsor, Service Provider, Marketing Agency)
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

**`user_logs`**
```
id              text        PK (crypto.randomUUID())
userId          text        nullable, FK → users.id (users are never deleted; nullable for system-generated logs)
action          text        not null
details         jsonb       nullable
ipAddress       text        nullable
createdAt       timestamp   not null, defaultNow()
```

Phase 1 tracked actions:
- `user_created`, `user_updated`, `role_changed`
- `user_activated`, `user_deactivated`
- `user_suspended`, `user_resumed`
- `login`, `logout`, `password_reset`
- `permission_changed`
- `capability_granted`, `capability_revoked`
- `nav_link_created`, `nav_link_updated`, `nav_link_deleted`

**`navigation_links`**
```
id              text        PK (crypto.randomUUID())
label           text        not null
url             text        not null
position        text        not null ('header' | 'footer' | 'both')
sortOrder       integer     not null
isVisible       boolean     not null, default true
isExternal      boolean     not null, default false
isDeletable     boolean     not null, default true (false for core links)
isPublishable   boolean     not null, default false (true for content pages like /posts, /events)
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

**`publishing_permissions`**
```
id              text        PK (crypto.randomUUID())
role            text        not null
targetPage      text        not null
canPublish      boolean     not null, default true
grantedBy       text        nullable, FK → users.id (users are never deleted)
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()

UNIQUE(role, targetPage)
```

**`user_capabilities`** — Granular per-user capability assignments for Staff and Admin roles:
```
id              text        PK (crypto.randomUUID())
userId          text        not null, FK → users.id (users are never deleted)
capability      text        not null (capability key — see capability registry below)
granted         boolean     not null, default true
grantedBy       text        nullable, FK → users.id (users are never deleted)
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()

UNIQUE(userId, capability)
```

**Capability registry:**

Capabilities are string keys organized by category. New capabilities can be added in later phases.

| Category | Capability Key | Description | Applicable Roles |
|---|---|---|---|
| **Public Pages** | `pages:edit:<slug>` | Edit content on a specific public page (e.g., `pages:edit:faq`) | Staff |
| **Economics** | `economics:view` | View financial data (revenue, sales, invoices) | Staff |
| **Economics** | `economics:export` | Export financial reports | Staff |
| **Statistics** | `stats:view` | View platform statistics (user counts, events, etc.) | Staff |
| **Statistics** | `stats:export` | Export statistics reports | Staff |
| **Admin** | `admin:users:manage` | Create/edit/activate/deactivate users | Admin |
| **Admin** | `admin:logs:view` | View activity logs | Admin |
| **Admin** | `admin:navigation:manage` | Manage header/footer navigation | Admin |
| **Admin** | `admin:permissions:manage` | Manage publishing permissions matrix | Admin |
| **Admin** | `admin:capabilities:manage` | Assign/revoke capabilities for Staff | Admin |
| **Admin** | `admin:suspend:manage` | Suspend/resume business role users | Admin |
| **Admin** | `admin:ads:manage` | Manage ads and paid placements (Phase 7) | Admin |
| **Admin** | `admin:coupons:manage` | Manage coupon codes (Phase 5) | Admin |
| **Admin** | `admin:viewer:access` | Read-only login as other users (Phase 7) | Admin |

**How it works:**
- **Superadmin** has ALL capabilities implicitly — never checked against `user_capabilities`. Superadmin is the only role that can assign/revoke Admin capabilities.
- **Admin** capabilities are assigned per-user by Superadmin. An Admin without `admin:users:manage` cannot access the user management page.
- **Staff** capabilities are assigned per-user by Admin (with `admin:capabilities:manage`) or Superadmin.
- Server functions check capabilities via a helper: `await requireCapability(session, 'admin:users:manage')`

**Capability check helper (`app/lib/permissions.ts`):**
```typescript
export async function hasCapability(userId: string, role: Role, capability: string): Promise<boolean> {
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

export async function requireCapability(session: Session, capability: string) {
  const has = await hasCapability(session.user.id, session.user.role, capability)
  if (!has) throw new Error('FORBIDDEN')
}
```

---

### 3.3 Work Suspension System

**Purpose:** Admin can suspend a business role user's ability to start new work without deactivating their account. The user can still log in and finish existing in-progress tasks, but cannot initiate anything new.

**Affected roles:** `organizer`, `distributor`, `sponsor`, `service_provider`, `marketing_agency`, `negotiator`

**Not applicable to:** `user`, `staff`, `admin`, `superadmin` (these roles use `isActive` toggle instead)

**Interaction with `isActive`:** These are independent states. `isActive = false` (deactivated) takes precedence — a deactivated user cannot log in regardless of suspension status. Suspension only matters when `isActive = true`. The UI shows the dominant state:
- `isActive = false` → Red "Inactive" badge (suspension toggle hidden)
- `isActive = true, isSuspended = true` → Amber "Suspended" badge
- `isActive = true, isSuspended = false` → Green "Active" badge
When an admin deactivates a suspended user, `isSuspended` is preserved (not reset). When reactivated, the user returns to their previous suspended/active state.

**How it works:**
- `users.isSuspended` boolean field (default `false`)
- Admin (with `admin:suspend:manage` capability) or Superadmin can toggle suspension
- Suspended users see a yellow banner on their dashboard: "Your account is currently suspended. You can complete existing work but cannot start new tasks. Contact your administrator for more information."

**Suspension enforcement (in later phases):**
When a suspended user tries to create new work, server functions check `isSuspended` and reject with error `ACCOUNT_SUSPENDED`. Specifically:
- Cannot create new events (Phase 2)
- Cannot send new applications/requests (Phase 4)
- Cannot accept new incoming requests (Phase 4)
- Cannot start new negotiation rounds on requests they didn't initiate (Phase 3)
- Cannot generate new referral codes (Phase 7)

**What suspended users CAN do:**
- Log in and view their dashboard
- Continue/complete ongoing negotiations already in progress
- Finish editing draft events already created
- View their history, archive, and profile
- Update their profile information

**Server functions (added to `app/server/fns/admin.ts`):**

`toggleSuspension({ userId, suspended })`
- Requires `admin:suspend:manage` capability or Superadmin
- Cannot suspend Admin, Superadmin, Staff, or User roles — returns error `INVALID_ROLE_FOR_SUSPENSION`
- Sets `isSuspended` on user
- Logs `user_suspended` or `user_resumed` to `user_logs`

**Logged actions:**
- `user_suspended` — when suspension is enabled
- `user_resumed` — when suspension is lifted

### 3.4 Inactive User Visibility

**No user is ever deleted.** Instead, when an admin or superadmin sets a user to `isActive = false`, the user is effectively hidden from the entire platform:

**What happens when a user is deactivated:**
1. **Cannot log in** — session creation is blocked by the `databaseHooks.session.create.before` hook (Section 2.1)
2. **Existing sessions invalidated** — all active sessions for the user are deleted when `isActive` is set to `false`
3. **Content hidden platform-wide** — all queries for user-generated content (events, posts, catalog entries, profiles, sponsor tickets, negotiation entries, etc.) filter out rows belonging to inactive users. This is enforced by joining on `users.isActive = true` in all public and authenticated queries.
4. **Not listed in public-facing searches** — business profiles, organizer pages, distributor catalogs, etc. are excluded from search results and listing pages
5. **Ongoing negotiations paused** — if the user had active negotiations, they appear frozen to the other party with a "This party is currently unavailable" message (no data leaked about deactivation reason)

**What is preserved:**
- The user's data remains in the database (never deleted)
- Admin/Superadmin can still see inactive users in the admin user list (filtered by status)
- Admin/Superadmin can reactivate the user at any time, which restores all their content and access
- Logs referencing the user remain intact and visible to admins
- When reactivated, the user returns to their previous state (including suspension status if applicable)

**Implementation pattern for content filtering (used in later phases):**
All queries that return user-generated content to public or authenticated routes include a join or subquery check:
```typescript
// Example: listing events (Phase 2)
const events = await db.query.events.findMany({
  where: and(
    eq(events.status, 'available'),
    // Only show events from active users
    inArray(events.organizerId,
      db.select({ id: users.id }).from(users).where(eq(users.isActive, true))
    ),
  ),
})
```

**Phase 1 scope:** In Phase 1, the only place inactive users need to be filtered is the admin user list (which includes a status filter). Content filtering becomes relevant starting from Phase 2 (events), Phase 3 (negotiations), and Phase 4 (business profiles). The pattern above is documented here so it's applied consistently across all phases.

---

## 4. Admin Panel

### 4.1 Admin Layout

**Route structure:**
```
/admin                → Dashboard overview
/admin/users          → User management
/admin/users/:id/caps → Per-user capability management
/admin/logs           → Activity logs
/admin/navigation     → Header/footer link management
/admin/permissions    → Publishing permissions matrix
/admin/capabilities   → Capability overview (all users with assigned capabilities)
```

**Layout:**
- Sidebar navigation: Dashboard, Users, Logs, Navigation, Permissions, Capabilities
- Top bar: breadcrumb path, admin user info, logout button
- Access: Superadmin sees all sidebar items. Admin sees only items matching their assigned capabilities. Items without the required capability are hidden.
- A newly created Admin with no capabilities sees only the Dashboard (which shows a "Contact your Superadmin to get access" message)

**Capability-gated access convention:** Throughout this spec, "Admin+ only" on a server function means: Superadmin always has access (bypasses all checks). For Admin role, access requires the corresponding capability from the registry (Section 3.2). The mapping:
| Admin Route/Function | Required Capability |
|---|---|
| User management (create, edit, activate/deactivate) | `admin:users:manage` |
| Activity logs | `admin:logs:view` |
| Navigation management | `admin:navigation:manage` |
| Publishing permissions | `admin:permissions:manage` |
| Capability management | `admin:capabilities:manage` |
| Work suspension | `admin:suspend:manage` |

Every server function described as "Admin+ only" MUST call `requireCapability(session, '<key>')` instead of just `isAdmin()`. This ensures granular access control.

### 4.2 Dashboard (`/admin`)

Overview cards — each card is only visible if the admin has the corresponding capability:
- Total users count + Users by role breakdown (requires `admin:users:manage`)
- Recently created accounts, last 7 days (requires `admin:users:manage`)
- Recent activity log entries, last 10 (requires `admin:logs:view`)
- An Admin with no capabilities sees only a welcome message and "Contact your Superadmin to get access"
- Superadmin sees all cards

### 4.3 User Management (`/admin/users`)

**List view:**
- Table columns: Name, Email, Role, Status (active/inactive/suspended), Created date
- Filters: by role (dropdown), by status (active/inactive/suspended/all)
- Search: by name or email
- Pagination: 20 per page

**Create user form:**
- Fields: Name, Email, Password, Role (dropdown — all roles except `superadmin`)
- Admin can create: `user`, `organizer`, `distributor`, `sponsor`, `negotiator`, `service_provider`, `marketing_agency`, `staff` (all roles except `admin` and `superadmin`)
- Superadmin can create all of the above **plus** `admin` (cannot create `superadmin` — seeder only)
- On submit: creates user, creates empty `user_profiles` row, logs `user_created`

**Edit user:**
- Change name, email, role
- Toggle active/inactive status
- Toggle suspended/active for business roles (Organizer, Distributor, Sponsor, Service Provider, Marketing Agency, Negotiator)
- "Manage Capabilities" link → `/admin/users/:id/caps` (for Staff and Admin users)
- Role changes logged as `role_changed`
- Status changes logged as `user_activated` or `user_deactivated`
- Suspension changes logged as `user_suspended` or `user_resumed`

**Bulk actions:**
- Select multiple users via checkboxes
- Bulk role change (admin+ only)
- Bulk activate/deactivate (admin+ only)

**Superadmin-only actions:**
- Create/edit Admin accounts

**No deletion — ever:** Users are never deleted from the system. Instead, use the active/inactive toggle. When a user is set to inactive, they are effectively removed from the platform — they cannot log in and all their content is hidden everywhere (see Section 3.4 "Inactive User Visibility").

**Self-protection rules:**
- Users cannot deactivate or demote their own account
- The last remaining superadmin account cannot be deactivated or demoted — server functions check the superadmin count before allowing these operations and reject with error `LAST_SUPERADMIN` if only one remains

**Server functions (`app/server/fns/admin.ts`):**

`listUsers({ page, perPage, search, roleFilter, statusFilter })`
- Requires `admin:users:manage` capability
- Returns paginated user list with total count
- Joins `user_profiles` for extended data

`createUser({ name, email, password, role })`
- Requires `admin:users:manage` capability
- Validates role assignment permissions (Admin cannot create `admin` or `superadmin`; only Superadmin can create `admin`)
- Creates user via Better Auth's admin API
- Creates empty `user_profiles` row
- Logs `user_created` to `user_logs`

`updateUser({ id, name, email, role })`
- Requires `admin:users:manage` capability
- Validates role assignment permissions (changing role to `admin` requires Superadmin)
- Logs `user_updated` and/or `role_changed` to `user_logs`

`toggleUserStatus({ id, active })`
- Requires `admin:users:manage` capability
- Sets `isActive` on user
- Logs `user_activated` or `user_deactivated`

`bulkUpdateRole({ userIds, role })`
- Requires `admin:users:manage` capability
- If target role is `admin`, requires Superadmin (prevents privilege escalation)
- Validates permissions for each user
- Logs `role_changed` for each

`bulkToggleStatus({ userIds, active })`
- Requires `admin:users:manage` capability
- Logs per user

### 4.4 Activity Logs (`/admin/logs`)

**List view:**
- Table columns: Timestamp, User (name + email or "System"), Action, Details (expandable JSON), IP Address
- Filters: by user (search/select), by action type (dropdown), by date range (from/to)
- Pagination: 50 per page
- Sorted by newest first

**Server functions (`app/server/fns/logs.ts`):**

`listLogs({ page, perPage, userId, action, dateFrom, dateTo })`
- Requires `admin:logs:view` capability
- Returns paginated log entries with user join
- Date range filter uses `>=` and `<=` on `createdAt`

### 4.5 Navigation Management (`/admin/navigation`)

**UI:**
- Two sections: "Header Links" and "Footer Links"
- Each link shows: label, URL, visibility toggle, sort order, external badge
- Add new link button → form with label, URL, position (header/footer/both), sort order, isExternal, isPublishable
- Edit existing link → same form
- Delete link (disabled for core links where `isDeletable = false`)
- Reorder via sort order number field

**Core links seeded by `scripts/seed-navigation.ts`:**
| Label | URL | Position | isDeletable | isPublishable |
|---|---|---|---|---|
| Home | `/` | both | false | false |
| Events | `/events` | both | false | true |
| News | `/posts` | header | false | true |
| FAQ | `/faq` | header | false | false |
| Login | `/login` | header | false | false |
| Contact | `/contact` | footer | false | false |

Core links can be hidden (`isVisible = false`) but not deleted.

**Server functions (`app/server/fns/navigation.ts`):**

`getNavLinks({ position })`
- Public (no auth required)
- Returns visible links for position, sorted by `sortOrder`

`listAllNavLinks()`
- Requires `admin:navigation:manage` capability
- Returns all links including hidden ones

`createNavLink({ label, url, position, sortOrder, isExternal, isPublishable })`
- Requires `admin:navigation:manage` capability
- Logs `nav_link_created`

`updateNavLink({ id, label, url, position, sortOrder, isVisible, isExternal, isPublishable })`
- Requires `admin:navigation:manage` capability
- Logs `nav_link_updated`

`deleteNavLink({ id })`
- Requires `admin:navigation:manage` capability
- Rejects if `isDeletable === false`
- Logs `nav_link_deleted`

### 4.6 Publishing Permissions (`/admin/permissions`)

**UI:**
- Matrix view: rows = roles (all 10), columns = publishable pages
- **Publishable pages** are `navigation_links` entries where `isPublishable = true`. This explicit flag avoids ambiguity about which pages support content creation. Admin can toggle `isPublishable` when managing navigation links.
- **Phase 1 state:** The seeder sets `isPublishable = true` for `/posts` (News) and `/events` (Events). These appear in the matrix even though the actual post/event creation UI is built in Phase 2+. The UI shows an empty state message ("No publishable pages configured") if no links have `isPublishable = true`.
- Each cell is a checkbox toggle
- Changes save immediately (optimistic UI)
- Admin/Superadmin row shows all checked and disabled (always have access)
- Staff row: Staff do not publish content — they edit existing pages via `pages:edit:<slug>` capabilities. Staff row is hidden from the publishing permissions matrix.

**Server functions (`app/server/fns/permissions.ts`):**

`getPublishingPermissions()`
- Requires `admin:permissions:manage` capability
- Returns all `publishing_permissions` rows
- Joined with `navigation_links` for page labels

`updatePublishingPermission({ role, targetPage, canPublish })`
- Requires `admin:permissions:manage` capability
- Upserts: insert on conflict update `canPublish`
- Logs `permission_changed` with `{ role, targetPage, canPublish }` in details

`getMyPublishingPermissions()`
- Authenticated (any role)
- Returns pages the current user's role can publish to
- Admin/Superadmin always returns all internal pages

### 4.7 Capability Management (`/admin/users/:id/caps`)

**Per-user capability assignment page.** Accessed from the user list via "Manage Capabilities" link. Only shown for Staff and Admin role users.

**UI:**
- User info header (name, email, role)
- Grouped capability list organized by category (Public Pages, Economics, Statistics, Admin)
- Each capability has a toggle switch (granted / not granted)
- For Staff users: shows Staff-applicable capabilities (pages, economics, stats)
- For Admin users: shows Admin-applicable capabilities (all `admin:*` keys). **Only Superadmin can access this page for Admin users** — if an Admin tries to manage another Admin's capabilities, they are blocked.
- Changes save immediately (optimistic UI)
- Each toggle change logs `capability_granted` or `capability_revoked` to `user_logs`

**Page-specific capabilities:**
For `pages:edit:<slug>` capabilities, the list is dynamically generated from internal `navigation_links`. Each internal page gets its own toggle (e.g., `pages:edit:faq`, `pages:edit:posts`, `pages:edit:events`).

**Server functions (`app/server/fns/capabilities.ts`):**

`getUserCapabilities({ userId })`
- Admin (with `admin:capabilities:manage`) or Superadmin
- For Admin users: Superadmin only
- Returns all `user_capabilities` rows for this user

`updateUserCapability({ userId, capability, granted })`
- Admin (with `admin:capabilities:manage`) or Superadmin
- For Admin users: Superadmin only
- Upserts the capability record
- Logs `capability_granted` or `capability_revoked` with `{ userId, capability }` in details
- Validates that the capability key is from the registry (rejects unknown keys)

`getMyCapabilities()`
- Authenticated (any role)
- Superadmin returns all capabilities as granted
- Others return their `user_capabilities` rows where `granted = true`

### 4.8 Capability Overview (`/admin/capabilities`)

**Summary page showing all users who have assigned capabilities.**

**UI:**
- Table: User Name, Email, Role, Number of Capabilities, "Manage" link
- Filterable by role (Staff / Admin)
- Quick view: expanding a row shows the list of granted capabilities
- Requires `admin:capabilities:manage` capability or Superadmin

**Server functions (added to `app/server/fns/capabilities.ts`):**

`listUsersWithCapabilities({ roleFilter })`
- Admin (with `admin:capabilities:manage`) or Superadmin
- Returns users with at least one capability row, with capability count
- For Admin users in results: only shown to Superadmin

### 4.9 Work Suspension (`/admin/users`)

Suspension is managed from the user list (Section 4.3) — not a separate page. For business role users, the edit panel shows a "Suspend Work" / "Resume Work" toggle in addition to the active/inactive toggle.

**Visual indicators on user list:**
- Active: green badge
- Inactive: red badge
- Suspended: yellow/amber badge with "Suspended" text

**Server function** `toggleSuspension` is defined in Section 3.3.

---

## 5. Layout & Navigation

### 5.1 Public Layout

**Header (`app/components/layout/Header.tsx`):**
- EOM logo (links to `/`)
- Dynamic nav links from `getNavLinks({ position: 'header' })`
- Login button (when unauthenticated) or user dropdown (when authenticated)

**Footer (`app/components/layout/Footer.tsx`):**
- EOM branding
- Dynamic nav links from `getNavLinks({ position: 'footer' })`
- Copyright line

### 5.2 Authenticated User Dropdown

When logged in, the header Login button is replaced with a dropdown showing:
- User's name and role badge
- "My Dashboard" link (routes to role-appropriate dashboard)
- "Profile" link (→ `/profile`)
- "Logout" button

### 5.3 Role-Based Dashboard Routing

After login, users are redirected based on role:

| Role | Dashboard Route |
|---|---|
| `user` | `/dashboard` |
| `organizer` | `/organizer` |
| `distributor` | `/distributor` |
| `sponsor` | `/sponsor` |
| `negotiator` | `/negotiator` |
| `service_provider` | `/service-provider` |
| `marketing_agency` | `/marketing` |
| `staff` | `/staff` |
| `admin` | `/admin` |
| `superadmin` | `/admin` |

### 5.4 Placeholder Dashboard Pages

For roles whose full dashboards are built in later phases, create a simple page:
- Welcome message with user's name
- Role badge
- "Your [Role Name] dashboard is coming soon" message
- Logout button

Routes created as placeholders:
- `/dashboard` (User)
- `/organizer` (Organizer)
- `/distributor` (Distributor)
- `/sponsor` (Sponsor)
- `/negotiator` (Negotiator)
- `/service-provider` (Service Provider)
- `/marketing` (Marketing Agency)
- `/staff` (EOM Staff — shows only the tools matching their assigned capabilities)
- `/profile` (shared — all roles, built out in Phase 4: Business Profiles)

### 5.5 Shared Components

| Component | Purpose |
|---|---|
| `Header` | Public + authenticated variants, dynamic nav |
| `Footer` | Dynamic footer links |
| `AdminSidebar` | Admin layout sidebar navigation |
| `DataTable` | Reusable table with pagination, search, column filtering |
| `RoleBadge` | Colored badge for role display |
| `UserDropdown` | Authenticated user menu in header |

---

## 6. Route & File Structure

```
app/
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── AdminSidebar.tsx
│   │   └── UserDropdown.tsx
│   ├── ui/
│   │   ├── DataTable.tsx
│   │   └── RoleBadge.tsx
│   └── admin/
│       ├── UserForm.tsx
│       ├── NavLinkForm.tsx
│       └── PermissionsMatrix.tsx
├── lib/
│   ├── auth.ts
│   ├── auth-client.ts
│   ├── db.ts
│   ├── email.ts
│   ├── schema.ts
│   └── permissions.ts
├── server/
│   └── fns/
│       ├── admin.ts
│       ├── capabilities.ts
│       ├── logs.ts
│       ├── navigation.ts
│       └── permissions.ts
├── routes/
│   ├── __root.tsx
│   ├── index.tsx              (landing page — existing, updated with dynamic nav)
│   ├── login.tsx
│   ├── register.tsx
│   ├── forgot-password.tsx
│   ├── reset-password.tsx
│   ├── verify-email.tsx
│   ├── profile.tsx            (placeholder)
│   ├── dashboard.tsx          (User placeholder)
│   ├── organizer.tsx          (placeholder)
│   ├── distributor.tsx        (placeholder)
│   ├── sponsor.tsx            (placeholder)
│   ├── negotiator.tsx         (placeholder)
│   ├── service-provider.tsx   (placeholder)
│   ├── marketing.tsx          (placeholder)
│   ├── events/
│   │   ├── index.tsx          (existing — updated with dynamic nav)
│   │   └── $eventId.tsx       (existing — updated with dynamic nav)
│   ├── admin/
│   │   ├── route.tsx          (admin layout with sidebar)
│   │   ├── index.tsx          (dashboard)
│   │   ├── users.tsx
│   │   ├── users.$userId.caps.tsx
│   │   ├── logs.tsx
│   │   ├── navigation.tsx
│   │   ├── permissions.tsx
│   │   └── capabilities.tsx
│   ├── staff.tsx              (Staff dashboard — capability-driven)
│   └── api/
│       └── auth.$.ts          (existing)
├── router.tsx                 (existing)
├── client.tsx                 (existing)
├── ssr.tsx                    (existing)
└── styles.css                 (existing)

scripts/
├── migrate.ts
├── seed-superadmin.ts
└── seed-navigation.ts

drizzle/                       (generated migrations)
docker-compose.yml
Dockerfile
.env.example
```

---

## 7. Implementation Order

1. **Infrastructure** — Docker Compose, remove SQLite, add postgres.js, update drizzle config, create `.env.example`
2. **Schema** — Write `app/lib/schema.ts` with all Phase 1 tables, generate Drizzle migration
3. **Auth** — Configure Better Auth with 10 roles + `isActive`, `email.ts` helper (nodemailer/SMTP), `auth-client.ts` with `useRole()`, auth routes (login, register, forgot-password, reset-password, verify-email)
4. **Scripts** — `migrate.ts`, `seed-superadmin.ts`, `seed-navigation.ts`
5. **Permissions helper** — `app/lib/permissions.ts` with role checking functions
6. **Shared components** — Header, Footer, AdminSidebar, DataTable, RoleBadge, UserDropdown
7. **Layouts** — Public layout (dynamic nav), admin layout (sidebar + top bar)
8. **Admin server functions** — `admin.ts`, `capabilities.ts`, `logs.ts`, `navigation.ts`, `permissions.ts`
9. **Admin pages** — Dashboard, Users (with suspend toggle), Logs, Navigation, Permissions, Capabilities, Per-user capability management
10. **Staff dashboard** — `/staff` route showing tools based on assigned capabilities
11. **Placeholder dashboards** — All role-specific placeholder pages (including Staff)
12. **Update existing pages** — Landing page and events pages use dynamic Header/Footer
13. **Dockerfile** — Multi-stage build

---

## 8. New Environment Variables (complete)

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
