# EOM Phase 1 — Foundation + Auth + Admin
**Date:** 2026-04-06
**Status:** Approved
**Scope:** Project scaffold, authentication with 9 roles, admin panel, dynamic navigation, publishing permissions

---

## Overview

Bootstrap the EOM platform from the existing TanStack Start scaffold. Replace SQLite with PostgreSQL, configure Better Auth with 9 user roles, build the admin panel (user management, logs, navigation, publishing permissions), and establish layouts/routing for all roles.

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

# Email (dev — Mailpit)
EMAIL_TRANSPORT=smtp
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
      // Phase 1: log to console in dev. Resend integration in Phase 7.
      console.log(`Password reset for ${user.email}: ${url}`)
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`Verify email for ${user.email}: ${url}`)
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
    },
  },
  plugins: [admin()],
})
```

**Sign-in hook:** Before creating a session, check `user.isActive`. If `false`, reject with error `ACCOUNT_DEACTIVATED`.

### 2.2 Roles

9 roles stored as text on the `users` table:

| Role | Value | Created By |
|---|---|---|
| User / Client | `user` | Self-registration |
| Organizer | `organizer` | Admin/Superadmin |
| Distributor | `distributor` | Admin/Superadmin |
| Sponsor | `sponsor` | Admin/Superadmin |
| Negotiator | `negotiator` | Admin/Superadmin |
| Service Provider | `service_provider` | Admin/Superadmin |
| Marketing Agency | `marketing_agency` | Admin/Superadmin |
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
- Redirects to `/verify-email`

### 2.4 Auth Client (`app/lib/auth-client.ts`)

Exports: `signIn`, `signUp`, `signOut`, `useSession`

Add `useRole()` helper that derives role from session for conditional UI rendering.

### 2.5 Permissions Helper (`app/lib/permissions.ts`)

```typescript
type Role = 'user' | 'organizer' | 'distributor' | 'sponsor' | 'negotiator' |
            'service_provider' | 'marketing_agency' | 'admin' | 'superadmin'

const ADMIN_ROLES: Role[] = ['admin', 'superadmin']

export function isAdmin(role: Role): boolean {
  return ADMIN_ROLES.includes(role)
}

export function isSuperadmin(role: Role): boolean {
  return role === 'superadmin'
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
password                text        nullable
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
userId          text        not null, FK → users.id ON DELETE CASCADE, unique
phone           text        nullable
bio             text        nullable
dateOfBirth     date        nullable
location        text        nullable
avatarUrl       text        nullable
companyName     text        nullable
nipt            text        nullable
qkb             text        nullable
operatingField  text        nullable
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

**`user_logs`**
```
id              text        PK (crypto.randomUUID())
userId          text        nullable, FK → users.id ON DELETE SET NULL
action          text        not null
details         jsonb       nullable
ipAddress       text        nullable
createdAt       timestamp   not null, defaultNow()
```

Phase 1 tracked actions:
- `user_created`, `user_updated`, `role_changed`
- `user_activated`, `user_deactivated`
- `login`, `logout`, `password_reset`
- `permission_changed`
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
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()
```

**`publishing_permissions`**
```
id              text        PK (crypto.randomUUID())
role            text        not null
targetPage      text        not null
canPublish      boolean     not null, default true
grantedBy       text        nullable, FK → users.id ON DELETE SET NULL
createdAt       timestamp   not null, defaultNow()
updatedAt       timestamp   not null, defaultNow()

UNIQUE(role, targetPage)
```

---

## 4. Admin Panel

### 4.1 Admin Layout

**Route structure:**
```
/admin              → Dashboard overview
/admin/users        → User management
/admin/logs         → Activity logs
/admin/navigation   → Header/footer link management
/admin/permissions  → Publishing permissions matrix
```

**Layout:**
- Sidebar navigation: Dashboard, Users, Logs, Navigation, Permissions
- Top bar: breadcrumb path, admin user info, logout button
- Access restricted to `admin` and `superadmin` roles

### 4.2 Dashboard (`/admin`)

Overview cards showing:
- Total users count
- Users by role (breakdown)
- Recently created accounts (last 7 days)
- Recent activity log entries (last 10)

### 4.3 User Management (`/admin/users`)

**List view:**
- Table columns: Name, Email, Role, Status (active/inactive), Created date
- Filters: by role (dropdown), by status (active/inactive/all)
- Search: by name or email
- Pagination: 20 per page

**Create user form:**
- Fields: Name, Email, Password, Role (dropdown — all roles except `superadmin`)
- Admin can only create roles up to `admin`
- Superadmin can create any role except `superadmin`
- On submit: creates user, creates empty `user_profiles` row, logs `user_created`

**Edit user:**
- Change name, email, role
- Toggle active/inactive status
- Role changes logged as `role_changed`
- Status changes logged as `user_activated` or `user_deactivated`

**Bulk actions:**
- Select multiple users via checkboxes
- Bulk role change (admin+ only)
- Bulk activate/deactivate (admin+ only)
- Bulk delete (superadmin only)

**Superadmin-only actions:**
- Create/edit Admin accounts
- Delete users permanently

**Server functions (`app/server/fns/admin.ts`):**

`listUsers({ page, perPage, search, roleFilter, statusFilter })`
- Admin+ only
- Returns paginated user list with total count
- Joins `user_profiles` for extended data

`createUser({ name, email, password, role })`
- Admin+ only
- Validates role assignment permissions (admin cannot create superadmin)
- Creates user via Better Auth's admin API
- Creates empty `user_profiles` row
- Logs `user_created` to `user_logs`

`updateUser({ id, name, email, role })`
- Admin+ only
- Validates role assignment permissions
- Logs `user_updated` and/or `role_changed` to `user_logs`

`toggleUserStatus({ id, active })`
- Admin+ only
- Sets `isActive` on user
- Logs `user_activated` or `user_deactivated`

`deleteUser({ id })`
- Superadmin only
- Permanently removes user
- Logs `user_deleted` (userId set to null since user is gone, details contain deleted user info)

`bulkUpdateRole({ userIds, role })`
- Admin+ only
- Validates permissions for each user
- Logs `role_changed` for each

`bulkToggleStatus({ userIds, active })`
- Admin+ only
- Logs per user

`bulkDeleteUsers({ userIds })`
- Superadmin only

### 4.4 Activity Logs (`/admin/logs`)

**List view:**
- Table columns: Timestamp, User (name + email or "System"), Action, Details (expandable JSON), IP Address
- Filters: by user (search/select), by action type (dropdown), by date range (from/to)
- Pagination: 50 per page
- Sorted by newest first

**Server functions (`app/server/fns/logs.ts`):**

`listLogs({ page, perPage, userId, action, dateFrom, dateTo })`
- Admin+ only
- Returns paginated log entries with user join
- Date range filter uses `>=` and `<=` on `createdAt`

### 4.5 Navigation Management (`/admin/navigation`)

**UI:**
- Two sections: "Header Links" and "Footer Links"
- Each link shows: label, URL, visibility toggle, sort order, external badge
- Add new link button → form with label, URL, position (header/footer/both), sort order, isExternal
- Edit existing link → same form
- Delete link (disabled for core links where `isDeletable = false`)
- Reorder via sort order number field

**Core links seeded by `scripts/seed-navigation.ts`:**
| Label | URL | Position | isDeletable |
|---|---|---|---|
| Home | `/` | header | false |
| Events | `/events` | header | false |
| News | `/posts` | header | false |
| FAQ | `/faq` | header | false |
| Login | `/login` | header | false |
| Home | `/` | footer | false |
| Events | `/events` | footer | false |
| Contact | `/contact` | footer | false |

Core links can be hidden (`isVisible = false`) but not deleted.

**Server functions (`app/server/fns/navigation.ts`):**

`getNavLinks({ position })`
- Public (no auth required)
- Returns visible links for position, sorted by `sortOrder`

`listAllNavLinks()`
- Admin+ only
- Returns all links including hidden ones

`createNavLink({ label, url, position, sortOrder, isExternal })`
- Admin+ only
- Logs `nav_link_created`

`updateNavLink({ id, label, url, position, sortOrder, isVisible, isExternal })`
- Admin+ only
- Logs `nav_link_updated`

`deleteNavLink({ id })`
- Admin+ only
- Rejects if `isDeletable === false`
- Logs `nav_link_deleted`

### 4.6 Publishing Permissions (`/admin/permissions`)

**UI:**
- Matrix view: rows = roles (all 9), columns = public pages (derived from internal `navigation_links`)
- Each cell is a checkbox toggle
- Changes save immediately (optimistic UI)
- Admin/Superadmin row shows all checked and disabled (always have access)

**Server functions (`app/server/fns/permissions.ts`):**

`getPublishingPermissions()`
- Admin+ only
- Returns all `publishing_permissions` rows
- Joined with `navigation_links` for page labels

`updatePublishingPermission({ role, targetPage, canPublish })`
- Admin+ only
- Upserts: insert on conflict update `canPublish`
- Logs `permission_changed` with `{ role, targetPage, canPublish }` in details

`getMyPublishingPermissions()`
- Authenticated (any role)
- Returns pages the current user's role can publish to
- Admin/Superadmin always returns all internal pages

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
- `/profile` (shared — all roles)

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
│   ├── schema.ts
│   └── permissions.ts
├── server/
│   └── fns/
│       ├── admin.ts
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
│   │   ├── logs.tsx
│   │   ├── navigation.tsx
│   │   └── permissions.tsx
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
3. **Auth** — Configure Better Auth with 9 roles + `isActive`, auth routes (login, register, forgot-password, reset-password, verify-email)
4. **Scripts** — `migrate.ts`, `seed-superadmin.ts`, `seed-navigation.ts`
5. **Permissions helper** — `app/lib/permissions.ts` with role checking functions
6. **Shared components** — Header, Footer, AdminSidebar, DataTable, RoleBadge, UserDropdown
7. **Layouts** — Public layout (dynamic nav), admin layout (sidebar + top bar)
8. **Admin server functions** — `admin.ts`, `logs.ts`, `navigation.ts`, `permissions.ts`
9. **Admin pages** — Dashboard, Users, Logs, Navigation, Permissions
10. **Placeholder dashboards** — All role-specific placeholder pages
11. **Update existing pages** — Landing page and events pages use dynamic Header/Footer
12. **Dockerfile** — Multi-stage build

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

# Email (dev — Mailpit)
EMAIL_TRANSPORT=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
EMAIL_FROM=noreply@eom.local
```
