# Reviews & Ratings Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add organizer→provider reviews after completed deals, with star ratings, public display, provider reporting, and admin moderation.

**Architecture:** New `reviews` table linked to `event_services`. Server functions in `app/server/fns/reviews.ts` handle CRUD + moderation. Reusable UI components in `app/components/reviews/` integrated into organizer dashboard, service detail page, provider dashboard, service cards, and admin panel.

**Tech Stack:** TanStack Start, Drizzle ORM, PostgreSQL, Tailwind CSS, React 19

---

## File Structure

**Create:**
- `app/server/fns/reviews.ts` — all review server functions (submit, query, report, moderate)
- `app/components/reviews/StarRating.tsx` — reusable star display/input
- `app/components/reviews/ReviewModal.tsx` — review submission modal
- `app/components/reviews/ReviewCard.tsx` — single review display
- `app/components/reviews/RatingSummary.tsx` — avg rating + distribution bars
- `app/components/reviews/ReviewsList.tsx` — paginated review list
- `app/routes/admin/reviews.tsx` — admin moderation page

**Modify:**
- `app/lib/schema.ts` — add `reviews` table + relations
- `app/server/fns/capabilities.ts` — add `admin:reviews:moderate`
- `app/routes/admin/route.tsx` — add capability to admin capList
- `app/components/layout/AdminSidebar.tsx` — add Reviews menu item
- `app/routes/organizer/index.tsx` — add pending reviews section
- `app/routes/services/$serviceId.tsx` — add reviews section
- `app/components/services/ServiceCard.tsx` — show star rating
- `app/server/fns/services.ts` — add rating subquery to browse/list
- `app/routes/service-provider/index.tsx` — add reviews KPI + list

---

## Chunk 1: Schema + Migration + Server Functions

### Task 1: Add reviews table to schema

**Files:**
- Modify: `app/lib/schema.ts`

- [ ] **Step 1: Add the reviews table definition**

Add before the `// Singular aliases` section (before line 435 in `app/lib/schema.ts`):

```typescript
// ============================================================
// Reviews
// ============================================================

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventServiceId: text('event_service_id').notNull().references(() => eventServices.id, { onDelete: 'cascade' }),
  reviewerId: text('reviewer_id').notNull().references(() => users.id),
  revieweeId: text('reviewee_id').notNull().references(() => users.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  type: text('type').notNull(),
  isVisible: boolean('is_visible').notNull().default(true),
  reportedAt: timestamp('reported_at'),
  reportReason: text('report_reason'),
  moderatedAt: timestamp('moderated_at'),
  moderationAction: text('moderation_action'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique().on(table.eventServiceId, table.reviewerId),
])
```

- [ ] **Step 2: Add reviews relations**

Add after the reviews table, before the singular aliases:

```typescript
export const reviewsRelations = relations(reviews, ({ one }) => ({
  eventService: one(eventServices, { fields: [reviews.eventServiceId], references: [eventServices.id] }),
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id], relationName: 'reviewer' }),
  reviewee: one(users, { fields: [reviews.revieweeId], references: [users.id], relationName: 'reviewee' }),
}))
```

- [ ] **Step 3: Update eventServicesRelations to include reviews**

Change the existing `eventServicesRelations` (line 428) from:

```typescript
export const eventServicesRelations = relations(eventServices, ({ one }) => ({
```

to:

```typescript
export const eventServicesRelations = relations(eventServices, ({ one, many }) => ({
```

And add inside the object:

```typescript
  reviews: many(reviews),
```

- [ ] **Step 3b: Update usersRelations to include reviews**

Find the existing `usersRelations` in `app/lib/schema.ts` and add inside the relations object:

```typescript
  reviewsAsReviewer: many(reviews, { relationName: 'reviewer' }),
  reviewsAsReviewee: many(reviews, { relationName: 'reviewee' }),
```

Also ensure `usersRelations` uses `({ one, many })` (not just `({ one })`).

- [ ] **Step 4: Generate the migration**

Run: `npx drizzle-kit generate`

Expected: Creates `drizzle/0004_*.sql` with the `reviews` table creation.

- [ ] **Step 5: Push migration to database**

Run: `npx drizzle-kit push`

Expected: `reviews` table created in the database.

- [ ] **Step 6: Commit**

```bash
git add app/lib/schema.ts drizzle/
git commit -m "feat(reviews): add reviews table schema and migration"
```

---

### Task 2: Add admin capability for review moderation

**Files:**
- Modify: `app/server/fns/capabilities.ts`
- Modify: `app/routes/admin/route.tsx`
- Modify: `app/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add capability prefix**

In `app/server/fns/capabilities.ts`, add to the `VALID_CAPABILITY_PREFIXES` array (after `'admin:analytics:view'`):

```typescript
  'admin:reviews:moderate',
```

- [ ] **Step 2: Add capability to admin route capList**

In `app/routes/admin/route.tsx`, find the `capList` array and add:

```typescript
  'admin:reviews:moderate',
```

- [ ] **Step 3: Add Reviews item to admin sidebar**

In `app/components/layout/AdminSidebar.tsx`, add to `SIDEBAR_ITEMS` array (after the Analytics entry):

```typescript
  {
    label: 'Reviews',
    href: '/admin/reviews',
    capability: 'admin:reviews:moderate',
  },
```

- [ ] **Step 4: Commit**

```bash
git add app/server/fns/capabilities.ts app/routes/admin/route.tsx app/components/layout/AdminSidebar.tsx
git commit -m "feat(reviews): add admin:reviews:moderate capability and sidebar item"
```

---

### Task 3: Create review server functions

**Files:**
- Create: `app/server/fns/reviews.ts`

- [ ] **Step 1: Create the reviews server functions file**

Create `app/server/fns/reviews.ts` with all 9 server functions:

```typescript
import { createServerFn } from '@tanstack/react-start'
import { db } from '~/lib/db'
import { reviews, eventServices, events, users } from '~/lib/schema'
import { eq, and, desc, isNotNull, isNull, sql, avg, count } from 'drizzle-orm'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

// ── Submit a review ──────────────────────────────────────────

export const submitReview = createServerFn({ method: 'POST' })
  .validator((input: { eventServiceId: string; rating: number; comment?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new Error('INVALID_RATING: Must be integer 1-5')
    }

    // Verify event_service exists and caller is the organizer
    const es = await db.query.eventServices.findFirst({
      where: eq(eventServices.id, data.eventServiceId),
      with: {
        negotiation: { columns: { organizerId: true } },
      },
    })
    if (!es) throw new Error('NOT_FOUND')
    if (es.negotiation.organizerId !== session.user.id) {
      throw new Error('FORBIDDEN: Only the organizer can review this deal')
    }

    // Check for duplicate
    const existing = await db.query.reviews.findFirst({
      where: and(
        eq(reviews.eventServiceId, data.eventServiceId),
        eq(reviews.reviewerId, session.user.id),
      ),
    })
    if (existing) throw new Error('DUPLICATE: You have already reviewed this deal')

    const [review] = await db.insert(reviews).values({
      eventServiceId: data.eventServiceId,
      reviewerId: session.user.id,
      revieweeId: es.providerId,
      rating: data.rating,
      comment: data.comment || null,
      type: 'organizer_to_provider',
    }).returning()

    return review
  })

// ── Get reviews for a specific service ───────────────────────

export const getReviewsForService = createServerFn({ method: 'GET' })
  .validator((input: { serviceId: string; limit?: number; offset?: number }) => input)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10
    const offset = data.offset ?? 0

    const results = await db.query.reviews.findMany({
      where: and(
        eq(reviews.isVisible, true),
        sql`${reviews.eventServiceId} IN (
          SELECT ${eventServices.id} FROM ${eventServices}
          WHERE ${eventServices.serviceId} = ${data.serviceId}
        )`,
      ),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .innerJoin(eventServices, eq(reviews.eventServiceId, eventServices.id))
      .where(and(
        eq(eventServices.serviceId, data.serviceId),
        eq(reviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewer,
        event: r.eventService.event,
      })),
      total: totalResult?.count ?? 0,
    }
  })

// ── Get reviews for a provider (all services) ────────────────

export const getReviewsForProvider = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string; limit?: number; offset?: number }) => input)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 10
    const offset = data.offset ?? 0

    const results = await db.query.reviews.findMany({
      where: and(
        eq(reviews.revieweeId, data.providerId),
        eq(reviews.isVisible, true),
      ),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(and(
        eq(reviews.revieweeId, data.providerId),
        eq(reviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        reviewer: r.reviewer,
        event: r.eventService.event,
      })),
      total: totalResult?.count ?? 0,
    }
  })

// ── Get provider rating summary ──────────────────────────────

export const getProviderRatingSummary = createServerFn({ method: 'GET' })
  .validator((input: { providerId: string }) => input)
  .handler(async ({ data }) => {
    const [result] = await db
      .select({
        avgRating: avg(reviews.rating),
        reviewCount: count(),
      })
      .from(reviews)
      .where(and(
        eq(reviews.revieweeId, data.providerId),
        eq(reviews.isVisible, true),
      ))

    return {
      avgRating: result?.avgRating ? Number(result.avgRating) : null,
      reviewCount: result?.reviewCount ?? 0,
    }
  })

// ── Get my reviews (provider view) ──────────────────────────

export const getMyReviews = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number; offset?: number } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const limit = data.limit ?? 20
    const offset = data.offset ?? 0

    const results = await db.query.reviews.findMany({
      where: eq(reviews.revieweeId, session.user.id),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(eq(reviews.revieweeId, session.user.id))

    const [avgResult] = await db
      .select({ avgRating: avg(reviews.rating) })
      .from(reviews)
      .where(and(
        eq(reviews.revieweeId, session.user.id),
        eq(reviews.isVisible, true),
      ))

    return {
      reviews: results.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        isVisible: r.isVisible,
        reportedAt: r.reportedAt,
        reviewer: r.reviewer,
        event: r.eventService.event,
      })),
      total: totalResult?.count ?? 0,
      avgRating: avgResult?.avgRating ? Number(avgResult.avgRating) : null,
    }
  })

// ── Report a review ─────────────────────────────────────────

export const reportReview = createServerFn({ method: 'POST' })
  .validator((input: { reviewId: string; reason: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.reviewId),
    })
    if (!review) throw new Error('NOT_FOUND')
    if (review.revieweeId !== session.user.id) {
      throw new Error('FORBIDDEN: Only the reviewed provider can report')
    }
    if (review.reportedAt) return { success: true } // already reported

    await db.update(reviews).set({
      reportedAt: new Date(),
      reportReason: data.reason,
      updatedAt: new Date(),
    }).where(eq(reviews.id, data.reviewId))

    return { success: true }
  })

// ── Get reported reviews (admin) ────────────────────────────

export const getReportedReviews = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number; offset?: number; status?: 'pending' | 'resolved' } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:reviews:moderate')

    const limit = data.limit ?? 20
    const offset = data.offset ?? 0

    const conditions = [isNotNull(reviews.reportedAt)]
    if (data.status === 'resolved') {
      conditions.push(isNotNull(reviews.moderatedAt))
    } else {
      // Default: show pending (unmoderated) reports
      conditions.push(isNull(reviews.moderatedAt))
    }

    const results = await db.query.reviews.findMany({
      where: and(...conditions),
      with: {
        reviewer: { columns: { id: true, name: true, image: true } },
        reviewee: { columns: { id: true, name: true, image: true } },
        eventService: {
          with: {
            event: { columns: { id: true, title: true } },
            service: { columns: { id: true, title: true } },
          },
        },
      },
      orderBy: [desc(reviews.reportedAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(reviews)
      .where(and(...conditions))

    return { reviews: results, total: totalResult?.count ?? 0 }
  })

// ── Moderate a review (admin) ───────────────────────────────

export const moderateReview = createServerFn({ method: 'POST' })
  .validator((input: { reviewId: string; action: 'hide' | 'unhide' | 'dismiss' }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:reviews:moderate')

    const review = await db.query.reviews.findFirst({
      where: eq(reviews.id, data.reviewId),
    })
    if (!review) throw new Error('NOT_FOUND')

    const now = new Date()

    switch (data.action) {
      case 'hide':
        await db.update(reviews).set({
          isVisible: false,
          moderatedAt: now,
          moderationAction: 'hidden',
          updatedAt: now,
        }).where(eq(reviews.id, data.reviewId))
        break
      case 'unhide':
        await db.update(reviews).set({
          isVisible: true,
          moderatedAt: now,
          moderationAction: null,
          updatedAt: now,
        }).where(eq(reviews.id, data.reviewId))
        break
      case 'dismiss':
        await db.update(reviews).set({
          moderatedAt: now,
          moderationAction: 'dismissed',
          updatedAt: now,
        }).where(eq(reviews.id, data.reviewId))
        break
    }

    return { success: true }
  })

// ── Get reviewable deals (organizer) ────────────────────────

export const getReviewableDeals = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    const results = await db.execute(sql`
      SELECT
        es.id,
        es.agreed_price AS "agreedPrice",
        es.created_at AS "createdAt",
        u.name AS "providerName",
        u.id AS "providerId",
        u.image AS "providerImage",
        s.title AS "serviceTitle",
        e.title AS "eventTitle",
        e.id AS "eventId"
      FROM event_services es
      INNER JOIN events e ON es.event_id = e.id
      INNER JOIN users u ON es.provider_id = u.id
      INNER JOIN services s ON es.service_id = s.id
      WHERE e.organizer_id = ${session.user.id}
      AND NOT EXISTS (
        SELECT 1 FROM reviews r
        WHERE r.event_service_id = es.id
        AND r.reviewer_id = ${session.user.id}
      )
      ORDER BY es.created_at DESC
    `)

    return results.rows
  },
)
```

**Note:** `getReviewableDeals` uses `db.execute(sql\`...\`)` for the complex multi-table join with NOT EXISTS subquery — raw SQL is cleaner here than Drizzle's query builder.

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit app/server/fns/reviews.ts` or just run the dev server to check.

Run: `npm run dev` (briefly, then stop)

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/server/fns/reviews.ts
git commit -m "feat(reviews): add all review server functions"
```

---

## Chunk 2: UI Components

### Task 4: Create StarRating component

**Files:**
- Create: `app/components/reviews/StarRating.tsx`

- [ ] **Step 1: Create the StarRating component**

```typescript
import { useState } from 'react'

interface StarRatingProps {
  rating: number
  interactive?: boolean
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
}

export function StarRating({ rating, interactive = false, onChange, size = 'md' }: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0)

  const displayRating = interactive && hoverRating > 0 ? hoverRating : rating

  return (
    <div className={`inline-flex gap-0.5 ${SIZES[size]}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = displayRating >= star
        const half = !filled && displayRating >= star - 0.5

        return (
          <span
            key={star}
            className={`${interactive ? 'cursor-pointer' : ''} ${
              filled ? 'text-amber-400' : half ? 'text-amber-300' : 'text-gray-300 dark:text-gray-600'
            }`}
            onClick={interactive && onChange ? () => onChange(star) : undefined}
            onMouseEnter={interactive ? () => setHoverRating(star) : undefined}
            onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
          >
            ★
          </span>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/reviews/StarRating.tsx
git commit -m "feat(reviews): add StarRating component"
```

---

### Task 5: Create ReviewCard component

**Files:**
- Create: `app/components/reviews/ReviewCard.tsx`

- [ ] **Step 1: Create the ReviewCard component**

```typescript
import { useState } from 'react'
import { StarRating } from './StarRating'
import { reportReview } from '~/server/fns/reviews'

interface ReviewCardProps {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewer: { name: string; image?: string | null }
  event: { title: string }
  isOwner?: boolean // true when the reviewee (provider) is viewing
  isVisible?: boolean
  reportedAt?: string | null
}

export function ReviewCard({ id, rating, comment, createdAt, reviewer, event, isOwner, isVisible, reportedAt }: ReviewCardProps) {
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reported, setReported] = useState(!!reportedAt)

  async function handleReport() {
    if (!reportReason.trim()) return
    await reportReview({ data: { reviewId: id, reason: reportReason } })
    setReported(true)
    setShowReportForm(false)
  }

  const isHidden = isVisible === false

  return (
    <div className={`rounded-lg border p-4 dark:border-gray-700 ${
      isHidden ? 'opacity-50' : ''
    } ${reported && !isHidden ? 'border-amber-300 dark:border-amber-700' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StarRating rating={rating} size="sm" />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {new Date(createdAt).toLocaleDateString()}
            </span>
          </div>
          {comment ? (
            <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{comment}</p>
          ) : (
            <p className="mt-2 text-sm italic text-gray-400 dark:text-gray-500">No comment</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {reviewer.name} · {event.title}
          </p>
          {isHidden && (
            <span className="mt-1 inline-block text-xs text-red-500">Hidden by admin</span>
          )}
        </div>

        {isOwner && !reported && !isHidden && (
          <button
            onClick={() => setShowReportForm(true)}
            className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-950"
          >
            Report
          </button>
        )}
        {isOwner && reported && (
          <span className="shrink-0 rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            Reported
          </span>
        )}
      </div>

      {showReportForm && (
        <div className="mt-3 space-y-2 border-t pt-3 dark:border-gray-700">
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Why are you reporting this review?"
            className="w-full rounded border p-2 text-sm dark:border-gray-600 dark:bg-gray-800"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleReport}
              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
            >
              Submit Report
            </button>
            <button
              onClick={() => setShowReportForm(false)}
              className="rounded border px-3 py-1 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Cancel
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
git add app/components/reviews/ReviewCard.tsx
git commit -m "feat(reviews): add ReviewCard component with report functionality"
```

---

### Task 6: Create RatingSummary component

**Files:**
- Create: `app/components/reviews/RatingSummary.tsx`

- [ ] **Step 1: Create the RatingSummary component**

```typescript
import { StarRating } from './StarRating'

interface RatingSummaryProps {
  avgRating: number | null
  reviewCount: number
  distribution?: Record<number, number> // { 5: 3, 4: 2, 3: 1, 2: 0, 1: 0 }
}

export function RatingSummary({ avgRating, reviewCount, distribution }: RatingSummaryProps) {
  if (reviewCount === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet</p>
    )
  }

  const displayRating = avgRating ? Math.round(avgRating * 10) / 10 : 0

  return (
    <div className="flex items-start gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold">{displayRating}</div>
        <StarRating rating={displayRating} size="sm" />
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{reviewCount} review{reviewCount !== 1 ? 's' : ''}</div>
      </div>

      {distribution && (
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] ?? 0
            const pct = reviewCount > 0 ? (count / reviewCount) * 100 : 0
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-xs text-gray-500 dark:text-gray-400">{star}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/reviews/RatingSummary.tsx
git commit -m "feat(reviews): add RatingSummary component with distribution bars"
```

---

### Task 7: Create ReviewsList component

**Files:**
- Create: `app/components/reviews/ReviewsList.tsx`

- [ ] **Step 1: Create the ReviewsList component**

```typescript
import { ReviewCard } from './ReviewCard'

interface Review {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  reviewer: { name: string; image?: string | null }
  event: { title: string }
  isVisible?: boolean
  reportedAt?: string | null
}

interface ReviewsListProps {
  reviews: Review[]
  isOwner?: boolean
  total?: number
  onLoadMore?: () => void
  hasMore?: boolean
}

export function ReviewsList({ reviews, isOwner, total, onLoadMore, hasMore }: ReviewsListProps) {
  if (reviews.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">No reviews yet</p>
  }

  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <ReviewCard
          key={r.id}
          id={r.id}
          rating={r.rating}
          comment={r.comment}
          createdAt={r.createdAt}
          reviewer={r.reviewer}
          event={r.event}
          isOwner={isOwner}
          isVisible={r.isVisible}
          reportedAt={r.reportedAt}
        />
      ))}
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="w-full rounded border py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
        >
          Load more reviews
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/reviews/ReviewsList.tsx
git commit -m "feat(reviews): add ReviewsList component"
```

---

### Task 8: Create ReviewModal component

**Files:**
- Create: `app/components/reviews/ReviewModal.tsx`

- [ ] **Step 1: Create the ReviewModal component**

```typescript
import { useState } from 'react'
import { StarRating } from './StarRating'
import { submitReview } from '~/server/fns/reviews'

interface ReviewModalProps {
  eventServiceId: string
  providerName: string
  eventTitle: string
  onClose: () => void
  onSubmitted: () => void
}

export function ReviewModal({ eventServiceId, providerName, eventTitle, onClose, onSubmitted }: ReviewModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (rating === 0) {
      setError('Please select a rating')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await submitReview({ data: { eventServiceId, rating, comment: comment.trim() || undefined } })
      onSubmitted()
    } catch (e: any) {
      setError(e.message || 'Failed to submit review')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-xl border bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold">Leave a Review</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          How was your experience with <span className="font-medium text-indigo-600 dark:text-indigo-400">{providerName}</span>?
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500">For: {eventTitle}</p>

        <div className="mt-4 text-center">
          <StarRating rating={rating} interactive onChange={setRating} size="lg" />
          {rating > 0 && (
            <p className="mt-1 text-xs text-gray-500">{rating} out of 5</p>
          )}
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium">Comment (optional)</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share your experience working with this provider..."
            className="mt-1 w-full rounded-lg border p-3 text-sm dark:border-gray-600 dark:bg-gray-700"
            rows={3}
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/reviews/ReviewModal.tsx
git commit -m "feat(reviews): add ReviewModal component"
```

---

## Chunk 3: Page Integrations

### Task 9: Add pending reviews to organizer dashboard

**Files:**
- Modify: `app/routes/organizer/index.tsx`

- [ ] **Step 1: Add imports**

At the top of `app/routes/organizer/index.tsx`, add:

```typescript
import { getReviewableDeals } from '~/server/fns/reviews'
import { ReviewModal } from '~/components/reviews/ReviewModal'
```

- [ ] **Step 2: Add state and fetch**

Inside `OrganizerDashboard()`, after the existing state declarations (after `const [statusFilter, setStatusFilter] = useState('')`), add:

```typescript
  const [reviewableDeals, setReviewableDeals] = useState<any[]>([])
  const [reviewTarget, setReviewTarget] = useState<any>(null)
```

Inside the existing `fetchEvents` function (or in a new useEffect), add after `setEvents(result)`:

```typescript
  // Also fetch in a useEffect alongside events
```

Actually, add a new useEffect after the existing one (after `useEffect(() => { fetchEvents() }, [statusFilter])`):

```typescript
  function fetchReviewableDeals() {
    getReviewableDeals().then(setReviewableDeals)
  }

  useEffect(() => { fetchReviewableDeals() }, [])
```

- [ ] **Step 3: Add pending reviews section in the JSX**

Add this section after the events table closing `)}` (after `</div>` for the table wrapper) and before `<OrganizerAnalyticsSection />`:

```tsx
      {reviewableDeals.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-bold">Pending Reviews ({reviewableDeals.length})</h2>
          <div className="space-y-2">
            {reviewableDeals.map((deal: any) => (
              <div key={deal.id} className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700">
                <div>
                  <p className="text-sm font-medium">{deal.providerName} — {deal.serviceTitle}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {deal.eventTitle} · Deal closed €{Number(deal.agreedPrice).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setReviewTarget(deal)}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                >
                  Leave Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {reviewTarget && (
        <ReviewModal
          eventServiceId={reviewTarget.id}
          providerName={reviewTarget.providerName}
          eventTitle={reviewTarget.eventTitle}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            setReviewTarget(null)
            fetchReviewableDeals()
          }}
        />
      )}
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run dev` (briefly, check no errors)

- [ ] **Step 5: Commit**

```bash
git add app/routes/organizer/index.tsx
git commit -m "feat(reviews): add pending reviews section to organizer dashboard"
```

---

### Task 10: Add reviews section to service detail page

**Files:**
- Modify: `app/routes/services/$serviceId.tsx`

- [ ] **Step 1: Add imports**

At the top of `app/routes/services/$serviceId.tsx`, add:

```typescript
import { useState, useEffect } from 'react'
import { getReviewsForService, getProviderRatingSummary } from '~/server/fns/reviews'
import { RatingSummary } from '~/components/reviews/RatingSummary'
import { ReviewsList } from '~/components/reviews/ReviewsList'
```

Note: If `useState` is already imported, just add `useEffect` to the existing React import.

- [ ] **Step 2: Add state and fetch inside the component**

Add state after existing state declarations:

```typescript
  const [reviewData, setReviewData] = useState<any>({ reviews: [], total: 0 })
  const [ratingSummary, setRatingSummary] = useState<any>({ avgRating: null, reviewCount: 0 })
  const [reviewOffset, setReviewOffset] = useState(0)
```

Add useEffect to fetch reviews:

```typescript
  useEffect(() => {
    if (service?.id) {
      getReviewsForService({ data: { serviceId: service.id, limit: 5 } }).then(setReviewData)
    }
    if (service?.provider?.id) {
      getProviderRatingSummary({ data: { providerId: service.provider.id } }).then(setRatingSummary)
    }
  }, [service?.id])
```

Add load more handler:

```typescript
  async function loadMoreReviews() {
    const nextOffset = reviewOffset + 5
    const more = await getReviewsForService({ data: { serviceId: service.id, limit: 5, offset: nextOffset } })
    setReviewData((prev: any) => ({
      reviews: [...prev.reviews, ...more.reviews],
      total: more.total,
    }))
    setReviewOffset(nextOffset)
  }
```

- [ ] **Step 3: Add reviews section in JSX**

Add after the portfolio/images section and before the offer modal:

```tsx
      {/* Reviews */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold">Reviews</h2>
        <RatingSummary
          avgRating={ratingSummary.avgRating}
          reviewCount={ratingSummary.reviewCount}
        />
        <div className="mt-4">
          <ReviewsList
            reviews={reviewData.reviews}
            total={reviewData.total}
            hasMore={reviewData.reviews.length < reviewData.total}
            onLoadMore={loadMoreReviews}
          />
        </div>
      </div>
```

- [ ] **Step 4: Commit**

```bash
git add app/routes/services/$serviceId.tsx
git commit -m "feat(reviews): add reviews section to service detail page"
```

---

### Task 11: Add star ratings to service cards

**Files:**
- Modify: `app/components/services/ServiceCard.tsx`
- Modify: `app/server/fns/services.ts`

- [ ] **Step 1: Update ServiceCard to accept and display rating**

In `app/components/services/ServiceCard.tsx`, add to the `ServiceCardProps` interface:

```typescript
  avgRating?: number | null
  reviewCount?: number
```

Add to the destructured props:

```typescript
export function ServiceCard({ id, title, bannerImage, city, country, category, packages, provider, avgRating, reviewCount }: ServiceCardProps) {
```

Add in the JSX, after the provider line (`{provider && ...}`) and before the price line:

```tsx
        {reviewCount != null && reviewCount > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm text-amber-400">★</span>
            <span className="text-xs font-medium">{avgRating ? (Math.round(avgRating * 10) / 10) : '—'}</span>
            <span className="text-xs text-gray-400">({reviewCount})</span>
          </div>
        )}
```

- [ ] **Step 2: Add rating subquery to browseServices**

In `app/server/fns/services.ts`, the `browseServices` function uses `db.query.services.findMany`. Since we added a `reviews` relation through `eventServices`, we need to compute ratings after fetching. Add a post-processing step.

After the `return results.filter(...)` line at the end of `browseServices`, change it to compute ratings:

Replace the final return:
```typescript
    return results.filter((s) => s.provider.isActive)
```

With:
```typescript
    const filtered = results.filter((s) => s.provider.isActive)

    // Attach rating summaries
    const providerIds = [...new Set(filtered.map((s) => s.providerId))]
    if (providerIds.length === 0) return filtered.map((s) => ({ ...s, avgRating: null, reviewCount: 0 }))

    const ratingsRaw = await db
      .select({
        revieweeId: reviews.revieweeId,
        avgRating: avg(reviews.rating),
        reviewCount: count(),
      })
      .from(reviews)
      .where(and(
        eq(reviews.isVisible, true),
        sql`${reviews.revieweeId} IN (${sql.join(providerIds.map(id => sql`${id}`), sql`, `)})`,
      ))
      .groupBy(reviews.revieweeId)

    const ratingsMap = new Map(ratingsRaw.map((r) => [r.revieweeId, r]))

    return filtered.map((s) => {
      const r = ratingsMap.get(s.providerId)
      return {
        ...s,
        avgRating: r?.avgRating ? Number(r.avgRating) : null,
        reviewCount: r?.reviewCount ?? 0,
      }
    })
```

Update imports at the top of `services.ts`:

1. Add `reviews` to the schema import: `import { ..., reviews } from '~/lib/schema'`
2. Add `avg` and `count` to the drizzle-orm import: `import { eq, and, asc, desc, ilike, or, sql, avg, count } from 'drizzle-orm'`

- [ ] **Step 3: Update ServiceCard usage in browse pages**

Find where `ServiceCard` is used and pass the new props. Search for `<ServiceCard` in the codebase and add `avgRating={s.avgRating}` and `reviewCount={s.reviewCount}` to each usage.

- [ ] **Step 4: Commit**

```bash
git add app/components/services/ServiceCard.tsx app/server/fns/services.ts
git commit -m "feat(reviews): show star ratings on service cards"
```

---

### Task 12: Add reviews to provider dashboard

**Files:**
- Modify: `app/routes/service-provider/index.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { getMyReviews } from '~/server/fns/reviews'
import { ReviewsList } from '~/components/reviews/ReviewsList'
import { StarRating } from '~/components/reviews/StarRating'
```

- [ ] **Step 2: Add state and fetch**

After existing state declarations:

```typescript
  const [myReviews, setMyReviews] = useState<any>({ reviews: [], total: 0, avgRating: null })
```

In the existing `useEffect`, add alongside the other fetches:

```typescript
    getMyReviews({ data: {} }).then(setMyReviews)
```

- [ ] **Step 3: Add reviews KPI card**

In the stats grid (the `grid grid-cols-3 gap-4` div), add a 4th card and change `grid-cols-3` to `grid-cols-4`:

```tsx
        <div className="rounded-lg border p-4 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold">{myReviews.avgRating ? (Math.round(myReviews.avgRating * 10) / 10) : '—'}</p>
            {myReviews.avgRating && <StarRating rating={myReviews.avgRating} size="sm" />}
          </div>
          <p className="text-sm text-gray-500">{myReviews.total} Review{myReviews.total !== 1 ? 's' : ''}</p>
        </div>
```

- [ ] **Step 4: Add recent reviews section**

Add before `<ProviderAnalyticsSection />`:

```tsx
      <div className="flex items-center justify-between mb-4 mt-8">
        <h2 className="text-lg font-bold">Recent Reviews</h2>
      </div>
      <ReviewsList
        reviews={myReviews.reviews.slice(0, 5)}
        isOwner
      />
```

- [ ] **Step 5: Commit**

```bash
git add app/routes/service-provider/index.tsx
git commit -m "feat(reviews): add reviews KPI and list to provider dashboard"
```

---

### Task 13: Create admin review moderation page

**Files:**
- Create: `app/routes/admin/reviews.tsx`

- [ ] **Step 1: Create the admin reviews page**

```typescript
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getReportedReviews, moderateReview } from '~/server/fns/reviews'
import { StarRating } from '~/components/reviews/StarRating'

export const Route = createFileRoute('/admin/reviews')({
  component: AdminReviewsPage,
})

function AdminReviewsPage() {
  const [data, setData] = useState<any>({ reviews: [], total: 0 })
  const [loading, setLoading] = useState(true)

  async function fetchReviews() {
    setLoading(true)
    const result = await getReportedReviews({ data: {} })
    setData(result)
    setLoading(false)
  }

  useEffect(() => { fetchReviews() }, [])

  async function handleModerate(reviewId: string, action: 'hide' | 'unhide' | 'dismiss') {
    await moderateReview({ data: { reviewId, action } })
    fetchReviews()
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Moderation</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {data.total} reported review{data.total !== 1 ? 's' : ''} pending moderation
      </p>

      {data.reviews.length === 0 ? (
        <div className="rounded-lg border p-8 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">No reported reviews. All clear!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((r: any) => (
            <div
              key={r.id}
              className="rounded-lg border border-red-200 bg-red-50/30 p-4 dark:border-red-900 dark:bg-red-950/20"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} size="sm" />
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300">
                      Reported
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {r.comment || <em className="text-gray-400">No comment</em>}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    By: {r.reviewer.name} → About: {r.reviewee.name}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Service: {r.eventService.service.title} · Event: {r.eventService.event.title}
                  </p>
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Report reason: "{r.reportReason}"
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => handleModerate(r.id, 'dismiss')}
                    className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleModerate(r.id, 'hide')}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                  >
                    Hide Review
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete and regenerate the route tree**

Run: `rm app/routeTree.gen.ts && npm run dev`

Wait for TanStack to regenerate `routeTree.gen.ts` with the new `/admin/reviews` route, then stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add app/routes/admin/reviews.tsx app/routeTree.gen.ts
git commit -m "feat(reviews): add admin review moderation page"
```

---

### Task 14: Build and verify

- [ ] **Step 1: Run the build**

Run: `npm run build`

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Final commit (if any fixes needed)**

If the build reveals issues, fix them and commit:

```bash
git add -A
git commit -m "fix(reviews): resolve build issues"
```
