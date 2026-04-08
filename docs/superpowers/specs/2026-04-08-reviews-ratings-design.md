# Reviews & Ratings — Design Spec

## Overview

Organizers can rate and review service providers after a completed deal (accepted negotiation). Reviews are public immediately, with provider reporting and admin moderation. Schema is designed to support future review types: attendee → event (requires ticketing system) and provider → organizer (bidirectional).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Review direction | One-way: Organizer → Provider (now); bidirectional later | Ship simple, expand later |
| Rating model | 1-5 stars + optional text comment | Minimal friction |
| Visibility | Public immediately, with reporting | Balance openness and safety |
| Eligibility | One review per deal (per `event_service` record) | Fair — each deal earns one review |
| Time limit | None | No artificial constraint |
| Review surfaces | Provider profile, service cards, provider dashboard | Reviews everywhere they're useful |
| Moderation | Provider reports → admin queue → hide/unhide | No deletion, audit trail preserved |

## Data Model

### `reviews` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `text` | PK, UUID default | |
| `eventServiceId` | `text` | FK → `event_services.id`, NOT NULL | The completed deal being reviewed |
| `reviewerId` | `text` | FK → `users.id`, NOT NULL | Who wrote the review |
| `revieweeId` | `text` | FK → `users.id`, NOT NULL | Who the review is about |
| `rating` | `integer` | NOT NULL, check 1-5 | Star rating |
| `comment` | `text` | nullable | Optional text review |
| `type` | `text` | NOT NULL | `'organizer_to_provider'` now; future: `'attendee_to_event'`, `'provider_to_organizer'` |
| `isVisible` | `boolean` | NOT NULL, default `true` | Admin can set to `false` to hide |
| `reportedAt` | `timestamp` | nullable | Set when provider reports the review |
| `reportReason` | `text` | nullable | Provider's reason for reporting |
| `moderatedAt` | `timestamp` | nullable | When admin acted on report |
| `moderationAction` | `text` | nullable | `'hidden'`, `'dismissed'` — preserves audit trail |
| `createdAt` | `timestamp` | NOT NULL, default `now()` | |
| `updatedAt` | `timestamp` | NOT NULL, default `now()` | Updated on report/moderation |

**Constraints:**
- `UNIQUE (eventServiceId, reviewerId)` — one review per deal per reviewer
- `CHECK (rating >= 1 AND rating <= 5)`

### Relations

```
reviews.eventServiceId → event_services.id (CASCADE delete)
reviews.reviewerId → users.id
reviews.revieweeId → users.id
```

Add Drizzle relations:
- `eventServices` → `reviews` (one-to-many)
- `users` → `reviews` as reviewer (one-to-many)
- `users` → `reviews` as reviewee (one-to-many)

## Server Functions

All in `app/server/fns/reviews.ts`.

### `submitReview`
- **Auth:** Logged-in user must be the `organizerId` on the `event_service`'s negotiation
- **Input:** `{ eventServiceId: string, rating: number (1-5), comment?: string }`
- **Logic:**
  1. Verify `event_service` exists; join through `event_services.negotiationId` → `negotiations.organizerId` to confirm caller is the organizer (existence of the `event_service` row already implies negotiation was accepted — no need to re-check status)
  2. Check no existing review for this `(eventServiceId, reviewerId)` pair
  3. Insert review with `type: 'organizer_to_provider'`, `revieweeId` = `event_services.providerId`
- **Returns:** The created review

### `getReviewsForService`
- **Auth:** Public (no auth required)
- **Input:** `{ serviceId: string, limit?: number, offset?: number }`
- **Logic:** Query reviews joined through `event_services.serviceId = serviceId`, where `isVisible = true`, ordered by `createdAt` desc. Join reviewer name and event title.
- **Returns:** `{ reviews: Array<{ id, rating, comment, createdAt, reviewer: { name }, event: { title } }>, total: number }`
- **Note:** Service-scoped — shows only reviews for deals involving this specific service, not all of the provider's reviews.

### `getReviewsForProvider`
- **Auth:** Public (no auth required)
- **Input:** `{ providerId: string, limit?: number, offset?: number }`
- **Logic:** Query reviews where `revieweeId = providerId`, `isVisible = true`, ordered by `createdAt` desc. Join reviewer name and event title.
- **Returns:** `{ reviews: Array<{ id, rating, comment, createdAt, reviewer: { name }, event: { title } }>, total: number }`
- **Note:** Provider-scoped — shows all reviews across all of a provider's services. Used on provider dashboard.

### `getProviderRatingSummary`
- **Auth:** Public
- **Input:** `{ providerId: string }`
- **Logic:** Aggregate `AVG(rating)` and `COUNT(*)` where `revieweeId = providerId` and `isVisible = true`. Coalesce: returns `{ avgRating: null, reviewCount: 0 }` when no reviews exist.
- **Returns:** `{ avgRating: number | null, reviewCount: number }`

### `getMyReviews`
- **Auth:** Logged-in provider
- **Input:** `{ limit?: number, offset?: number }`
- **Logic:** Query reviews where `revieweeId = currentUser.id`, ordered by `createdAt` desc. Include all reviews (visible and hidden) so provider can see status.
- **Returns:** `{ reviews: Array<{ id, rating, comment, createdAt, isVisible, reportedAt, reviewer: { name }, event: { title } }>, total: number, avgRating: number }`

### `reportReview`
- **Auth:** Logged-in user must be the `revieweeId` on the review
- **Input:** `{ reviewId: string, reason: string }`
- **Logic:** Set `reportedAt = now()` and `reportReason = reason`. No-op if already reported.
- **Returns:** `{ success: true }`

### `getReportedReviews`
- **Auth:** Admin with `admin:reviews:moderate` capability
- **Input:** `{ limit?: number, offset?: number }`
- **Logic:** Query reviews where `reportedAt IS NOT NULL`, ordered by `reportedAt` desc. Join reviewer, reviewee, event.
- **Returns:** Array of reported reviews with full context

### `moderateReview`
- **Auth:** Admin with `admin:reviews:moderate` capability
- **Input:** `{ reviewId: string, action: 'hide' | 'unhide' | 'dismiss' }`
- **Logic:**
  - `hide`: Set `isVisible = false`, `moderatedAt = now()`, `moderationAction = 'hidden'`
  - `unhide`: Set `isVisible = true`, `moderatedAt = now()`, `moderationAction` cleared
  - `dismiss`: Set `moderatedAt = now()`, `moderationAction = 'dismissed'` (preserves `reportedAt` and `reportReason` for audit trail, keeps review visible)
- **Returns:** `{ success: true }`

### `getReviewableDeals`
- **Auth:** Logged-in organizer
- **Input:** none
- **Logic:** Query `event_services` joined through `event_services.eventId` → `events` where `events.organizerId = session.user.id`. LEFT JOIN `reviews` on `(event_services.id, session.user.id)` — return only deals with no review yet. Join service title, provider name, event title, agreed price.
- **Returns:** Array of unreviewed deals

## UI Components

### `StarRating` component (`app/components/reviews/StarRating.tsx`)
- Reusable star display/input component
- Props: `rating: number`, `interactive?: boolean`, `onChange?: (rating: number) => void`, `size?: 'sm' | 'md' | 'lg'`
- Interactive mode: hover preview, click to select
- Display mode: filled/half/empty stars based on rating (rounds to nearest 0.5 for averages)

### `ReviewModal` component (`app/components/reviews/ReviewModal.tsx`)
- Modal with provider name, event name, star selector, optional comment textarea
- Submit button calls `submitReview`
- Shows success state briefly then closes

### `ReviewCard` component (`app/components/reviews/ReviewCard.tsx`)
- Single review display: stars, comment, reviewer name, event name, date
- Optional "Report" button (shown to reviewee only)

### `RatingSummary` component (`app/components/reviews/RatingSummary.tsx`)
- Average rating number, star display, review count
- Optional: rating distribution bars (5→1)

### `ReviewsList` component (`app/components/reviews/ReviewsList.tsx`)
- Paginated list of `ReviewCard`s
- Used on provider profile and provider dashboard

## Page Integration

### Organizer Dashboard (`app/routes/organizer/index.tsx`)
- New "Pending Reviews" section above analytics
- Calls `getReviewableDeals` to show unreviewed completed deals
- Each deal row has "Leave Review" button that opens `ReviewModal`

### Service Detail Page (`app/routes/services/$serviceId.tsx`)
- Add reviews section below existing content
- `RatingSummary` with distribution bars at top
- `ReviewsList` showing paginated reviews **scoped to this service** (not all provider reviews)
- Calls `getReviewsForService` with `serviceId` and `getProviderRatingSummary` with `service.provider.id`

### Service Cards (search/browse results)
- Show compact star rating + review count below service title
- Rating data included as a subquery in existing service listing server functions (e.g., `listServices`, `listMyServices`) to avoid N+1 queries — each service row includes `avgRating` and `reviewCount` fields

### Provider Dashboard (`app/routes/service-provider/index.tsx`)
- Add "My Reviews" KPI card (avg rating + count) to stats row
- New "Recent Reviews" section with `ReviewsList`
- Report button on each review

### Admin — Review Moderation (`app/routes/admin/reviews.tsx`)
- New admin page linked from sidebar
- Lists reported reviews with full context
- Actions: Dismiss (preserve report, mark as reviewed), Hide (set invisible), Unhide
- Requires `admin:reviews:moderate` capability

## Capabilities

Add to permission system:
- `admin:reviews:moderate` — view and act on reported reviews

## Future Extensions (not built now)

- **Attendee → Event reviews** — requires ticketing system (Phase 5). Same `reviews` table, `type = 'attendee_to_event'`, `eventServiceId` replaced with a ticket/attendance reference (will need a nullable `ticketId` column or polymorphic reference).
- **Provider → Organizer reviews** — `type = 'provider_to_organizer'`, same table, same `eventServiceId` trigger.
- **Review responses** — providers reply to reviews publicly.
- **Review analytics** — sentiment trends, rating over time in analytics dashboard.
