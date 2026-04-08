# Phase 3: Service Marketplace + Negotiation Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the service marketplace where providers list services/packages, organizers discover and hire them, and both parties negotiate price/terms through a structured offer/counteroffer system.

**Architecture:** Server functions (createServerFn) for all data operations, file-based routing with TanStack Router, reuse of Phase 2's R2 uploads/Tiptap/GalleryUploader. Negotiation state machine with lazy expiry (no cron). On accept, provider linked to event via `event_services`.

**Tech Stack:** TanStack Start (React 19, Vite), Drizzle ORM, PostgreSQL (Neon), Cloudflare R2, Tiptap, isomorphic-dompurify, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-08-phase3-service-marketplace-negotiation-design.md`

---

## File Structure

### New files to create:
- `app/server/fns/services.ts` — Service CRUD + package CRUD server functions
- `app/server/fns/negotiations.ts` — Negotiation lifecycle server functions
- `app/server/fns/service-categories.ts` — Service category admin CRUD
- `app/components/services/ServiceCard.tsx` — Browse card for marketplace
- `app/components/services/ServiceFilters.tsx` — Sidebar filters (category, keyword, location)
- `app/components/services/ServiceForm.tsx` — Multi-step service create/edit form
- `app/components/services/PackageCard.tsx` — Package display with price/quote button
- `app/components/negotiations/NegotiationThread.tsx` — Chat-like round view
- `app/components/negotiations/NegotiationActions.tsx` — Accept/Reject/Counter buttons + form
- `app/components/negotiations/NegotiationStatusBadge.tsx` — Color-coded status badge
- `app/components/negotiations/NegotiationCard.tsx` — List item card
- `app/components/events/EventServicesList.tsx` — Accepted providers on event detail
- `app/routes/services/index.tsx` — Public marketplace browse
- `app/routes/services/$serviceId.tsx` — Public service detail
- `app/routes/service-provider/route.tsx` — Provider layout with auth guard
- `app/routes/service-provider/index.tsx` — Provider dashboard
- `app/routes/service-provider/services/new.tsx` — Create service listing
- `app/routes/service-provider/services/$serviceId.edit.tsx` — Edit service listing
- `app/routes/service-provider/negotiations/index.tsx` — Provider negotiations list
- `app/routes/service-provider/negotiations/$negotiationId.tsx` — Provider negotiation thread
- `app/routes/organizer/negotiations/index.tsx` — Organizer negotiations list
- `app/routes/organizer/negotiations/$negotiationId.tsx` — Organizer negotiation thread
- `app/routes/admin/service-categories.tsx` — Admin service category management
- `app/routes/admin/services.tsx` — Admin service moderation
- `app/routes/admin/negotiations.tsx` — Admin negotiation oversight
- `scripts/seed-service-categories.ts` — Default service category seeder

### Files to modify:
- `app/lib/schema.ts` — Add 7 new tables + relations, update usersRelations/eventsRelations
- `app/server/fns/capabilities.ts` — Add 3 new capability prefixes
- `app/server/fns/events.ts` — Modify cancelEvent (cascade) + deleteEvent (block)
- `app/components/layout/AdminSidebar.tsx` — Add Service Categories, Services, Negotiations menu items
- `app/routes/admin/route.tsx` — Add new capabilities to capList
- `app/routes/events/$eventId.tsx` — Add EventServicesList section
- `package.json` — Add seed-service-categories script

---

## Chunk 1: Schema, Migration, Seeding, Capabilities

### Task 1: Add Phase 3 schema tables

**Files:**
- Modify: `app/lib/schema.ts`

- [ ] **Step 1: Add service_categories table after the Phase 2 eventTags table**

Add after line 223 (after `eventTags` table), before the Relations section:

```typescript
// ============================================================
// Phase 3: Service Marketplace + Negotiation Tables
// ============================================================

export const serviceCategories = pgTable('service_categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 2: Add services table**

```typescript
export const services = pgTable('services', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  providerId: text('provider_id').notNull().references(() => users.id),
  categoryId: text('category_id').notNull().references(() => serviceCategories.id),
  title: text('title').notNull(),
  description: text('description'),
  city: text('city'),
  country: text('country'),
  bannerImage: text('banner_image'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 3: Add service_packages table**

```typescript
export const servicePackages = pgTable('service_packages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  price: numeric('price', { precision: 10, scale: 2 }),
  priceIsPublic: boolean('price_is_public').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 4: Add service_images table**

```typescript
export const serviceImages = pgTable('service_images', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

- [ ] **Step 5: Add negotiations table**

```typescript
export const negotiations = pgTable('negotiations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'restrict' }),
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'restrict' }),
  packageId: text('package_id').references(() => servicePackages.id),
  organizerId: text('organizer_id').notNull().references(() => users.id),
  providerId: text('provider_id').notNull().references(() => users.id),
  status: text('status').notNull().default('requested'),
  initiatedBy: text('initiated_by').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

- [ ] **Step 6: Add negotiation_rounds table**

```typescript
export const negotiationRounds = pgTable('negotiation_rounds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  negotiationId: text('negotiation_id').notNull().references(() => negotiations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }),
  message: text('message'),
  roundNumber: integer('round_number').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

- [ ] **Step 7: Add event_services table**

```typescript
export const eventServices = pgTable('event_services', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  serviceId: text('service_id').notNull().references(() => services.id),
  negotiationId: text('negotiation_id').notNull().references(() => negotiations.id),
  providerId: text('provider_id').notNull().references(() => users.id),
  agreedPrice: numeric('agreed_price', { precision: 10, scale: 2 }).notNull(),
  agreedTerms: text('agreed_terms'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

- [ ] **Step 8: Add Phase 3 relations**

Add after the existing Phase 2 relations (after `eventTagsRelations`):

```typescript
// Phase 3 Relations

export const serviceCategoriesRelations = relations(serviceCategories, ({ many }) => ({
  services: many(services),
}))

export const servicesRelations = relations(services, ({ one, many }) => ({
  provider: one(users, { fields: [services.providerId], references: [users.id] }),
  category: one(serviceCategories, { fields: [services.categoryId], references: [serviceCategories.id] }),
  packages: many(servicePackages),
  images: many(serviceImages),
  negotiations: many(negotiations),
}))

export const servicePackagesRelations = relations(servicePackages, ({ one }) => ({
  service: one(services, { fields: [servicePackages.serviceId], references: [services.id] }),
}))

export const serviceImagesRelations = relations(serviceImages, ({ one }) => ({
  service: one(services, { fields: [serviceImages.serviceId], references: [services.id] }),
}))

export const negotiationsRelations = relations(negotiations, ({ one, many }) => ({
  event: one(events, { fields: [negotiations.eventId], references: [events.id] }),
  service: one(services, { fields: [negotiations.serviceId], references: [services.id] }),
  package: one(servicePackages, { fields: [negotiations.packageId], references: [servicePackages.id] }),
  organizer: one(users, { fields: [negotiations.organizerId], references: [users.id] }),
  provider: one(users, { fields: [negotiations.providerId], references: [users.id] }),
  rounds: many(negotiationRounds),
  eventService: one(eventServices),
}))

export const negotiationRoundsRelations = relations(negotiationRounds, ({ one }) => ({
  negotiation: one(negotiations, { fields: [negotiationRounds.negotiationId], references: [negotiations.id] }),
  sender: one(users, { fields: [negotiationRounds.senderId], references: [users.id] }),
}))

export const eventServicesRelations = relations(eventServices, ({ one }) => ({
  event: one(events, { fields: [eventServices.eventId], references: [events.id] }),
  service: one(services, { fields: [eventServices.serviceId], references: [services.id] }),
  negotiation: one(negotiations, { fields: [eventServices.negotiationId], references: [negotiations.id] }),
  provider: one(users, { fields: [eventServices.providerId], references: [users.id] }),
}))
```

- [ ] **Step 9: Update existing usersRelations to include Phase 3**

In `usersRelations`, add these lines inside the relation object:

```typescript
  services: many(services),
  organizerNegotiations: many(negotiations, { relationName: 'organizerNegotiations' }),
  providerNegotiations: many(negotiations, { relationName: 'providerNegotiations' }),
```

Note: Since Drizzle doesn't support `relationName` for disambiguation in the same way, and `users` has two FK relations to `negotiations`, keep it simple — queries will use explicit `where` clauses with `organizerId`/`providerId` instead of relying on relational queries from the user side. Just add:

```typescript
  services: many(services),
```

- [ ] **Step 10: Update eventsRelations to include Phase 3**

In `eventsRelations`, add:

```typescript
  negotiations: many(negotiations),
  eventServices: many(eventServices),
```

- [ ] **Step 11: Commit**

```bash
git add app/lib/schema.ts
git commit -m "feat: add Phase 3 schema tables (services, negotiations, event_services)"
```

---

### Task 2: Generate and run migration

**Files:**
- Creates: `drizzle/0003_*.sql` (auto-generated)

- [ ] **Step 1: Generate the migration**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK
npx drizzle-kit generate
```

Expected: New SQL file in `drizzle/` with CREATE TABLE statements for all 7 new tables.

- [ ] **Step 2: Review the generated SQL**

Open the generated file and verify it creates: `service_categories`, `services`, `service_packages`, `service_images`, `negotiations`, `negotiation_rounds`, `event_services` with correct columns, constraints, and foreign keys.

- [ ] **Step 3: Run migration locally**

```bash
npx drizzle-kit migrate
```

Expected: Migration applied successfully.

- [ ] **Step 4: Commit**

```bash
git add drizzle/
git commit -m "feat: add Phase 3 migration (7 new tables)"
```

---

### Task 3: Add new capability prefixes

**Files:**
- Modify: `app/server/fns/capabilities.ts`

- [ ] **Step 1: Add 3 new prefixes to VALID_CAPABILITY_PREFIXES array**

Find the `VALID_CAPABILITY_PREFIXES` array and add these entries:

```typescript
  'admin:service-categories:manage',
  'admin:services:manage',
  'admin:negotiations:manage',
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/capabilities.ts
git commit -m "feat: add Phase 3 admin capability prefixes"
```

---

### Task 4: Create service category seed script

**Files:**
- Create: `scripts/seed-service-categories.ts`
- Modify: `package.json`

- [ ] **Step 1: Create the seed script**

```typescript
// scripts/seed-service-categories.ts
import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../app/lib/schema'
import { slugify } from '../app/lib/slugify'

const SERVICE_CATEGORIES = [
  { name: 'DJ', sortOrder: 1 },
  { name: 'Catering', sortOrder: 2 },
  { name: 'Photography', sortOrder: 3 },
  { name: 'Videography', sortOrder: 4 },
  { name: 'Security', sortOrder: 5 },
  { name: 'Lighting & Sound', sortOrder: 6 },
  { name: 'Venue', sortOrder: 7 },
  { name: 'Transportation', sortOrder: 8 },
  { name: 'Decoration', sortOrder: 9 },
  { name: 'Entertainment', sortOrder: 10 },
  { name: 'Planning & Coordination', sortOrder: 11 },
  { name: 'Other', sortOrder: 12 },
]

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  for (const cat of SERVICE_CATEGORIES) {
    const slug = slugify(cat.name)
    const existing = await db.query.serviceCategories.findFirst({
      where: (c, { eq }) => eq(c.slug, slug),
    })
    if (existing) {
      console.log(`Service category "${cat.name}" already exists, skipping.`)
      continue
    }
    await db.insert(schema.serviceCategories).values({
      name: cat.name,
      slug,
      sortOrder: cat.sortOrder,
    })
    console.log(`Created service category: ${cat.name}`)
  }

  console.log('Done.')
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Add npm script to package.json**

Add to `"scripts"`:

```json
"seed:service-categories": "tsx scripts/seed-service-categories.ts"
```

- [ ] **Step 3: Run seed locally**

```bash
npm run seed:service-categories
```

Expected: 12 service categories created.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-service-categories.ts package.json
git commit -m "feat: add service category seed script with 12 default categories"
```

---

### Task 5: Modify cancelEvent to cascade-cancel negotiations

**Files:**
- Modify: `app/server/fns/events.ts`

- [ ] **Step 1: Add imports at top of events.ts**

```typescript
import { negotiations, negotiationRounds } from '~/lib/schema'
import { and, eq, notInArray, max } from 'drizzle-orm'
```

- [ ] **Step 2: Add cascade logic inside cancelEvent handler, after setting event status to cancelled**

After the line that updates the event status to `'cancelled'`, add:

```typescript
    // Cascade-cancel all non-terminal negotiations for this event
    const terminalStatuses = ['accepted', 'rejected', 'cancelled', 'expired']
    const activeNegotiations = await db.query.negotiations.findMany({
      where: and(
        eq(negotiations.eventId, id),
        notInArray(negotiations.status, terminalStatuses),
      ),
    })

    for (const neg of activeNegotiations) {
      // Get current max round number
      const lastRound = await db.query.negotiationRounds.findFirst({
        where: eq(negotiationRounds.negotiationId, neg.id),
        orderBy: (r, { desc }) => [desc(r.roundNumber)],
      })
      const nextRound = (lastRound?.roundNumber ?? 0) + 1

      await db.insert(negotiationRounds).values({
        negotiationId: neg.id,
        senderId: session.user.id,
        action: 'cancel',
        message: 'Event was cancelled by the organizer.',
        roundNumber: nextRound,
      })

      await db
        .update(negotiations)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(negotiations.id, neg.id))
    }
```

- [ ] **Step 3: Modify deleteEvent to block if negotiations exist**

In the `deleteEvent` handler, before the existing deletion logic, add a check:

```typescript
    // Block deletion if any negotiations exist
    const negCount = await db.query.negotiations.findFirst({
      where: eq(negotiations.eventId, id),
    })
    if (negCount) {
      throw new Error('CANNOT_DELETE: Event has negotiations and cannot be deleted')
    }
```

- [ ] **Step 4: Commit**

```bash
git add app/server/fns/events.ts
git commit -m "feat: cascade-cancel negotiations on event cancel, block delete with negotiations"
```

---

## Chunk 2: Service Category Admin + Service CRUD Server Functions

### Task 6: Create service category admin server functions

**Files:**
- Create: `app/server/fns/service-categories.ts`

- [ ] **Step 1: Create the file with all 5 functions**

```typescript
// app/server/fns/service-categories.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, asc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { serviceCategories, services, userLogs } from '~/lib/schema'
import { requireAuth } from '~/server/fns/auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import { slugify } from '~/lib/slugify'

// Public: list active service categories
export const listServiceCategories = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.query.serviceCategories.findMany({
      where: eq(serviceCategories.isActive, true),
      orderBy: [asc(serviceCategories.sortOrder)],
    })
  },
)

// Admin: list all service categories (including inactive)
export const listAllServiceCategories = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')
    return db.query.serviceCategories.findMany({
      orderBy: [asc(serviceCategories.sortOrder)],
    })
  },
)

// Admin: create service category
export const createServiceCategory = createServerFn({ method: 'POST' })
  .validator((input: { name: string; description?: string; sortOrder?: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')

    const slug = slugify(data.name)
    const [category] = await db.insert(serviceCategories).values({
      name: data.name,
      slug,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    }).returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_category_created',
      details: { categoryId: category.id, name: data.name },
    })

    return category
  })

// Admin: update service category
export const updateServiceCategory = createServerFn({ method: 'POST' })
  .validator((input: { id: string; name?: string; description?: string; sortOrder?: number; isActive?: boolean }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')

    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) {
      values.name = data.name
      values.slug = slugify(data.name)
    }
    if (data.description !== undefined) values.description = data.description || null
    if (data.sortOrder !== undefined) values.sortOrder = data.sortOrder
    if (data.isActive !== undefined) values.isActive = data.isActive

    const [updated] = await db.update(serviceCategories).set(values).where(eq(serviceCategories.id, data.id)).returning()
    return updated
  })

// Admin: delete service category (blocked if services reference it)
export const deleteServiceCategory = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')

    const serviceCount = await db.query.services.findFirst({
      where: eq(services.categoryId, data.id),
    })
    if (serviceCount) {
      throw new Error('CANNOT_DELETE: Services reference this category')
    }

    await db.delete(serviceCategories).where(eq(serviceCategories.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_category_deleted',
      details: { categoryId: data.id },
    })
  })
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/service-categories.ts
git commit -m "feat: add service category admin server functions"
```

---

### Task 7: Create service CRUD server functions

**Files:**
- Create: `app/server/fns/services.ts`

- [ ] **Step 1: Create the file with service management functions**

```typescript
// app/server/fns/services.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, desc, ilike, or, sql } from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  services, servicePackages, serviceImages, serviceCategories,
  negotiations, users, userLogs,
} from '~/lib/schema'
import { requireAuth } from '~/server/fns/auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import DOMPurify from 'isomorphic-dompurify'

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}

// ── Provider: Create service ──
export const createService = createServerFn({ method: 'POST' })
  .validator((input: {
    categoryId: string
    title: string
    description?: string
    city?: string
    country?: string
    bannerImage?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'service_provider' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const [service] = await db.insert(services).values({
      providerId: session.user.id,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description ? sanitizeHtml(data.description) : null,
      city: data.city || null,
      country: data.country || null,
      bannerImage: data.bannerImage || null,
    }).returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_created',
      details: { serviceId: service.id, title: data.title },
    })

    return service
  })

// ── Provider: Update service ──
export const updateService = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    categoryId?: string
    title?: string
    description?: string
    city?: string
    country?: string
    bannerImage?: string | null
    isActive?: boolean
    galleryImages?: { imageUrl: string; caption: string; sortOrder: number }[]
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const { id, galleryImages, ...updates } = data

    const existing = await db.query.services.findFirst({ where: eq(services.id, id) })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (updates.categoryId !== undefined) values.categoryId = updates.categoryId
    if (updates.title !== undefined) values.title = updates.title
    if (updates.description !== undefined) values.description = sanitizeHtml(updates.description)
    if (updates.city !== undefined) values.city = updates.city || null
    if (updates.country !== undefined) values.country = updates.country || null
    if (updates.bannerImage !== undefined) values.bannerImage = updates.bannerImage
    if (updates.isActive !== undefined) values.isActive = updates.isActive

    const [service] = await db.update(services).set(values).where(eq(services.id, id)).returning()

    // Sync gallery images if provided
    if (galleryImages !== undefined) {
      await db.delete(serviceImages).where(eq(serviceImages.serviceId, id))
      if (galleryImages.length > 0) {
        await db.insert(serviceImages).values(
          galleryImages.map((img) => ({
            serviceId: id,
            imageUrl: img.imageUrl,
            caption: img.caption || null,
            sortOrder: img.sortOrder,
          })),
        )
      }
    }

    return service
  })

// ── Provider: Delete service (blocked if negotiations exist) ──
export const deleteService = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const existing = await db.query.services.findFirst({ where: eq(services.id, data.id) })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const hasNegotiations = await db.query.negotiations.findFirst({
      where: eq(negotiations.serviceId, data.id),
    })
    if (hasNegotiations) {
      throw new Error('CANNOT_DELETE: Service has negotiations')
    }

    await db.delete(services).where(eq(services.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_deleted',
      details: { serviceId: data.id },
    })
  })

// ── Provider: List my services ──
export const listMyServices = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    return db.query.services.findMany({
      where: eq(services.providerId, session.user.id),
      with: {
        category: true,
        packages: { orderBy: [asc(servicePackages.sortOrder)] },
      },
      orderBy: [desc(services.createdAt)],
    })
  },
)

// ── Package CRUD ──
export const createPackage = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    name: string
    description?: string
    price?: string | null
    priceIsPublic?: boolean
    sortOrder?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')
    if (service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const [pkg] = await db.insert(servicePackages).values({
      serviceId: data.serviceId,
      name: data.name,
      description: data.description || null,
      price: data.price || null,
      priceIsPublic: data.priceIsPublic ?? true,
      sortOrder: data.sortOrder ?? 0,
    }).returning()

    return pkg
  })

export const updatePackage = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    name?: string
    description?: string
    price?: string | null
    priceIsPublic?: boolean
    sortOrder?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const pkg = await db.query.servicePackages.findFirst({
      where: eq(servicePackages.id, data.id),
      with: { service: true },
    })
    if (!pkg) throw new Error('NOT_FOUND')
    if (pkg.service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) values.name = data.name
    if (data.description !== undefined) values.description = data.description || null
    if (data.price !== undefined) values.price = data.price || null
    if (data.priceIsPublic !== undefined) values.priceIsPublic = data.priceIsPublic
    if (data.sortOrder !== undefined) values.sortOrder = data.sortOrder

    const [updated] = await db.update(servicePackages).set(values).where(eq(servicePackages.id, data.id)).returning()
    return updated
  })

export const deletePackage = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const pkg = await db.query.servicePackages.findFirst({
      where: eq(servicePackages.id, data.id),
      with: { service: true },
    })
    if (!pkg) throw new Error('NOT_FOUND')
    if (pkg.service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    await db.delete(servicePackages).where(eq(servicePackages.id, data.id))
  })

// ── Public: Browse services ──
export const browseServices = createServerFn({ method: 'GET' })
  .validator((input: {
    categoryId?: string
    keyword?: string
    city?: string
    country?: string
    page?: number
    limit?: number
  }) => input)
  .handler(async ({ data }) => {
    const page = data.page ?? 1
    const limit = data.limit ?? 12
    const offset = (page - 1) * limit

    const conditions = [
      eq(services.isActive, true),
    ]

    if (data.categoryId) {
      conditions.push(eq(services.categoryId, data.categoryId))
    }
    if (data.city) {
      conditions.push(ilike(services.city, `%${data.city}%`))
    }
    if (data.country) {
      conditions.push(ilike(services.country, `%${data.country}%`))
    }

    let results
    if (data.keyword) {
      const keyword = `%${data.keyword}%`
      results = await db.query.services.findMany({
        where: and(
          ...conditions,
          or(
            ilike(services.title, keyword),
            ilike(services.description, keyword),
          ),
        ),
        with: {
          category: true,
          packages: { orderBy: [asc(servicePackages.sortOrder)] },
          provider: { columns: { id: true, name: true, image: true, isActive: true } },
        },
        limit,
        offset,
        orderBy: [desc(services.createdAt)],
      })
    } else {
      results = await db.query.services.findMany({
        where: and(...conditions),
        with: {
          category: true,
          packages: { orderBy: [asc(servicePackages.sortOrder)] },
          provider: { columns: { id: true, name: true, image: true, isActive: true } },
        },
        limit,
        offset,
        orderBy: [desc(services.createdAt)],
      })
    }

    // Filter out services from inactive/suspended providers
    return results.filter((s) => s.provider.isActive)
  })

// ── Public: Get service detail ──
export const getService = createServerFn({ method: 'GET' })
  .validator((input: { serviceId: string }) => input)
  .handler(async ({ data }) => {
    const service = await db.query.services.findFirst({
      where: eq(services.id, data.serviceId),
      with: {
        category: true,
        packages: { orderBy: [asc(servicePackages.sortOrder)] },
        images: { orderBy: [asc(serviceImages.sortOrder)] },
        provider: { columns: { id: true, name: true, image: true, isActive: true } },
      },
    })
    if (!service) throw new Error('NOT_FOUND')
    return service
  })

// ── Admin: List all services ──
export const listAllServices = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:services:manage')
    return db.query.services.findMany({
      with: {
        category: true,
        provider: { columns: { id: true, name: true, email: true } },
      },
      orderBy: [desc(services.createdAt)],
    })
  },
)
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/services.ts
git commit -m "feat: add service CRUD + package CRUD + browse/detail server functions"
```

---

## Chunk 3: Negotiation Server Functions

### Task 8: Create negotiation server functions

**Files:**
- Create: `app/server/fns/negotiations.ts`

- [ ] **Step 1: Create the file with all negotiation lifecycle functions**

```typescript
// app/server/fns/negotiations.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, and, desc, asc, notInArray } from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  negotiations, negotiationRounds, eventServices,
  services, servicePackages, events, users, userLogs,
} from '~/lib/schema'
import { requireAuth } from '~/server/fns/auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

const TERMINAL_STATUSES = ['accepted', 'rejected', 'cancelled', 'expired']
const EXPIRY_DAYS = 14

function checkExpiry(negotiation: { status: string; updatedAt: Date }) {
  if (TERMINAL_STATUSES.includes(negotiation.status)) return negotiation.status
  const daysSinceUpdate = (Date.now() - new Date(negotiation.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpdate > EXPIRY_DAYS) return 'expired'
  return negotiation.status
}

// ── Organizer: Request quote (hidden-price services) ──
export const requestQuote = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    packageId?: string
    eventId: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'organizer' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')

    // Duplicate check
    const existing = await db.query.negotiations.findFirst({
      where: and(
        eq(negotiations.serviceId, data.serviceId),
        eq(negotiations.eventId, data.eventId),
        eq(negotiations.providerId, service.providerId),
        notInArray(negotiations.status, TERMINAL_STATUSES),
      ),
    })
    if (existing) throw new Error('DUPLICATE: Active negotiation already exists for this service + event')

    const [negotiation] = await db.insert(negotiations).values({
      eventId: data.eventId,
      serviceId: data.serviceId,
      packageId: data.packageId || null,
      organizerId: session.user.id,
      providerId: service.providerId,
      status: 'requested',
      initiatedBy: 'organizer',
    }).returning()

    // No initial round for quote requests — provider responds with first offer

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'quote_requested',
      details: { negotiationId: negotiation.id, serviceId: data.serviceId, eventId: data.eventId },
    })

    return negotiation
  })

// ── Organizer: Send direct offer (public-price services) ──
export const sendOffer = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    packageId?: string
    eventId: string
    price: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'organizer' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')

    // Duplicate check
    const existing = await db.query.negotiations.findFirst({
      where: and(
        eq(negotiations.serviceId, data.serviceId),
        eq(negotiations.eventId, data.eventId),
        eq(negotiations.providerId, service.providerId),
        notInArray(negotiations.status, TERMINAL_STATUSES),
      ),
    })
    if (existing) throw new Error('DUPLICATE: Active negotiation already exists for this service + event')

    const [negotiation] = await db.insert(negotiations).values({
      eventId: data.eventId,
      serviceId: data.serviceId,
      packageId: data.packageId || null,
      organizerId: session.user.id,
      providerId: service.providerId,
      status: 'offered',
      initiatedBy: 'organizer',
    }).returning()

    // Create initial round
    await db.insert(negotiationRounds).values({
      negotiationId: negotiation.id,
      senderId: session.user.id,
      action: 'offer',
      price: data.price,
      message: data.message || null,
      roundNumber: 1,
    })

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'offer_sent',
      details: { negotiationId: negotiation.id, price: data.price },
    })

    return negotiation
  })

// ── Provider: Send offer to organizer for a published event ──
export const sendProviderOffer = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    packageId?: string
    eventId: string
    price: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'service_provider' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    // Verify service ownership
    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')
    if (service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    // Verify event is published
    const event = await db.query.events.findFirst({ where: eq(events.id, data.eventId) })
    if (!event) throw new Error('NOT_FOUND')
    if (event.status !== 'published') throw new Error('FORBIDDEN: Event must be published')

    // Duplicate check
    const existing = await db.query.negotiations.findFirst({
      where: and(
        eq(negotiations.serviceId, data.serviceId),
        eq(negotiations.eventId, data.eventId),
        eq(negotiations.providerId, session.user.id),
        notInArray(negotiations.status, TERMINAL_STATUSES),
      ),
    })
    if (existing) throw new Error('DUPLICATE: Active negotiation already exists for this service + event')

    const [negotiation] = await db.insert(negotiations).values({
      eventId: data.eventId,
      serviceId: data.serviceId,
      packageId: data.packageId || null,
      organizerId: event.organizerId,
      providerId: session.user.id,
      status: 'offered',
      initiatedBy: 'provider',
    }).returning()

    await db.insert(negotiationRounds).values({
      negotiationId: negotiation.id,
      senderId: session.user.id,
      action: 'offer',
      price: data.price,
      message: data.message || null,
      roundNumber: 1,
    })

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'provider_offer_sent',
      details: { negotiationId: negotiation.id, eventId: data.eventId, price: data.price },
    })

    return negotiation
  })

// ── Respond to negotiation (accept/reject/counter) ──
export const respondToNegotiation = createServerFn({ method: 'POST' })
  .validator((input: {
    negotiationId: string
    action: 'offer' | 'counter' | 'accept' | 'reject'
    price?: string
    message?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const negotiation = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, data.negotiationId),
      with: { rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 } },
    })
    if (!negotiation) throw new Error('NOT_FOUND')

    // Verify participant
    const isOrganizer = negotiation.organizerId === session.user.id
    const isProvider = negotiation.providerId === session.user.id
    if (!isOrganizer && !isProvider && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    // Check expiry
    const currentStatus = checkExpiry(negotiation)
    if (currentStatus === 'expired') {
      await db.update(negotiations).set({ status: 'expired', updatedAt: new Date() }).where(eq(negotiations.id, data.negotiationId))
      throw new Error('NEGOTIATION_EXPIRED')
    }

    // Validate status transitions
    if (TERMINAL_STATUSES.includes(currentStatus)) {
      throw new Error('NEGOTIATION_CLOSED: Cannot respond to a terminal negotiation')
    }

    const lastRound = negotiation.rounds[0]
    const nextRoundNumber = (lastRound?.roundNumber ?? 0) + 1

    // For 'requested' status, only provider can respond with 'offer'
    if (currentStatus === 'requested') {
      if (!isProvider) throw new Error('FORBIDDEN: Only provider can respond to quote request')
      if (data.action !== 'offer') throw new Error('INVALID_ACTION: Must send an offer for quote request')
    }

    // Determine new status based on action
    let newStatus: string
    switch (data.action) {
      case 'offer':
        newStatus = 'offered'
        if (!data.price) throw new Error('PRICE_REQUIRED')
        break
      case 'counter':
        newStatus = currentStatus === 'offered' ? 'countered' : 'offered'
        if (!data.price) throw new Error('PRICE_REQUIRED')
        break
      case 'accept':
        newStatus = 'accepted'
        break
      case 'reject':
        newStatus = 'rejected'
        break
      default:
        throw new Error('INVALID_ACTION')
    }

    // Create the round
    await db.insert(negotiationRounds).values({
      negotiationId: data.negotiationId,
      senderId: session.user.id,
      action: data.action,
      price: data.price || null,
      message: data.message || null,
      roundNumber: nextRoundNumber,
    })

    // Update negotiation status
    await db.update(negotiations).set({
      status: newStatus,
      updatedAt: new Date(),
    }).where(eq(negotiations.id, data.negotiationId))

    // On accept: create event_services record
    if (newStatus === 'accepted') {
      // Find the last offer/counter round with a price
      const allRounds = await db.query.negotiationRounds.findMany({
        where: eq(negotiationRounds.negotiationId, data.negotiationId),
        orderBy: [desc(negotiationRounds.roundNumber)],
      })
      const priceRound = allRounds.find((r) => r.price !== null)

      await db.insert(eventServices).values({
        eventId: negotiation.eventId,
        serviceId: negotiation.serviceId,
        negotiationId: negotiation.id,
        providerId: negotiation.providerId,
        agreedPrice: priceRound?.price ?? '0',
        agreedTerms: priceRound?.message || null,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: `negotiation_${data.action}`,
      details: { negotiationId: data.negotiationId, price: data.price },
    })

    return { status: newStatus }
  })

// ── Cancel negotiation ──
export const cancelNegotiation = createServerFn({ method: 'POST' })
  .validator((input: { negotiationId: string; message?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const negotiation = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, data.negotiationId),
      with: { rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 } },
    })
    if (!negotiation) throw new Error('NOT_FOUND')

    const isOrganizer = negotiation.organizerId === session.user.id
    const isProvider = negotiation.providerId === session.user.id
    if (!isOrganizer && !isProvider && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    if (TERMINAL_STATUSES.includes(negotiation.status)) {
      throw new Error('NEGOTIATION_CLOSED')
    }

    const lastRound = negotiation.rounds[0]
    const nextRoundNumber = (lastRound?.roundNumber ?? 0) + 1

    await db.insert(negotiationRounds).values({
      negotiationId: data.negotiationId,
      senderId: session.user.id,
      action: 'cancel',
      message: data.message || null,
      roundNumber: nextRoundNumber,
    })

    await db.update(negotiations).set({
      status: 'cancelled',
      updatedAt: new Date(),
    }).where(eq(negotiations.id, data.negotiationId))

    return { status: 'cancelled' }
  })

// ── List my negotiations ──
export const listMyNegotiations = createServerFn({ method: 'GET' })
  .validator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const isProvider = session.user.role === 'service_provider'
    const conditions = [
      isProvider
        ? eq(negotiations.providerId, session.user.id)
        : eq(negotiations.organizerId, session.user.id),
    ]
    if (data.status) {
      conditions.push(eq(negotiations.status, data.status))
    }

    const results = await db.query.negotiations.findMany({
      where: and(...conditions),
      with: {
        event: { columns: { id: true, title: true, status: true } },
        service: { columns: { id: true, title: true } },
        organizer: { columns: { id: true, name: true, image: true } },
        provider: { columns: { id: true, name: true, image: true } },
        rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 },
      },
      orderBy: [desc(negotiations.updatedAt)],
    })

    // Apply lazy expiry
    return results.map((neg) => {
      const actualStatus = checkExpiry(neg)
      return { ...neg, status: actualStatus }
    })
  })

// ── Get negotiation detail (with lazy expiry check) ──
export const getNegotiation = createServerFn({ method: 'GET' })
  .validator((input: { negotiationId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const negotiation = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, data.negotiationId),
      with: {
        event: { columns: { id: true, title: true, status: true, startDate: true } },
        service: { columns: { id: true, title: true } },
        package: true,
        organizer: { columns: { id: true, name: true, image: true } },
        provider: { columns: { id: true, name: true, image: true } },
        rounds: { orderBy: [asc(negotiationRounds.roundNumber)] },
      },
    })
    if (!negotiation) throw new Error('NOT_FOUND')

    // Verify participant
    const isOrganizer = negotiation.organizerId === session.user.id
    const isProvider = negotiation.providerId === session.user.id
    if (!isOrganizer && !isProvider && session.user.role !== 'superadmin' && session.user.role !== 'admin') {
      throw new Error('FORBIDDEN')
    }

    // Lazy expiry
    const actualStatus = checkExpiry(negotiation)
    if (actualStatus === 'expired' && negotiation.status !== 'expired') {
      await db.update(negotiations).set({ status: 'expired', updatedAt: new Date() }).where(eq(negotiations.id, data.negotiationId))
    }

    return { ...negotiation, status: actualStatus }
  })

// ── Admin: List all negotiations ──
export const listAllNegotiations = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:negotiations:manage')
    return db.query.negotiations.findMany({
      with: {
        event: { columns: { id: true, title: true } },
        service: { columns: { id: true, title: true } },
        organizer: { columns: { id: true, name: true } },
        provider: { columns: { id: true, name: true } },
        rounds: { orderBy: [desc(negotiationRounds.roundNumber)], limit: 1 },
      },
      orderBy: [desc(negotiations.updatedAt)],
    })
  },
)
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/negotiations.ts
git commit -m "feat: add negotiation lifecycle server functions (quote, offer, respond, cancel)"
```

---

## Chunk 4: UI Components

### Task 9: Create NegotiationStatusBadge

**Files:**
- Create: `app/components/negotiations/NegotiationStatusBadge.tsx`

- [ ] **Step 1: Create the badge component**

```typescript
// app/components/negotiations/NegotiationStatusBadge.tsx
type NegotiationStatus = 'requested' | 'offered' | 'countered' | 'accepted' | 'rejected' | 'cancelled' | 'expired'

const STATUS_STYLES: Record<NegotiationStatus, { bg: string; text: string; label: string }> = {
  requested: { bg: 'bg-amber-100 dark:bg-amber-900', text: 'text-amber-800 dark:text-amber-300', label: 'Quote Requested' },
  offered: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-300', label: 'Offer Pending' },
  countered: { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-300', label: 'Counteroffer' },
  accepted: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-300', label: 'Accepted' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-300', label: 'Rejected' },
  cancelled: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Cancelled' },
  expired: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-300', label: 'Expired' },
}

export function NegotiationStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status as NegotiationStatus] ?? STATUS_STYLES.requested
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/negotiations/NegotiationStatusBadge.tsx
git commit -m "feat: add NegotiationStatusBadge component"
```

---

### Task 10: Create ServiceCard

**Files:**
- Create: `app/components/services/ServiceCard.tsx`

- [ ] **Step 1: Create the card component**

```typescript
// app/components/services/ServiceCard.tsx
import { Link } from '@tanstack/react-router'

interface ServiceCardProps {
  id: string
  title: string
  bannerImage: string | null
  city?: string | null
  country?: string | null
  category?: { name: string } | null
  packages?: { price: string | null; priceIsPublic: boolean }[]
  provider?: { name: string; image: string | null } | null
}

export function ServiceCard({ id, title, bannerImage, city, country, category, packages, provider }: ServiceCardProps) {
  const location = [city, country].filter(Boolean).join(', ')

  // Find the lowest public price
  const publicPrices = (packages ?? [])
    .filter((p) => p.priceIsPublic && p.price !== null)
    .map((p) => Number(p.price))
  const startingPrice = publicPrices.length > 0 ? Math.min(...publicPrices) : null

  return (
    <Link
      to="/services/$serviceId"
      params={{ serviceId: id }}
      className="group overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="relative h-48 bg-gray-200 dark:bg-gray-700">
        {bannerImage ? (
          <img src={bannerImage} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">No Image</div>
        )}
        {category && (
          <span className="absolute left-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
            {category.name}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{title}</h3>
        {location && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{location}</p>}
        {provider && <p className="mt-1 text-xs text-gray-400">by {provider.name}</p>}
        <p className="mt-2 text-sm font-medium">
          {startingPrice !== null ? `From €${startingPrice.toFixed(2)}` : 'Get a Quote'}
        </p>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/services/ServiceCard.tsx
git commit -m "feat: add ServiceCard component for marketplace browse"
```

---

### Task 11: Create ServiceFilters

**Files:**
- Create: `app/components/services/ServiceFilters.tsx`

- [ ] **Step 1: Create the filters component**

```typescript
// app/components/services/ServiceFilters.tsx
interface ServiceFiltersProps {
  categories: { id: string; name: string }[]
  selectedCategory: string
  keyword: string
  city: string
  onCategoryChange: (id: string) => void
  onKeywordChange: (keyword: string) => void
  onCityChange: (city: string) => void
}

export function ServiceFilters({
  categories, selectedCategory, keyword, city,
  onCategoryChange, onKeywordChange, onCityChange,
}: ServiceFiltersProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Search</label>
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="Search services..."
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Category</label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Location</label>
        <input
          type="text"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          placeholder="City..."
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/services/ServiceFilters.tsx
git commit -m "feat: add ServiceFilters sidebar component"
```

---

### Task 12: Create PackageCard

**Files:**
- Create: `app/components/services/PackageCard.tsx`

- [ ] **Step 1: Create the package card component**

```typescript
// app/components/services/PackageCard.tsx
interface PackageCardProps {
  name: string
  description: string | null
  price: string | null
  priceIsPublic: boolean
  onRequestQuote?: () => void
  onSendOffer?: () => void
}

export function PackageCard({ name, description, price, priceIsPublic, onRequestQuote, onSendOffer }: PackageCardProps) {
  const showPrice = priceIsPublic && price !== null

  return (
    <div className="rounded-lg border p-4 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{name}</h4>
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        <div className="text-right">
          {showPrice ? (
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">€{Number(price).toFixed(2)}</p>
          ) : (
            <p className="text-sm text-gray-500">Price on request</p>
          )}
        </div>
      </div>
      <div className="mt-3">
        {showPrice && onSendOffer ? (
          <button
            onClick={onSendOffer}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Send Offer
          </button>
        ) : onRequestQuote ? (
          <button
            onClick={onRequestQuote}
            className="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
          >
            Request a Quote
          </button>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/services/PackageCard.tsx
git commit -m "feat: add PackageCard component with price/quote display"
```

---

### Task 13: Create NegotiationCard

**Files:**
- Create: `app/components/negotiations/NegotiationCard.tsx`

- [ ] **Step 1: Create the card component**

```typescript
// app/components/negotiations/NegotiationCard.tsx
import { Link } from '@tanstack/react-router'
import { NegotiationStatusBadge } from './NegotiationStatusBadge'

interface NegotiationCardProps {
  id: string
  status: string
  event: { id: string; title: string }
  service: { id: string; title: string }
  otherParty: { name: string; image: string | null }
  lastPrice: string | null
  updatedAt: string
  linkPrefix: string // '/organizer/negotiations' or '/service-provider/negotiations'
}

export function NegotiationCard({
  id, status, event, service, otherParty, lastPrice, updatedAt, linkPrefix,
}: NegotiationCardProps) {
  const timeAgo = new Date(updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <Link
      to={`${linkPrefix}/${id}` as any}
      className="block rounded-lg border p-4 transition hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold">{service.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">for {event.title}</p>
          <div className="mt-1 flex items-center gap-2">
            {otherParty.image && (
              <img src={otherParty.image} alt="" className="h-5 w-5 rounded-full" />
            )}
            <span className="text-xs text-gray-400">{otherParty.name}</span>
          </div>
        </div>
        <div className="text-right">
          <NegotiationStatusBadge status={status} />
          {lastPrice && (
            <p className="mt-1 text-sm font-medium">€{Number(lastPrice).toFixed(2)}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{timeAgo}</p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/negotiations/NegotiationCard.tsx
git commit -m "feat: add NegotiationCard list item component"
```

---

### Task 14: Create NegotiationThread and NegotiationActions

**Files:**
- Create: `app/components/negotiations/NegotiationThread.tsx`
- Create: `app/components/negotiations/NegotiationActions.tsx`

- [ ] **Step 1: Create NegotiationThread**

```typescript
// app/components/negotiations/NegotiationThread.tsx
interface Round {
  id: string
  senderId: string
  action: string
  price: string | null
  message: string | null
  roundNumber: number
  createdAt: string
  sender?: { name: string; image: string | null }
}

interface NegotiationThreadProps {
  rounds: Round[]
  currentUserId: string
}

const ACTION_LABELS: Record<string, string> = {
  offer: 'Offer',
  counter: 'Counteroffer',
  accept: 'Accepted',
  reject: 'Rejected',
  cancel: 'Cancelled',
}

const ACTION_COLORS: Record<string, string> = {
  offer: 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20',
  counter: 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20',
  accept: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20',
  reject: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20',
  cancel: 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
}

export function NegotiationThread({ rounds, currentUserId }: NegotiationThreadProps) {
  return (
    <div className="space-y-4">
      {rounds.map((round) => {
        const isMe = round.senderId === currentUserId
        const colorClass = ACTION_COLORS[round.action] ?? ACTION_COLORS.offer
        const date = new Date(round.createdAt).toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        })

        return (
          <div
            key={round.id}
            className={`rounded-lg border p-4 ${colorClass} ${isMe ? 'ml-8' : 'mr-8'}`}
          >
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium">
                {isMe ? 'You' : round.sender?.name ?? 'Other party'} — {ACTION_LABELS[round.action] ?? round.action}
              </span>
              <span>{date}</span>
            </div>
            {round.price && (
              <p className="mt-2 text-lg font-bold">€{Number(round.price).toFixed(2)}</p>
            )}
            {round.message && (
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{round.message}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Create NegotiationActions**

```typescript
// app/components/negotiations/NegotiationActions.tsx
import { useState } from 'react'

interface NegotiationActionsProps {
  negotiationId: string
  status: string
  canRespond: boolean // true if it's this user's turn
  onRespond: (action: 'accept' | 'reject' | 'counter' | 'offer', price?: string, message?: string) => Promise<void>
  onCancel: () => Promise<void>
  isQuoteRequest?: boolean // true if status=requested and user is provider
}

export function NegotiationActions({
  negotiationId, status, canRespond, onRespond, onCancel, isQuoteRequest,
}: NegotiationActionsProps) {
  const [showCounter, setShowCounter] = useState(false)
  const [price, setPrice] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const isTerminal = ['accepted', 'rejected', 'cancelled', 'expired'].includes(status)

  if (isTerminal) return null

  async function handleAction(action: 'accept' | 'reject' | 'counter' | 'offer') {
    setLoading(true)
    try {
      await onRespond(action, price || undefined, message || undefined)
      setShowCounter(false)
      setPrice('')
      setMessage('')
    } finally {
      setLoading(false)
    }
  }

  // Provider responding to quote request
  if (isQuoteRequest) {
    return (
      <div className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
        <p className="text-sm font-medium">Send your offer:</p>
        <input
          type="number"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (€)"
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Terms and conditions..."
          rows={3}
          className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
        />
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('offer')}
            disabled={loading || !price}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Send Offer
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  if (!canRespond) {
    return (
      <div className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-700">
        <p className="text-sm text-gray-500">Waiting for the other party to respond...</p>
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          Withdraw
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
      {!showCounter ? (
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('accept')}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => handleAction('reject')}
            disabled={loading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            onClick={() => setShowCounter(true)}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Counter
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Withdraw
          </button>
        </div>
      ) : (
        <>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Your counter price (€)"
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Terms and conditions..."
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('counter')}
              disabled={loading || !price}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Send Counter
            </button>
            <button
              onClick={() => setShowCounter(false)}
              className="rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:text-gray-400"
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/components/negotiations/NegotiationThread.tsx app/components/negotiations/NegotiationActions.tsx
git commit -m "feat: add NegotiationThread and NegotiationActions components"
```

---

### Task 15: Create ServiceForm (multi-step)

**Files:**
- Create: `app/components/services/ServiceForm.tsx`

- [ ] **Step 1: Create the multi-step form component**

```typescript
// app/components/services/ServiceForm.tsx
import { useState } from 'react'
import { RichTextEditor } from '~/components/events/RichTextEditor'
import { ImageUploader } from '~/components/events/ImageUploader'
import { GalleryUploader, type GalleryImage } from '~/components/events/GalleryUploader'

export interface ServiceFormData {
  categoryId: string
  title: string
  description: string
  city: string
  country: string
  bannerImage: string | null
  galleryImages: GalleryImage[]
  packages: {
    id?: string
    name: string
    description: string
    price: string
    priceIsPublic: boolean
    sortOrder: number
  }[]
}

interface ServiceFormProps {
  initialData?: Partial<ServiceFormData>
  categories: { id: string; name: string }[]
  onSubmit: (data: ServiceFormData) => Promise<void>
  submitLabel?: string
}

export function ServiceForm({ initialData, categories, onSubmit, submitLabel }: ServiceFormProps) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<ServiceFormData>({
    categoryId: initialData?.categoryId ?? '',
    title: initialData?.title ?? '',
    description: initialData?.description ?? '',
    city: initialData?.city ?? '',
    country: initialData?.country ?? '',
    bannerImage: initialData?.bannerImage ?? null,
    galleryImages: initialData?.galleryImages ?? [],
    packages: initialData?.packages ?? [{ name: '', description: '', price: '', priceIsPublic: true, sortOrder: 0 }],
  })
  const [loading, setLoading] = useState(false)

  function updateField<K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addPackage() {
    setForm((prev) => ({
      ...prev,
      packages: [...prev.packages, { name: '', description: '', price: '', priceIsPublic: true, sortOrder: prev.packages.length }],
    }))
  }

  function updatePackage(index: number, field: string, value: unknown) {
    setForm((prev) => ({
      ...prev,
      packages: prev.packages.map((pkg, i) => i === index ? { ...pkg, [field]: value } : pkg),
    }))
  }

  function removePackage(index: number) {
    setForm((prev) => ({
      ...prev,
      packages: prev.packages.filter((_, i) => i !== index).map((pkg, i) => ({ ...pkg, sortOrder: i })),
    }))
  }

  async function handleSubmit() {
    setLoading(true)
    try {
      await onSubmit(form)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              step === s
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {s === 1 ? 'Details' : s === 2 ? 'Packages' : 'Gallery'}
          </button>
        ))}
      </div>

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category *</label>
            <select
              value={form.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <RichTextEditor
              content={form.description}
              onChange={(html) => updateField('description', html)}
              placeholder="Describe your service..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <input type="text" value={form.city} onChange={(e) => updateField('city', e.target.value)} className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Country</label>
              <input type="text" value={form.country} onChange={(e) => updateField('country', e.target.value)} className="w-full rounded-lg border px-3 py-2 dark:border-gray-600 dark:bg-gray-800" />
            </div>
          </div>
          <ImageUploader value={form.bannerImage} onChange={(url) => updateField('bannerImage', url)} purpose="banner" label="Banner Image" />
          <button onClick={() => setStep(2)} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Next: Packages
          </button>
        </div>
      )}

      {/* Step 2: Packages */}
      {step === 2 && (
        <div className="space-y-4">
          {form.packages.map((pkg, i) => (
            <div key={i} className="rounded-lg border p-4 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium">Package {i + 1}</h4>
                {form.packages.length > 1 && (
                  <button onClick={() => removePackage(i)} className="text-xs text-red-600 hover:underline">Remove</button>
                )}
              </div>
              <div className="space-y-3">
                <input type="text" value={pkg.name} onChange={(e) => updatePackage(i, 'name', e.target.value)} placeholder="Package name *" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
                <input type="text" value={pkg.description} onChange={(e) => updatePackage(i, 'description', e.target.value)} placeholder="Description" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
                <div className="flex gap-3">
                  <input type="number" step="0.01" value={pkg.price} onChange={(e) => updatePackage(i, 'price', e.target.value)} placeholder="Price (€) — leave empty for quote" className="flex-1 rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={pkg.priceIsPublic} onChange={(e) => updatePackage(i, 'priceIsPublic', e.target.checked)} />
                    Public price
                  </label>
                </div>
              </div>
            </div>
          ))}
          <button onClick={addPackage} className="rounded-lg border border-dashed px-4 py-2 text-sm text-gray-500 hover:border-gray-400">
            + Add Package
          </button>
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="rounded-lg border px-6 py-2 text-sm">Back</button>
            <button onClick={() => setStep(3)} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Next: Gallery
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Gallery */}
      {step === 3 && (
        <div className="space-y-4">
          <GalleryUploader images={form.galleryImages} onChange={(imgs) => updateField('galleryImages', imgs)} />
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="rounded-lg border px-6 py-2 text-sm">Back</button>
            <button onClick={handleSubmit} disabled={loading || !form.title || !form.categoryId} className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {loading ? 'Saving...' : submitLabel ?? 'Create Service'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/services/ServiceForm.tsx
git commit -m "feat: add ServiceForm multi-step component (details, packages, gallery)"
```

---

### Task 16: Create EventServicesList

**Files:**
- Create: `app/components/events/EventServicesList.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/components/events/EventServicesList.tsx
interface EventService {
  id: string
  agreedPrice: string
  provider: { id: string; name: string; image: string | null }
  service: { id: string; title: string }
}

export function EventServicesList({ services }: { services: EventService[] }) {
  if (services.length === 0) return null

  return (
    <div className="mt-8">
      <h2 className="mb-4 text-xl font-bold">Service Providers</h2>
      <div className="space-y-3">
        {services.map((es) => (
          <div key={es.id} className="flex items-center justify-between rounded-lg border p-4 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {es.provider.image ? (
                <img src={es.provider.image} alt="" className="h-10 w-10 rounded-full" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium dark:bg-gray-700">
                  {es.provider.name.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-medium">{es.provider.name}</p>
                <p className="text-sm text-gray-500">{es.service.title}</p>
              </div>
            </div>
            <p className="font-semibold text-green-600">€{Number(es.agreedPrice).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/events/EventServicesList.tsx
git commit -m "feat: add EventServicesList component for event detail page"
```

---

## Chunk 5: Routes — Public Marketplace + Service Provider

### Task 17: Create public marketplace browse page

**Files:**
- Create: `app/routes/services/index.tsx`

- [ ] **Step 1: Create the browse page**

```typescript
// app/routes/services/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { browseServices } from '~/server/fns/services'
import { listServiceCategories } from '~/server/fns/service-categories'
import { ServiceCard } from '~/components/services/ServiceCard'
import { ServiceFilters } from '~/components/services/ServiceFilters'

export const Route = createFileRoute('/services/')({
  component: ServicesPage,
})

function ServicesPage() {
  const [services, setServices] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [keyword, setKeyword] = useState('')
  const [city, setCity] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  async function fetchCategories() {
    const cats = await listServiceCategories()
    setCategories(cats)
  }

  async function fetchServices() {
    setLoading(true)
    const result = await browseServices({
      data: {
        categoryId: categoryId || undefined,
        keyword: keyword || undefined,
        city: city || undefined,
        page,
      },
    })
    setServices(result)
    setLoading(false)
  }

  useEffect(() => { fetchCategories() }, [])
  useEffect(() => { setPage(1); fetchServices() }, [categoryId, keyword, city])
  useEffect(() => { fetchServices() }, [page])

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="mb-8 text-3xl font-bold">Service Marketplace</h1>
      <div className="flex gap-8">
        <aside className="w-64 shrink-0">
          <ServiceFilters
            categories={categories}
            selectedCategory={categoryId}
            keyword={keyword}
            city={city}
            onCategoryChange={setCategoryId}
            onKeywordChange={setKeyword}
            onCityChange={setCity}
          />
        </aside>
        <main className="flex-1">
          {loading ? (
            <p className="text-gray-500">Loading...</p>
          ) : services.length === 0 ? (
            <p className="text-gray-500">No services found.</p>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((s) => (
                  <ServiceCard
                    key={s.id}
                    id={s.id}
                    title={s.title}
                    bannerImage={s.bannerImage}
                    city={s.city}
                    country={s.country}
                    category={s.category}
                    packages={s.packages}
                    provider={s.provider}
                  />
                ))}
              </div>
              <div className="mt-8 flex justify-center gap-2">
                {page > 1 && (
                  <button onClick={() => setPage(page - 1)} className="rounded-lg border px-4 py-2 text-sm">Previous</button>
                )}
                {services.length === 12 && (
                  <button onClick={() => setPage(page + 1)} className="rounded-lg border px-4 py-2 text-sm">Next</button>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/services/index.tsx
git commit -m "feat: add public service marketplace browse page"
```

---

### Task 18: Create public service detail page

**Files:**
- Create: `app/routes/services/$serviceId.tsx`

- [ ] **Step 1: Create the detail page**

```typescript
// app/routes/services/$serviceId.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { getService } from '~/server/fns/services'
import { requestQuote, sendOffer } from '~/server/fns/negotiations'
import { PackageCard } from '~/components/services/PackageCard'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/services/$serviceId')({
  loader: async ({ params }) => {
    const service = await getService({ data: { serviceId: params.serviceId } })
    return { service }
  },
  component: ServiceDetailPage,
})

function ServiceDetailPage() {
  const { service } = Route.useLoaderData()
  const session = useSession()
  const navigate = useNavigate()
  const user = session.data?.user
  const isOrganizer = user?.role === 'organizer' || user?.role === 'superadmin'

  const [showOfferModal, setShowOfferModal] = useState(false)
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null)
  const [eventId, setEventId] = useState('')
  const [offerPrice, setOfferPrice] = useState('')
  const [offerMessage, setOfferMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequestQuote(packageId: string) {
    if (!isOrganizer) { navigate({ to: '/login' }); return }
    setSelectedPackageId(packageId)
    setShowOfferModal(true)
  }

  async function handleSendOffer(packageId: string) {
    if (!isOrganizer) { navigate({ to: '/login' }); return }
    setSelectedPackageId(packageId)
    const pkg = service.packages.find((p: any) => p.id === packageId)
    if (pkg?.price) setOfferPrice(pkg.price)
    setShowOfferModal(true)
  }

  async function submitOffer() {
    if (!eventId) return
    setLoading(true)
    try {
      const pkg = service.packages.find((p: any) => p.id === selectedPackageId)
      const isQuote = !pkg?.priceIsPublic || !pkg?.price

      if (isQuote) {
        await requestQuote({
          data: { serviceId: service.id, packageId: selectedPackageId || undefined, eventId, message: offerMessage || undefined },
        })
      } else {
        await sendOffer({
          data: { serviceId: service.id, packageId: selectedPackageId || undefined, eventId, price: offerPrice, message: offerMessage || undefined },
        })
      }
      setShowOfferModal(false)
      navigate({ to: '/organizer/negotiations' })
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Banner */}
      {service.bannerImage && (
        <img src={service.bannerImage} alt={service.title} className="mb-6 h-64 w-full rounded-xl object-cover" />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{service.title}</h1>
          {service.category && (
            <span className="mt-2 inline-block rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              {service.category.name}
            </span>
          )}
          {(service.city || service.country) && (
            <p className="mt-2 text-gray-500">{[service.city, service.country].filter(Boolean).join(', ')}</p>
          )}
        </div>
        {service.provider && (
          <div className="flex items-center gap-2">
            {service.provider.image && <img src={service.provider.image} alt="" className="h-10 w-10 rounded-full" />}
            <span className="text-sm font-medium">{service.provider.name}</span>
          </div>
        )}
      </div>

      {/* Description */}
      {service.description && (
        <div className="prose prose-sm mt-6 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: service.description }} />
      )}

      {/* Packages */}
      <h2 className="mt-8 mb-4 text-xl font-bold">Packages</h2>
      <div className="space-y-4">
        {service.packages.map((pkg: any) => (
          <PackageCard
            key={pkg.id}
            name={pkg.name}
            description={pkg.description}
            price={pkg.price}
            priceIsPublic={pkg.priceIsPublic}
            onRequestQuote={isOrganizer ? () => handleRequestQuote(pkg.id) : undefined}
            onSendOffer={isOrganizer ? () => handleSendOffer(pkg.id) : undefined}
          />
        ))}
      </div>

      {/* Gallery */}
      {service.images?.length > 0 && (
        <>
          <h2 className="mt-8 mb-4 text-xl font-bold">Portfolio</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {service.images.map((img: any) => (
              <div key={img.id} className="overflow-hidden rounded-lg">
                <img src={img.imageUrl} alt={img.caption || ''} className="h-48 w-full object-cover" />
                {img.caption && <p className="p-2 text-xs text-gray-500">{img.caption}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Offer Modal */}
      {showOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-bold">Send Offer</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Event ID *</label>
                <input type="text" value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="Paste your event ID" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
                <p className="mt-1 text-xs text-gray-400">Find this on your event edit page</p>
              </div>
              {offerPrice && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Proposed Price (€)</label>
                  <input type="number" step="0.01" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Message</label>
                <textarea value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} rows={3} placeholder="Any notes or terms..." className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowOfferModal(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitOffer} disabled={loading || !eventId} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/services/\$serviceId.tsx
git commit -m "feat: add public service detail page with offer/quote modal"
```

---

### Task 19: Create service provider layout and dashboard

**Files:**
- Create: `app/routes/service-provider/route.tsx`
- Create: `app/routes/service-provider/index.tsx`

- [ ] **Step 1: Create the layout route**

```typescript
// app/routes/service-provider/route.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getSession } from '~/server/fns/auth-helpers'

export const Route = createFileRoute('/service-provider')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) throw redirect({ to: '/login' })
  },
  component: ServiceProviderLayout,
})

function ServiceProviderLayout() {
  return <Outlet />
}
```

- [ ] **Step 2: Create the dashboard**

```typescript
// app/routes/service-provider/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listMyServices } from '~/server/fns/services'
import { listMyNegotiations } from '~/server/fns/negotiations'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'

export const Route = createFileRoute('/service-provider/')({
  component: ProviderDashboard,
})

function ProviderDashboard() {
  const [services, setServices] = useState<any[]>([])
  const [negotiations, setNegotiations] = useState<any[]>([])

  useEffect(() => {
    listMyServices().then(setServices)
    listMyNegotiations({ data: {} }).then(setNegotiations)
  }, [])

  const activeNegotiations = negotiations.filter((n) =>
    !['accepted', 'rejected', 'cancelled', 'expired'].includes(n.status),
  )

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Service Provider Dashboard</h1>
        <Link to="/service-provider/services/new" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          + New Service
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <p className="text-2xl font-bold">{services.length}</p>
          <p className="text-sm text-gray-500">Services</p>
        </div>
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <p className="text-2xl font-bold">{activeNegotiations.length}</p>
          <p className="text-sm text-gray-500">Active Negotiations</p>
        </div>
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <p className="text-2xl font-bold">{negotiations.filter((n) => n.status === 'accepted').length}</p>
          <p className="text-sm text-gray-500">Deals Closed</p>
        </div>
      </div>

      {/* My Services */}
      <h2 className="mb-4 text-lg font-bold">My Services</h2>
      {services.length === 0 ? (
        <p className="text-gray-500">No services yet. Create your first listing!</p>
      ) : (
        <div className="mb-8 space-y-2">
          {services.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-gray-500">{s.category?.name} — {s.packages.length} package(s)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${s.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                  {s.isActive ? 'Active' : 'Inactive'}
                </span>
                <Link to="/service-provider/services/$serviceId/edit" params={{ serviceId: s.id }} className="rounded border px-3 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-800">
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent Negotiations */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Recent Negotiations</h2>
        <Link to="/service-provider/negotiations" className="text-sm text-indigo-600 hover:underline">View all</Link>
      </div>
      {negotiations.slice(0, 5).map((n) => (
        <Link
          key={n.id}
          to="/service-provider/negotiations/$negotiationId"
          params={{ negotiationId: n.id }}
          className="mb-2 flex items-center justify-between rounded-lg border p-3 dark:border-gray-700 hover:shadow-sm"
        >
          <div>
            <p className="text-sm font-medium">{n.service?.title}</p>
            <p className="text-xs text-gray-500">for {n.event?.title} — {n.organizer?.name}</p>
          </div>
          <NegotiationStatusBadge status={n.status} />
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/service-provider/route.tsx app/routes/service-provider/index.tsx
git commit -m "feat: add service provider layout and dashboard"
```

---

### Task 20: Create service provider CRUD routes

**Files:**
- Create: `app/routes/service-provider/services/new.tsx`
- Create: `app/routes/service-provider/services/$serviceId.edit.tsx`

- [ ] **Step 1: Create new service page**

```typescript
// app/routes/service-provider/services/new.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ServiceForm, type ServiceFormData } from '~/components/services/ServiceForm'
import { createService, createPackage, updateService } from '~/server/fns/services'
import { listServiceCategories } from '~/server/fns/service-categories'

export const Route = createFileRoute('/service-provider/services/new')({
  component: NewServicePage,
})

function NewServicePage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => { listServiceCategories().then(setCategories) }, [])

  async function handleSubmit(data: ServiceFormData) {
    const service = await createService({
      data: {
        categoryId: data.categoryId,
        title: data.title,
        description: data.description || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        bannerImage: data.bannerImage || undefined,
      },
    })

    // Create packages
    for (const pkg of data.packages) {
      if (!pkg.name) continue
      await createPackage({
        data: {
          serviceId: service.id,
          name: pkg.name,
          description: pkg.description || undefined,
          price: pkg.price || null,
          priceIsPublic: pkg.priceIsPublic,
          sortOrder: pkg.sortOrder,
        },
      })
    }

    // Sync gallery images
    if (data.galleryImages.length > 0) {
      await updateService({
        data: { id: service.id, galleryImages: data.galleryImages },
      })
    }

    navigate({ to: '/service-provider' })
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">Create Service</h1>
      <ServiceForm categories={categories} onSubmit={handleSubmit} />
    </div>
  )
}
```

- [ ] **Step 2: Create edit service page**

```typescript
// app/routes/service-provider/services/$serviceId.edit.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { ServiceForm, type ServiceFormData } from '~/components/services/ServiceForm'
import { getService, updateService, createPackage, updatePackage, deletePackage, deleteService } from '~/server/fns/services'
import { listServiceCategories } from '~/server/fns/service-categories'

export const Route = createFileRoute('/service-provider/services/$serviceId/edit')({
  loader: async ({ params }) => {
    const service = await getService({ data: { serviceId: params.serviceId } })
    return { service }
  },
  component: EditServicePage,
})

function EditServicePage() {
  const { service } = Route.useLoaderData()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => { listServiceCategories().then(setCategories) }, [])

  const initialData: Partial<ServiceFormData> = {
    categoryId: service.categoryId,
    title: service.title,
    description: service.description ?? '',
    city: service.city ?? '',
    country: service.country ?? '',
    bannerImage: service.bannerImage,
    galleryImages: (service.images ?? []).map((img: any) => ({
      imageUrl: img.imageUrl,
      caption: img.caption ?? '',
      sortOrder: img.sortOrder,
    })),
    packages: (service.packages ?? []).map((pkg: any) => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description ?? '',
      price: pkg.price ?? '',
      priceIsPublic: pkg.priceIsPublic,
      sortOrder: pkg.sortOrder,
    })),
  }

  async function handleSubmit(data: ServiceFormData) {
    await updateService({
      data: {
        id: service.id,
        categoryId: data.categoryId,
        title: data.title,
        description: data.description || undefined,
        city: data.city || undefined,
        country: data.country || undefined,
        bannerImage: data.bannerImage,
        galleryImages: data.galleryImages,
      },
    })

    // Sync packages: update existing, create new, delete removed
    const existingIds = new Set(data.packages.filter((p) => p.id).map((p) => p.id!))
    const originalIds = (service.packages ?? []).map((p: any) => p.id)

    for (const oldId of originalIds) {
      if (!existingIds.has(oldId)) {
        await deletePackage({ data: { id: oldId } })
      }
    }

    for (const pkg of data.packages) {
      if (!pkg.name) continue
      if (pkg.id) {
        await updatePackage({
          data: {
            id: pkg.id,
            name: pkg.name,
            description: pkg.description || undefined,
            price: pkg.price || null,
            priceIsPublic: pkg.priceIsPublic,
            sortOrder: pkg.sortOrder,
          },
        })
      } else {
        await createPackage({
          data: {
            serviceId: service.id,
            name: pkg.name,
            description: pkg.description || undefined,
            price: pkg.price || null,
            priceIsPublic: pkg.priceIsPublic,
            sortOrder: pkg.sortOrder,
          },
        })
      }
    }

    navigate({ to: '/service-provider' })
  }

  async function handleDelete() {
    if (!confirm('Delete this service?')) return
    try {
      await deleteService({ data: { id: service.id } })
      navigate({ to: '/service-provider' })
    } catch (err: any) {
      alert(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Edit Service</h1>
        <button onClick={handleDelete} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
          Delete Service
        </button>
      </div>
      <ServiceForm initialData={initialData} categories={categories} onSubmit={handleSubmit} submitLabel="Save Changes" />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/service-provider/services/
git commit -m "feat: add service provider create/edit service pages"
```

---

## Chunk 6: Negotiation Routes + Admin + Modifications

### Task 21: Create provider and organizer negotiation routes

**Files:**
- Create: `app/routes/service-provider/negotiations/index.tsx`
- Create: `app/routes/service-provider/negotiations/$negotiationId.tsx`
- Create: `app/routes/organizer/negotiations/index.tsx`
- Create: `app/routes/organizer/negotiations/$negotiationId.tsx`

- [ ] **Step 1: Create provider negotiations list**

```typescript
// app/routes/service-provider/negotiations/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listMyNegotiations } from '~/server/fns/negotiations'
import { NegotiationCard } from '~/components/negotiations/NegotiationCard'

export const Route = createFileRoute('/service-provider/negotiations/')({
  component: ProviderNegotiationsPage,
})

function ProviderNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    listMyNegotiations({ data: { status: statusFilter || undefined } }).then(setNegotiations)
  }, [statusFilter])

  const STATUSES = ['', 'requested', 'offered', 'countered', 'accepted', 'rejected', 'cancelled', 'expired']

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">My Negotiations</h1>
      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {negotiations.map((n) => (
          <NegotiationCard
            key={n.id}
            id={n.id}
            status={n.status}
            event={n.event}
            service={n.service}
            otherParty={n.organizer}
            lastPrice={n.rounds?.[0]?.price ?? null}
            updatedAt={n.updatedAt}
            linkPrefix="/service-provider/negotiations"
          />
        ))}
        {negotiations.length === 0 && <p className="text-gray-500">No negotiations yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create provider negotiation detail (shared pattern for both roles)**

```typescript
// app/routes/service-provider/negotiations/$negotiationId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { getNegotiation, respondToNegotiation, cancelNegotiation } from '~/server/fns/negotiations'
import { NegotiationThread } from '~/components/negotiations/NegotiationThread'
import { NegotiationActions } from '~/components/negotiations/NegotiationActions'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/service-provider/negotiations/$negotiationId')({
  loader: async ({ params }) => {
    const negotiation = await getNegotiation({ data: { negotiationId: params.negotiationId } })
    return { negotiation }
  },
  component: ProviderNegotiationDetailPage,
})

function ProviderNegotiationDetailPage() {
  const [negotiation, setNegotiation] = useState(Route.useLoaderData().negotiation)
  const session = useSession()
  const userId = session.data?.user?.id ?? ''

  const isProvider = negotiation.providerId === userId
  const lastRound = negotiation.rounds?.[negotiation.rounds.length - 1]
  const isMyTurn = lastRound ? lastRound.senderId !== userId : negotiation.status === 'requested' && isProvider
  const isQuoteRequest = negotiation.status === 'requested' && isProvider

  const reload = useCallback(async () => {
    const updated = await getNegotiation({ data: { negotiationId: negotiation.id } })
    setNegotiation(updated)
  }, [negotiation.id])

  async function handleRespond(action: 'accept' | 'reject' | 'counter' | 'offer', price?: string, message?: string) {
    await respondToNegotiation({
      data: { negotiationId: negotiation.id, action, price, message },
    })
    await reload()
  }

  async function handleCancel() {
    await cancelNegotiation({ data: { negotiationId: negotiation.id } })
    await reload()
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{negotiation.service?.title}</h1>
          <p className="text-sm text-gray-500">for {negotiation.event?.title}</p>
        </div>
        <NegotiationStatusBadge status={negotiation.status} />
      </div>

      <NegotiationThread rounds={negotiation.rounds ?? []} currentUserId={userId} />

      <div className="mt-6">
        <NegotiationActions
          negotiationId={negotiation.id}
          status={negotiation.status}
          canRespond={isMyTurn}
          onRespond={handleRespond}
          onCancel={handleCancel}
          isQuoteRequest={isQuoteRequest}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create organizer negotiations list (same pattern, different linkPrefix)**

```typescript
// app/routes/organizer/negotiations/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listMyNegotiations } from '~/server/fns/negotiations'
import { NegotiationCard } from '~/components/negotiations/NegotiationCard'

export const Route = createFileRoute('/organizer/negotiations/')({
  component: OrganizerNegotiationsPage,
})

function OrganizerNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    listMyNegotiations({ data: { status: statusFilter || undefined } }).then(setNegotiations)
  }, [statusFilter])

  const STATUSES = ['', 'requested', 'offered', 'countered', 'accepted', 'rejected', 'cancelled', 'expired']

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">My Negotiations</h1>
      <div className="mb-4 flex gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {negotiations.map((n) => (
          <NegotiationCard
            key={n.id}
            id={n.id}
            status={n.status}
            event={n.event}
            service={n.service}
            otherParty={n.provider}
            lastPrice={n.rounds?.[0]?.price ?? null}
            updatedAt={n.updatedAt}
            linkPrefix="/organizer/negotiations"
          />
        ))}
        {negotiations.length === 0 && <p className="text-gray-500">No negotiations yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create organizer negotiation detail (same as provider but isOrganizer)**

```typescript
// app/routes/organizer/negotiations/$negotiationId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { getNegotiation, respondToNegotiation, cancelNegotiation } from '~/server/fns/negotiations'
import { NegotiationThread } from '~/components/negotiations/NegotiationThread'
import { NegotiationActions } from '~/components/negotiations/NegotiationActions'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/organizer/negotiations/$negotiationId')({
  loader: async ({ params }) => {
    const negotiation = await getNegotiation({ data: { negotiationId: params.negotiationId } })
    return { negotiation }
  },
  component: OrganizerNegotiationDetailPage,
})

function OrganizerNegotiationDetailPage() {
  const [negotiation, setNegotiation] = useState(Route.useLoaderData().negotiation)
  const session = useSession()
  const userId = session.data?.user?.id ?? ''

  const lastRound = negotiation.rounds?.[negotiation.rounds.length - 1]
  const isMyTurn = lastRound ? lastRound.senderId !== userId : false

  const reload = useCallback(async () => {
    const updated = await getNegotiation({ data: { negotiationId: negotiation.id } })
    setNegotiation(updated)
  }, [negotiation.id])

  async function handleRespond(action: 'accept' | 'reject' | 'counter' | 'offer', price?: string, message?: string) {
    await respondToNegotiation({
      data: { negotiationId: negotiation.id, action, price, message },
    })
    await reload()
  }

  async function handleCancel() {
    await cancelNegotiation({ data: { negotiationId: negotiation.id } })
    await reload()
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{negotiation.service?.title}</h1>
          <p className="text-sm text-gray-500">for {negotiation.event?.title}</p>
        </div>
        <NegotiationStatusBadge status={negotiation.status} />
      </div>

      <NegotiationThread rounds={negotiation.rounds ?? []} currentUserId={userId} />

      <div className="mt-6">
        <NegotiationActions
          negotiationId={negotiation.id}
          status={negotiation.status}
          canRespond={isMyTurn}
          onRespond={handleRespond}
          onCancel={handleCancel}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/service-provider/negotiations/ app/routes/organizer/negotiations/
git commit -m "feat: add provider and organizer negotiation list + detail routes"
```

---

### Task 22: Create admin routes

**Files:**
- Create: `app/routes/admin/service-categories.tsx`
- Create: `app/routes/admin/services.tsx`
- Create: `app/routes/admin/negotiations.tsx`

- [ ] **Step 1: Create admin service categories page**

```typescript
// app/routes/admin/service-categories.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import {
  listAllServiceCategories, createServiceCategory,
  updateServiceCategory, deleteServiceCategory,
} from '~/server/fns/service-categories'

export const Route = createFileRoute('/admin/service-categories')({
  component: ServiceCategoriesPage,
})

function ServiceCategoriesPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function fetchCategories() {
    const result = await listAllServiceCategories()
    setCategories(result)
  }

  useEffect(() => { fetchCategories() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingId) {
      await updateServiceCategory({ data: { id: editingId, name, description, sortOrder } })
    } else {
      await createServiceCategory({ data: { name, description, sortOrder } })
    }
    setShowForm(false)
    setEditingId(null)
    setName('')
    setDescription('')
    setSortOrder(0)
    fetchCategories()
  }

  function startEdit(cat: any) {
    setEditingId(cat.id)
    setName(cat.name)
    setDescription(cat.description ?? '')
    setSortOrder(cat.sortOrder)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return
    try {
      await deleteServiceCategory({ data: { id } })
      fetchCategories()
    } catch (err: any) {
      alert(err.message)
    }
  }

  async function toggleActive(cat: any) {
    await updateServiceCategory({ data: { id: cat.id, isActive: !cat.isActive } })
    fetchCategories()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Service Categories</h1>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setName(''); setDescription(''); setSortOrder(0) }} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          {showForm ? 'Cancel' : '+ Add Category'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-4 dark:border-gray-700">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Category name *" required className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="w-full rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} placeholder="Sort order" className="w-32 rounded-lg border px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            {editingId ? 'Update' : 'Create'}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
            <div>
              <span className="font-medium">{cat.name}</span>
              <span className="ml-2 text-xs text-gray-400">#{cat.sortOrder}</span>
              {!cat.isActive && <span className="ml-2 text-xs text-red-500">(inactive)</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleActive(cat)} className="text-xs text-gray-500 hover:underline">
                {cat.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => startEdit(cat)} className="text-xs text-indigo-600 hover:underline">Edit</button>
              <button onClick={() => handleDelete(cat.id)} className="text-xs text-red-600 hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create admin services moderation page**

```typescript
// app/routes/admin/services.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listAllServices } from '~/server/fns/services'

export const Route = createFileRoute('/admin/services')({
  component: AdminServicesPage,
})

function AdminServicesPage() {
  const [services, setServices] = useState<any[]>([])

  useEffect(() => { listAllServices().then(setServices) }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Services</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Active</th>
              <th className="px-4 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id} className="border-b dark:border-gray-700">
                <td className="px-4 py-2 font-medium">{s.title}</td>
                <td className="px-4 py-2">{s.category?.name}</td>
                <td className="px-4 py-2">{s.provider?.name}</td>
                <td className="px-4 py-2">
                  <span className={s.isActive ? 'text-green-600' : 'text-red-500'}>{s.isActive ? 'Yes' : 'No'}</span>
                </td>
                <td className="px-4 py-2 text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create admin negotiations page**

```typescript
// app/routes/admin/negotiations.tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listAllNegotiations } from '~/server/fns/negotiations'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'

export const Route = createFileRoute('/admin/negotiations')({
  component: AdminNegotiationsPage,
})

function AdminNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<any[]>([])

  useEffect(() => { listAllNegotiations().then(setNegotiations) }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Negotiations</h1>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Event</th>
              <th className="px-4 py-2">Service</th>
              <th className="px-4 py-2">Organizer</th>
              <th className="px-4 py-2">Provider</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Last Price</th>
              <th className="px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {negotiations.map((n) => (
              <tr key={n.id} className="border-b dark:border-gray-700">
                <td className="px-4 py-2">{n.event?.title}</td>
                <td className="px-4 py-2">{n.service?.title}</td>
                <td className="px-4 py-2">{n.organizer?.name}</td>
                <td className="px-4 py-2">{n.provider?.name}</td>
                <td className="px-4 py-2"><NegotiationStatusBadge status={n.status} /></td>
                <td className="px-4 py-2">{n.rounds?.[0]?.price ? `€${Number(n.rounds[0].price).toFixed(2)}` : '—'}</td>
                <td className="px-4 py-2 text-xs text-gray-400">{new Date(n.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/admin/service-categories.tsx app/routes/admin/services.tsx app/routes/admin/negotiations.tsx
git commit -m "feat: add admin service categories, services, and negotiations pages"
```

---

### Task 23: Update AdminSidebar with Phase 3 menu items

**Files:**
- Modify: `app/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add 3 new sidebar items to SIDEBAR_ITEMS array**

Add after the existing Events item:

```typescript
  { label: 'Service Categories', href: '/admin/service-categories', capability: 'admin:service-categories:manage' },
  { label: 'Services', href: '/admin/services', capability: 'admin:services:manage' },
  { label: 'Negotiations', href: '/admin/negotiations', capability: 'admin:negotiations:manage' },
```

- [ ] **Step 2: Commit**

```bash
git add app/components/layout/AdminSidebar.tsx
git commit -m "feat: add Phase 3 items to admin sidebar"
```

---

### Task 24: Update admin route capList

**Files:**
- Modify: `app/routes/admin/route.tsx`

- [ ] **Step 1: Add new capabilities to the capList array**

Find the array that lists capabilities to fetch for the admin layout and add:

```typescript
  'admin:service-categories:manage',
  'admin:services:manage',
  'admin:negotiations:manage',
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/admin/route.tsx
git commit -m "feat: add Phase 3 capabilities to admin route"
```

---

### Task 25: Add EventServicesList to event detail page

**Files:**
- Modify: `app/routes/events/$eventId.tsx`

- [ ] **Step 1: Import EventServicesList**

At the top of the file, add:

```typescript
import { EventServicesList } from '~/components/events/EventServicesList'
```

- [ ] **Step 2: Load event services in the loader or component**

In the component, after the existing event detail content, add:

```typescript
// If the loader already returns event with eventServices relation, use it directly.
// Otherwise, add eventServices with provider and service to the getEvent query's `with` clause.
// Then render:
{event.eventServices && event.eventServices.length > 0 && (
  <EventServicesList services={event.eventServices} />
)}
```

Note: This requires updating the `getEvent` server function to include `eventServices` in its `with` clause:

```typescript
eventServices: {
  with: {
    provider: { columns: { id: true, name: true, image: true } },
    service: { columns: { id: true, title: true } },
  },
},
```

- [ ] **Step 3: Commit**

```bash
git add app/routes/events/\$eventId.tsx app/server/fns/events.ts
git commit -m "feat: show accepted service providers on event detail page"
```

---

### Task 26: Run dev server and verify route generation

- [ ] **Step 1: Delete stale routeTree.gen.ts and start dev**

```bash
cd /mnt/c/Users/Klaudio/Desktop/Coding/EOM-APK
rm app/routeTree.gen.ts
npm run dev
```

- [ ] **Step 2: Verify routes are generated**

Check that `app/routeTree.gen.ts` includes all new routes:
- `/services/`
- `/services/$serviceId`
- `/service-provider/`
- `/service-provider/services/new`
- `/service-provider/services/$serviceId/edit`
- `/service-provider/negotiations/`
- `/service-provider/negotiations/$negotiationId`
- `/organizer/negotiations/`
- `/organizer/negotiations/$negotiationId`
- `/admin/service-categories`
- `/admin/services`
- `/admin/negotiations`

- [ ] **Step 3: Fix any TypeScript or import errors**

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve route generation and TypeScript errors"
```

---

### Task 27: Run migration and seed on production

- [ ] **Step 1: Run migration on Neon (production)**

```bash
DATABASE_URL="<production-url>" npx drizzle-kit migrate
```

- [ ] **Step 2: Run service category seed on production**

```bash
DATABASE_URL="<production-url>" npm run seed:service-categories
```

- [ ] **Step 3: Push to GitHub and deploy**

```bash
git push origin main
```

Verify Railway deployment succeeds.
