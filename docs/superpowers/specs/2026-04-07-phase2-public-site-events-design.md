# EOM Phase 2 — Public Site + Events
**Date:** 2026-04-07
**Status:** Approved
**Scope:** Event CRUD for organizers, public event browsing with filters, admin event moderation/categories, homepage dynamic sections, R2 image uploads, rich text descriptions

---

## Overview

Build the event system on top of the Phase 1 foundation. Organizers create and manage events, visitors browse and filter them, admins moderate and feature events. Integrates with the existing publishing permissions, suspension enforcement, and capability systems.

This is Phase 2 of 8 in the EOM MVP-first build plan:
1. Foundation + Auth + Admin (done)
2. **Public Site + Events** ← this spec
3. Negotiation Engine
4. Business Profiles + Applications
5. Ticketing + Coupons + Payments
6. Reservations + PPV
7. Referrals + Ads + Polish
8. Production Hardening

**Deferred to later phases:** recurring events, multi-tier ticketing, invite-only visibility, map embeds, newsletter wiring, organizer analytics, calendar view. See `docs/EOM-Deferred-Features.docx` for full details.

---

## 1. Database Schema

### 1.1 `categories` table

Admin-managed event categories.

```typescript
export const categories = pgTable('categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### 1.2 `events` table

Core event table. One event belongs to one organizer and one category.

```typescript
export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizerId: text('organizer_id').notNull().references(() => users.id),
  categoryId: text('category_id').references(() => categories.id),
  title: text('title').notNull(),
  description: text('description').notNull(), // Rich text HTML from Tiptap
  type: text('type').notNull().default('single_day'), // 'single_day' | 'multi_day'
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'), // null for single-day events
  startTime: text('start_time'), // HH:MM format
  endTime: text('end_time'),
  venueName: text('venue_name'),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  onlineUrl: text('online_url'), // for hybrid/virtual events
  bannerImage: text('banner_image'), // R2 URL
  price: numeric('price', { precision: 10, scale: 2 }), // null = free
  capacity: integer('capacity'),
  status: text('status').notNull().default('draft'), // 'draft' | 'published' | 'cancelled' | 'archived'
  visibility: text('visibility').notNull().default('public'), // 'public' | 'unlisted'
  isFeatured: boolean('is_featured').notNull().default(false),
  ageRestriction: text('age_restriction'), // e.g. "18+"
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

### 1.3 `event_images` table

Gallery images for events. Banner image is stored directly on the event; this table is for additional gallery images.

```typescript
export const eventImages = pgTable('event_images', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(), // R2 URL
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### 1.4 `tags` and `event_tags` tables

Flexible tagging system. Tags are created on-the-fly by organizers.

```typescript
export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
})

export const eventTags = pgTable('event_tags', {
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.eventId, table.tagId] }),
}))
```

### 1.5 Relations

```typescript
export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  category: one(categories, { fields: [events.categoryId], references: [categories.id] }),
  images: many(eventImages),
  tags: many(eventTags),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  events: many(events),
}))

export const eventImagesRelations = relations(eventImages, ({ one }) => ({
  event: one(events, { fields: [eventImages.eventId], references: [events.id] }),
}))

export const eventTagsRelations = relations(eventTags, ({ one }) => ({
  event: one(events, { fields: [eventTags.eventId], references: [events.id] }),
  tag: one(tags, { fields: [eventTags.tagId], references: [tags.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  events: many(eventTags),
}))
```

---

## 2. Server Functions

### 2.1 Events (`app/server/fns/events.ts`)

**`listPublicEvents`** — Public. Returns published, public events from active organizers.
- Filters: categoryId, date range (startAfter/startBefore), price (free/paid), search text (title match), tags
- Pagination: offset + limit (default 12)
- Sort: by startDate ascending (upcoming first)
- Joins: category name, organizer name, tag names
- Content filtering: `WHERE organizer.isActive = true AND event.status = 'published' AND event.visibility = 'public'`

**`getFeaturedEvents`** — Public. Returns published, public, featured events from active organizers. Limit 6. Used on homepage.

**`getLatestEvents`** — Public. Returns 6 most recently published public events from active organizers, excluding featured. Used on homepage.

**`getEvent`** — Public. Single event by ID with organizer info, category, tags, gallery images. Returns 404 if organizer is inactive or event is not published (unless requester is the organizer or admin).

**`listOrganizerEvents`** — Authenticated, organizer only. Returns all events owned by the current organizer. Filter by status. Used on organizer dashboard.

**`createEvent`** — Authenticated, organizer only.
- Checks: `isSuspended === false` (throws `ACCOUNT_SUSPENDED`)
- Validates all required fields
- Creates event with status `draft`
- Handles tags: find existing by slug or create new ones, insert into `event_tags`
- Handles gallery images: insert into `event_images`
- Logs: `event_created` to `user_logs`

**`updateEvent`** — Authenticated, organizer only.
- Checks: ownership (event.organizerId === session.user.id)
- Checks: `isSuspended === false`
- Updates event fields, syncs tags and gallery images
- Logs: `event_updated` to `user_logs`

**`publishEvent`** — Authenticated, organizer only.
- Checks: ownership
- Checks: `isSuspended === false`
- Checks: organizer role has publishing permission for `/events` page (query `publishingPermissions` table)
- Changes status: `draft` → `published`
- Logs: `event_published` to `user_logs`

**`cancelEvent`** — Authenticated, organizer (own event) or admin.
- Changes status: `published` → `cancelled`
- Logs: `event_cancelled` to `user_logs`

**`archiveEvent`** — Authenticated, organizer (own event) or admin.
- Changes status: `published` or `cancelled` → `archived`
- Logs: `event_archived` to `user_logs`

**`deleteEvent`** — Authenticated, organizer only.
- Checks: ownership, status must be `draft`
- Hard deletes event + cascade deletes images and tags
- Deletes images from R2
- Logs: `event_deleted` to `user_logs`

**`toggleFeatured`** — Admin only, requires `admin:events:manage` capability.
- Toggles `isFeatured` boolean
- Logs: `event_featured` or `event_unfeatured` to `user_logs`

### 2.2 Categories (`app/server/fns/categories.ts`)

**`listCategories`** — Public. Returns active categories sorted by `sortOrder`. Used in filter sidebar and event creation form.

**`listAllCategories`** — Admin only. Returns all categories (including inactive) for admin management.

**`createCategory`** — Admin only, requires `admin:categories:manage`.
- Auto-generates slug from name
- Logs: `category_created`

**`updateCategory`** — Admin only, requires `admin:categories:manage`.
- Logs: `category_updated`

**`deleteCategory`** — Admin only, requires `admin:categories:manage`.
- Rejects if events reference this category (return count of affected events)
- Logs: `category_deleted`

### 2.3 Image Uploads (`app/server/fns/uploads.ts`)

**`getUploadUrl`** — Authenticated.
- Generates a presigned PUT URL for Cloudflare R2
- Accepts: filename, contentType, purpose (`banner` | `gallery`), eventId (optional — null for new events)
- Returns: uploadUrl (presigned), publicUrl (where the file will be accessible)
- Key format: `uploads/{userId}/{purpose}/{timestamp}-{filename}` (uses userId, not eventId, so uploads work before event is saved)

**`deleteImage`** — Authenticated, organizer only.
- Checks: ownership of the event the image belongs to
- Deletes from R2 via S3-compatible API
- Removes from `event_images` table

### 2.4 Tags (`app/server/fns/tags.ts`)

**`listTags`** — Public. Returns all tags for autocomplete. Optional search filter.

**`findOrCreateTag`** — Internal helper (not a server function). Used during event create/update.
- Looks up by slug, creates if not found
- Auto-generates slug from name

---

## 3. Routes & Pages

### 3.1 Public Routes

**`/` (homepage)** — Update existing landing page:
- Add "Featured Events" section: calls `getFeaturedEvents`, renders 3-card row. Hidden if none.
- Add "Latest Events" section: calls `getLatestEvents`, renders 6-card grid. "View All Events →" link.
- Keep: hero section, newsletter placeholder, header/footer

**`/events` (listing)** — Replace placeholder with real event browsing:
- Layout: sidebar filters + card grid (2-3 columns)
- Sidebar filters:
  - Search text input
  - Category checkboxes (from `listCategories`)
  - Date range (start/end date pickers)
  - Price: Any / Free / Paid
  - Tags: multi-select autocomplete
- Card grid: event cards with banner image, date, title, location, price, category badge
- Pagination: "Load more" button or page numbers
- URL query params for filters (shareable/bookmarkable URLs)

**`/events/:eventId` (detail)** — Replace placeholder with real event data:
- Layout: full-width banner + sidebar info card
- Banner: event banner image with title overlay, status badge, category badge
- Left column: rich text description (rendered HTML), gallery (lightbox), tags
- Right sidebar (sticky): date/time, location, category, capacity, age restriction, price, "Buy Tickets" button (placeholder for Phase 5), "Share Event" button, organizer info
- If event not found or organizer inactive: 404 page

### 3.2 Organizer Routes

**`/organizer` (dashboard)** — Replace placeholder:
- Header: "My Events" title, welcome message, "Create Event" button
- Stats row: total events, published count, drafts count, total capacity
- Filter tabs: All / Published / Drafts / Cancelled / Archived
- Data table: event title, date, status badge, capacity (used/total), actions (Edit, View, Publish/Cancel/Archive, Delete)
- Empty state: "No events yet. Create your first event!"

**`/organizer/events/new` (create)** — Multi-step form:
- Step 1 — Details: title, category, type, dates, description (Tiptap), location, price, capacity, age restriction, contact, visibility, tags
- Step 2 — Media: banner image upload (required), gallery images (optional, reorderable, captions)
- Step 3 — Review: preview of public event page, "Save as Draft" and "Publish" buttons
- Client-side state management between steps (no server round-trips)

**`/organizer/events/:eventId/edit` (edit)** — Same form as create, pre-filled with existing event data.
- Status determines available actions: draft can publish/delete, published can cancel/archive

### 3.3 Admin Routes

**`/admin/categories`** — Category management:
- Data table: name, slug, event count, sort order, active toggle, actions
- Create/edit: modal or inline form with name, description, sort order, active toggle
- Delete: only if no events reference the category, otherwise show warning with count

**`/admin/events`** — Event moderation:
- Data table: title, organizer name, category, date, status, featured toggle, actions
- Filters: status dropdown, category dropdown, search
- Actions: view (link to public page), toggle featured, cancel (moderation), archive
- No edit capability — admins moderate but don't modify organizer content

### 3.4 Admin Sidebar Updates

Add to `AdminSidebar.tsx`:
- "Categories" menu item — requires `admin:categories:manage` capability
- "Events" menu item — requires `admin:events:manage` capability

---

## 4. Capabilities

### 4.1 New Capabilities

Add to the capabilities registry in `app/lib/permissions.ts`:

- `admin:categories:manage` — CRUD on event categories
- `admin:events:manage` — view all events, toggle featured, cancel events

Also add both entries to the `VALID_CAPABILITY_PREFIXES` array in `app/server/fns/capabilities.ts` so that `grantCapability` accepts them.

### 4.2 Publishing Permission Integration

When an organizer publishes an event, the server checks:
1. `publishingPermissions` table: does the organizer's role have `canPublish = true` for the `/events` navigation link?
2. If not, return error: `PUBLISHING_NOT_ALLOWED`

This uses the existing Phase 1 publishing permissions matrix. Admins can grant/revoke publishing rights per role via `/admin/permissions`.

### 4.3 Suspension Enforcement

When a suspended organizer (`isSuspended = true`) tries to:
- **Create event** → reject with `ACCOUNT_SUSPENDED`
- **Update event** → reject with `ACCOUNT_SUSPENDED`
- **Publish event** → reject with `ACCOUNT_SUSPENDED`

Suspended organizers can still:
- View their dashboard and existing events
- Log in and browse the site

---

## 5. Image Upload Flow

### 5.1 R2 Configuration

Required environment variables:
- `R2_ACCOUNT_ID` — Cloudflare account ID
- `R2_ACCESS_KEY_ID` — R2 API token access key
- `R2_SECRET_ACCESS_KEY` — R2 API token secret key
- `R2_BUCKET_NAME` — R2 bucket name
- `R2_PUBLIC_URL` — Public URL prefix for the bucket (already in CSP config)

### 5.2 Upload Flow

1. Organizer selects a file in the browser
2. Client calls `getUploadUrl({ filename, contentType, purpose })` server function
3. Server generates presigned PUT URL via S3-compatible R2 API
4. Client uploads file directly to R2 using the presigned URL (no server proxy)
5. Client stores the returned `publicUrl` in form state
6. On event save, `publicUrl` is stored in `events.bannerImage` or `event_images.imageUrl`

### 5.3 Image Deletion

When an organizer removes an image:
1. Client calls `deleteImage({ imageId })` or updates banner to new image
2. Server deletes the object from R2 via S3 API
3. Server removes the `event_images` row (or clears `events.bannerImage`)

---

## 6. Rich Text Editor

### 6.1 Tiptap Setup

Use `@tiptap/react` with these extensions:
- `StarterKit` (bold, italic, strike, headings, lists, blockquote, code, horizontal rule)
- `Link` — clickable links
- `Image` — inline images (upload to R2, insert URL)
- `Placeholder` — "Describe your event..." placeholder text
- `TextAlign` — left, center, right alignment
- `Underline`

### 6.2 Storage

Event descriptions are stored as HTML strings in the `events.description` column. Rendered on the detail page using `dangerouslySetInnerHTML` with DOMPurify sanitization.

### 6.3 Sanitization

All HTML from the editor is sanitized on the server before saving using DOMPurify (via `isomorphic-dompurify`). Configure DOMPurify to explicitly strip `<script>`, `<iframe>`, `<form>`, and `on*` event handler attributes — do not rely on defaults for user-generated content.

---

## 7. Content Filtering

### 7.1 Inactive Organizer Filtering

All public-facing event queries include a join check to filter out events from inactive organizers:

```typescript
const activeOrganizerSubquery = db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.isActive, true))

// Used in WHERE clause:
inArray(events.organizerId, activeOrganizerSubquery)
```

This follows the pattern documented in the Phase 1 spec (section 3.4).

### 7.2 Status Filtering

- Public listing: only `status = 'published'`
- Organizer dashboard: all statuses for own events
- Admin panel: all statuses across all organizers

---

## 8. UI Components

### 8.1 New Components

**`EventCard.tsx`** — Reusable card for event grid display:
- Banner image, date, title, location, price, category badge
- Used on: homepage, events listing

**`EventFilters.tsx`** — Sidebar filter panel:
- Search input, category checkboxes, date range, price toggle, tag multi-select
- Manages filter state, syncs with URL query params

**`EventForm.tsx`** — Multi-step event creation/edit form:
- Step navigation (1-2-3 indicator)
- Form validation per step
- Client-side state persistence across steps

**`RichTextEditor.tsx`** — Tiptap editor wrapper:
- Toolbar with formatting buttons
- Image upload integration (R2)
- Dark mode compatible

**`ImageUploader.tsx`** — File upload component:
- Drag & drop zone
- File picker fallback
- Upload progress indicator
- Preview with remove button

**`GalleryUploader.tsx`** — Multiple image upload with reordering:
- Uses `ImageUploader` for each slot
- Drag to reorder
- Caption input per image

**`StatusBadge.tsx`** — Already exists from Phase 1, extend with event statuses (draft, published, cancelled, archived).

### 8.2 Modified Components

**`Header.tsx`** — No changes needed (dynamic nav already works).

**`AdminSidebar.tsx`** — Add "Categories" and "Events" menu items.

**`app/routes/index.tsx`** — Add featured + latest events sections.

---

## 9. Migration & Seeding

### 9.1 Migration

Generate and run migration for new tables:
```bash
npm run db:generate
npm run db:migrate
```

### 9.2 Category Seeding

Create `scripts/seed-categories.ts` to populate default categories:
- Music
- Sports
- Conference
- Workshop
- Festival
- Food & Drink
- Art & Culture
- Technology
- Business
- Community
- Other

### 9.3 Capability Seeding

Add `admin:categories:manage` and `admin:events:manage` to the capabilities seed or manually grant to superadmin/admin roles.

---

## 10. Dependencies

### 10.1 New npm packages

- `@tiptap/react` — React bindings for Tiptap editor
- `@tiptap/starter-kit` — Core editor extensions
- `@tiptap/extension-link` — Link support
- `@tiptap/extension-image` — Image embedding
- `@tiptap/extension-placeholder` — Placeholder text
- `@tiptap/extension-text-align` — Text alignment
- `@tiptap/extension-underline` — Underline formatting
- `isomorphic-dompurify` — HTML sanitization (SSR-compatible)
- `@aws-sdk/client-s3` — S3-compatible client for R2 uploads
- `@aws-sdk/s3-request-presigner` — Presigned URL generation

### 10.2 Existing packages (no changes)

- `drizzle-orm`, `postgres` — database
- `better-auth` — authentication
- `@tanstack/react-router`, `@tanstack/react-start` — framework
- `tailwindcss` — styling

---

## 11. Testing Checklist

### 11.1 Event CRUD
- [ ] Organizer can create a draft event with all fields
- [ ] Organizer can edit their own draft/published event
- [ ] Organizer can publish a draft (with publishing permission)
- [ ] Organizer cannot publish without publishing permission
- [ ] Organizer can cancel a published event
- [ ] Organizer can archive a published/cancelled event
- [ ] Organizer can delete a draft event
- [ ] Organizer cannot delete a published event
- [ ] Suspended organizer cannot create/update/publish events
- [ ] Admin can cancel any event
- [ ] Admin can toggle featured on any event

### 11.2 Public Browsing
- [ ] Events listing shows only published, public events from active organizers
- [ ] Filters work: category, date range, price, search, tags
- [ ] Pagination works
- [ ] Event detail page shows full event info
- [ ] Events from inactive organizers are hidden
- [ ] Unlisted events don't appear in listing but are accessible via direct URL

### 11.3 Categories
- [ ] Admin can create/edit/delete categories
- [ ] Cannot delete category with existing events
- [ ] Categories appear in filter sidebar and event creation form

### 11.4 Images
- [ ] Banner image uploads to R2 and displays on event
- [ ] Gallery images upload, reorder, and display
- [ ] Image deletion removes from R2 and database
- [ ] Upload fails gracefully with user-friendly error

### 11.5 Homepage
- [ ] Featured events section shows featured events
- [ ] Featured section hidden when no featured events exist
- [ ] Latest events section shows recent non-featured events
- [ ] "View All Events" links to /events
