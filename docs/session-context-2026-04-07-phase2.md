# EOM-APK Session Context — 2026-04-07 (Phase 2 Complete)

## Project Overview
- **Path:** `C:\Users\Klaudio\Desktop\Coding\EOM-APK`
- **Stack:** TanStack Start (React 19, Vite), PostgreSQL (Neon prod / Docker local), Drizzle ORM, Better Auth, Tailwind CSS 4
- **Branch:** `master` (single branch, no worktrees used)
- **Phase 1:** Complete and deployed (auth, admin, permissions, capabilities, dynamic nav, dark mode)
- **Phase 2:** Code complete (20 commits), NOT yet tested or deployed

## Deployments

### Railway (EOM-APK)
- **URL:** https://eom-apk-production.up.railway.app
- **Project ID:** 1817d3a9-b01e-44a9-b2d6-b5c7062d8e54
- **Builder:** Dockerfile
- **Env vars set:** DATABASE_URL (Neon), BETTER_AUTH_URL, BETTER_AUTH_SECRET
- **Missing for Phase 2:** R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
- **Status:** Phase 1 deployed and running. Phase 2 not yet pushed/deployed.

### Railway (eom-app — separate project, not actively used)
- **URL:** https://eom-app-production.up.railway.app
- **Project ID:** b1bcc144-2308-4953-84f0-827ea0bc362a

### Neon Database
- **Connection:** `postgresql://neondb_owner:npg_93cYwtGXLhNg@ep-dry-night-abwyik75-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require`
- **Schema:** Phase 1 tables migrated. Phase 2 migration NOT yet applied.
- **Seeded:** superadmin (`admin@eom.local` / `Admin123!`), navigation links (Home, Events, News, FAQ, Contact)
- **Note:** admin1 and staff1 from local Docker DB were NOT migrated to Neon

### Local Docker (still running)
- PostgreSQL: `postgresql://eom:eom@localhost:5432/eom`
- Mailpit: SMTP on 1025, Web UI on 8025
- Users: superadmin (admin@eom.dev), admin1 (admin1@eom.com), staff1 (staff@eom.com)

## Phase 2 Implementation Summary

### What Was Built
Public site + events system: event CRUD, public browsing, admin categories/moderation, R2 image uploads, Tiptap rich text editor, homepage sections.

### 20 Commits (oldest → newest)
1. `5e39ca4` — Phase 2 dependencies (Tiptap, DOMPurify, AWS S3 SDK)
2. `80e080d` — slugify utility
3. `9576fc3` — Phase 2 schema tables (categories, events, eventImages, tags, eventTags)
4. `51428ff` — Phase 2 database migration (`drizzle/0002_silent_captain_universe.sql`)
5. `7ab3f53` — Category seeder (11 defaults)
6. `a443878` — New capabilities (`admin:categories:manage`, `admin:events:manage`)
7. `1e4439e` — R2 S3 client configuration (`app/lib/r2.ts`)
8. `e287639` — Upload URL generation + image deletion (`app/server/fns/uploads.ts`)
9. `ec137f3` — Tag listing + findOrCreate helper (`app/server/fns/tags.ts`)
10. `fc3a8ee` — Category CRUD server functions (`app/server/fns/categories.ts`)
11. `dcd21e0` — Event CRUD + publish/cancel/archive/featured/admin listing (`app/server/fns/events.ts`)
12. `d5d33ca` — EventStatusBadge component
13. `307ef64` — EventCard component
14. `637435f` — ImageUploader component (drag/drop + R2 presigned upload)
15. `625cdb6` — GalleryUploader component (multi-image, reorder, captions)
16. `59d18fd` — Admin categories management page
17. `d7ac07c` — Admin events moderation page
18. `9d3c9fe` — RichTextEditor (Tiptap with toolbar)
19. `26b3013` — EventFilters sidebar component
20. Final route commits: organizer dashboard, homepage sections, events listing, event forms, event detail page

### New Files Created
**Libraries:**
- `app/lib/slugify.ts` — shared slug generation
- `app/lib/r2.ts` — R2 S3 client (env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL)

**Server Functions:**
- `app/server/fns/categories.ts` — list (public+admin), create, update, delete
- `app/server/fns/tags.ts` — list (with search), findOrCreateTag helper
- `app/server/fns/uploads.ts` — getUploadUrl (presigned PUT), deleteImage
- `app/server/fns/events.ts` — 13 operations (public listing/detail, organizer CRUD, admin moderation)

**Components:**
- `app/components/events/EventStatusBadge.tsx`
- `app/components/events/EventCard.tsx`
- `app/components/events/ImageUploader.tsx`
- `app/components/events/GalleryUploader.tsx`
- `app/components/events/RichTextEditor.tsx`
- `app/components/events/EventFilters.tsx`
- `app/components/events/EventForm.tsx` (3-step: Details → Media → Review)

**Routes:**
- `app/routes/admin/categories.tsx` — category management
- `app/routes/admin/events.tsx` — event moderation + featuring
- `app/routes/organizer/route.tsx` — layout with auth guard
- `app/routes/organizer/index.tsx` — dashboard with stats
- `app/routes/organizer/events/new.tsx` — create event
- `app/routes/organizer/events/$eventId.edit.tsx` — edit event

**Schema & Migration:**
- `drizzle/0002_silent_captain_universe.sql` — Phase 2 tables
- `scripts/seed-categories.ts` — 11 default categories

### Modified Files
- `app/lib/schema.ts` — added 5 tables + relations
- `app/server/fns/capabilities.ts` — added 2 capability prefixes
- `app/components/layout/AdminSidebar.tsx` — added Categories/Events nav items
- `app/routes/admin/route.tsx` — added new capabilities to capList
- `app/routes/index.tsx` — replaced placeholder with featured + latest events
- `app/routes/events/index.tsx` — replaced placeholder with filtered listing
- `app/routes/events/$eventId.tsx` — replaced placeholder with full detail page
- `package.json` — added deps + seed scripts

### Deleted Files
- `app/routes/organizer.tsx` — replaced by `app/routes/organizer/route.tsx`

## Pre-Deployment Checklist (Phase 2)

Before testing Phase 2 locally:
1. `npm install` (new dependencies)
2. `npm run db:migrate` (creates categories, events, eventImages, tags, eventTags tables)
3. `npm run db:seed:categories` (seeds 11 default categories)
4. Add R2 env vars to `.env`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=...
   R2_PUBLIC_URL=...
   ```
5. `npm run dev` (regenerates `routeTree.gen.ts` for new routes)

For production (Railway + Neon):
1. Push to GitHub from Windows terminal (WSL has no GitHub credentials)
2. Run migration on Neon: `npm run db:migrate` with DATABASE_URL pointing to Neon
3. Run category seeder on Neon: `npm run db:seed:categories`
4. Add R2 env vars to Railway
5. Railway auto-deploys on push

## Known Issues

### TypeScript Errors (Pre-existing, Phase 1)
~20 errors from Phase 1 files about `role` property not existing on Better Auth's user type, auth-helpers header types. Unrelated to Phase 2.

### Route Type Errors (Expected, Auto-resolves)
New routes (`/admin/categories`, `/admin/events`, `/organizer/`, etc.) show type errors because `routeTree.gen.ts` hasn't been regenerated. Running `npm run dev` fixes this automatically via the TanStack Router Vite plugin.

### Zero Errors in Phase 2 Code
All Phase 2 server functions, libraries, and components pass TypeScript checks.

## Key Architecture Patterns

- **Server functions:** `createServerFn({ method }).validator(schema).handler(async ({ data }) => { ... })`
- **Auth:** `getWebRequest()` → `auth.api.getSession()` → `requireCapability(session, 'cap:name')`
- **ID generation:** `crypto.randomUUID()` everywhere (not cuid2/nanoid)
- **Content filtering:** `activeOrganizerIds()` subquery excludes suspended users' events
- **HTML sanitization:** `isomorphic-dompurify` on server for rich text
- **Image uploads:** Client gets presigned URL → uploads directly to R2 → stores URL in DB
- **Route file convention:** `createFileRoute('/path')` with loader/component pattern
- **Roles:** user, organizer, distributor, sponsor, negotiator, service_provider, marketing_agency, staff, admin, superadmin

## Phase 2 Spec & Plan
- **Spec:** `docs/superpowers/specs/2026-04-07-phase2-public-site-events-design.md`
- **Plan:** `docs/superpowers/plans/2026-04-07-phase2-public-site-events.md`

## Deferred Features
- **File:** `docs/EOM-Deferred-Features.docx`
- Recurring events, multi-tier ticketing, invite-only, map embeds, newsletter, organizer analytics, calendar view

## Remaining Phases
- **Phase 3:** Negotiation Engine (offers, counteroffers between organizers and service providers)
- **Phase 4:** Business Profiles (distributor, sponsor, marketing agency pages)
- **Phase 5:** Ticketing + Coupons + Payments (Stripe integration, multi-tier tickets)
- **Phase 6:** Reservations + Calendar (booking system)
- **Phase 7:** Referrals + Ads + Polish
- **Phase 8:** Production Hardening (monitoring, scaling, security audit)

## Environment Notes
- Railway CLI token is expired — can't use from WSL. Push via Windows terminal.
- Git push from WSL fails (no GitHub credentials). Push from Windows.
- CSS in production uses `import appCss from '~/styles.css?url'` pattern for Vite/Tailwind.
- TanStack Router generates `routeTree.gen.ts` via Vite plugin during dev/build.
