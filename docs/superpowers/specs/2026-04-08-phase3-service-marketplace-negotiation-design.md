# Phase 3: Service Marketplace + Negotiation Engine — Design Spec

**Date:** 2026-04-08
**Status:** Approved
**Depends on:** Phase 1 (auth, roles, capabilities), Phase 2 (events, categories, R2 uploads)

---

## 1. Overview

Phase 3 adds a service marketplace where service providers list their services and packages, organizers discover and hire them for events, and both parties negotiate price and terms through a structured offer/counteroffer system.

### Key Decisions

| Decision | Choice |
|----------|--------|
| Core flow | Service Marketplace + Direct Offers |
| Listings | Service profile + packages, price visibility toggle |
| Negotiation | Price + terms (message), unlimited rounds |
| On accept | Provider linked to event page |
| Negotiator role | Deferred (not Phase 3) |
| Active negotiations | Unlimited per event |
| Discovery | Category-based + keyword search |

---

## 2. Service Listings

### Service Profiles

Service providers create **service profiles** — one per service type they offer (e.g., "DJ Services", "Event Catering").

Each service has:
- Title, description (rich text via Tiptap), banner image
- Category (from predefined `service_categories`)
- Location (city, country)
- Portfolio gallery (reuses R2 + `ImageUploader`/`GalleryUploader`)
- Active/inactive toggle

### Packages

Each service contains one or more **packages** (e.g., "Basic 2hrs €200", "Premium 5hrs €500").

Each package has:
- Name, description
- Price (nullable — null = "Request a quote")
- `priceIsPublic` boolean — controls whether price is shown or hidden

### Price Visibility

- **Public price** (`priceIsPublic: true`) → Price displayed on the service page. Organizer can send a direct offer.
- **Hidden price** (`priceIsPublic: false` or `price: null`) → Shows "Request a Quote" button. Organizer sends a quote request, provider responds with an offer.

---

## 3. Service Discovery

Organizers find service providers via:
- **Category browse** — predefined service categories (DJ, Catering, Photography, Security, Lighting, Venue, Transportation, Decoration, etc.)
- **Keyword search** — free-text search across service title, description, and package names/descriptions
- **Location filter** — filter by city/country
- **Paginated results** with `ServiceCard` components

Content filtering: queries exclude services from suspended/inactive users (`isActive = true` on both service and user).

---

## 4. Negotiation Flow

### Entry Points

1. **Quote Request** (hidden price) — Organizer requests a quote for a specific service/package tied to their event. Creates negotiation in `requested` status. Provider responds with an offer.
2. **Direct Offer** (public price) — Organizer sends an offer with proposed price + message, tied to their event. Creates negotiation in `offered` status.
3. **Provider-Initiated Offer** — Provider sends an unsolicited offer to an organizer for a specific event. Creates negotiation in `offered` status.

### State Machine

```
                    ┌─────────────────────────────────────────┐
                    │         NEGOTIATION LOOP                │
requested ────────► │  offered  ◄────►  countered             │
(quote request)     │                                         │
                    └────────┬──────────────┬─────────────────┘
                             │              │
                        ┌────▼────┐    ┌────▼────┐
                        │ accepted│    │ rejected│
                        └─────────┘    └─────────┘

             also: cancelled (either party), expired (timeout)
```

**States:**
- `requested` — Organizer asked for a quote (hidden-price only)
- `offered` — An offer with price + terms is on the table
- `countered` — A counteroffer was made (loops back to offered on next response)
- `accepted` — Deal agreed → provider linked to event (terminal)
- `rejected` — One side declined (terminal)
- `cancelled` — Either party withdrew (terminal)
- `expired` — No response within expiry window (terminal)

### Negotiation Rounds

Each round in the negotiation thread contains:
- **senderId** — who sent this round
- **price** — the proposed amount
- **message** — terms, conditions, notes (free text)
- **roundNumber** — sequential counter

The receiving party can **accept**, **reject**, or **counter** (with new price + message). Unlimited rounds.

### On Accept

When a negotiation is accepted:
- A record is created in `event_services` linking the provider to the event
- The agreed price and terms are stored
- The service provider appears on the event detail page

---

## 5. Permissions & Enforcement

- Only `service_provider` role can create/manage service listings
- Only `organizer` role can create events and initiate quote requests / direct offers
- Provider-initiated offers require `service_provider` role
- **Suspension enforcement**: suspended users (`isSuspended = true`) cannot create services, initiate negotiations, or respond to rounds
- **Content filtering**: all public queries filter by `user.isActive = true`
- **Ownership**: users can only modify their own services and respond to their own negotiations
- Unlimited active negotiations per event (no cap)

### New Capabilities

- `admin:service-categories:manage` — CRUD service categories
- `admin:services:manage` — moderate/remove service listings
- `admin:negotiations:manage` — view/moderate negotiations

---

## 6. Data Model

### New Tables

#### `service_categories`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| name | text | NOT NULL, unique |
| slug | text | NOT NULL, unique |
| description | text | nullable |
| isActive | boolean | default true |
| sortOrder | integer | default 0 |
| createdAt | timestamp | NOT NULL |
| updatedAt | timestamp | NOT NULL |

#### `services`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| providerId | text | FK → users, NOT NULL |
| categoryId | text | FK → service_categories, NOT NULL |
| title | text | NOT NULL |
| description | text | rich text (HTML, sanitized) |
| city | text | nullable |
| country | text | nullable |
| bannerImage | text | R2 URL, nullable |
| isActive | boolean | default true |
| createdAt | timestamp | NOT NULL |
| updatedAt | timestamp | NOT NULL |

#### `service_packages`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| serviceId | text | FK → services, NOT NULL, onDelete cascade |
| name | text | NOT NULL |
| description | text | nullable |
| price | numeric(10,2) | nullable (null = "request a quote") |
| priceIsPublic | boolean | default true |
| createdAt | timestamp | NOT NULL |
| updatedAt | timestamp | NOT NULL |

#### `service_images`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| serviceId | text | FK → services, NOT NULL, onDelete cascade |
| imageUrl | text | NOT NULL |
| caption | text | nullable |
| sortOrder | integer | default 0 |

#### `negotiations`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| eventId | text | FK → events, NOT NULL |
| serviceId | text | FK → services, NOT NULL |
| packageId | text | FK → service_packages, nullable |
| organizerId | text | FK → users, NOT NULL |
| providerId | text | FK → users, NOT NULL |
| status | text | requested/offered/countered/accepted/rejected/cancelled/expired |
| initiatedBy | text | 'organizer' or 'provider' |
| createdAt | timestamp | NOT NULL |
| updatedAt | timestamp | NOT NULL |

#### `negotiation_rounds`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| negotiationId | text | FK → negotiations, NOT NULL, onDelete cascade |
| senderId | text | FK → users, NOT NULL |
| price | numeric(10,2) | NOT NULL |
| message | text | nullable |
| roundNumber | integer | NOT NULL |
| createdAt | timestamp | NOT NULL |

#### `event_services`
| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| eventId | text | FK → events, NOT NULL |
| serviceId | text | FK → services, NOT NULL |
| negotiationId | text | FK → negotiations, NOT NULL |
| providerId | text | FK → users, NOT NULL |
| agreedPrice | numeric(10,2) | NOT NULL |
| agreedTerms | text | nullable |
| createdAt | timestamp | NOT NULL |

### Relations

- `users` → many `services`, many `negotiations` (as organizer), many `negotiations` (as provider)
- `service_categories` → many `services`
- `services` → many `service_packages`, many `service_images`, many `negotiations`
- `events` → many `negotiations`, many `event_services`
- `negotiations` → many `negotiation_rounds`, one `event_services`

---

## 7. Server Functions

### Service Management (service_provider role)

| Function | Method | Auth | Description |
|----------|--------|------|-------------|
| `createService` | POST | service_provider | Create listing with category, description, images |
| `updateService` | POST | service_provider (owner) | Edit listing details |
| `deleteService` | POST | service_provider (owner) | Remove listing (reject if active negotiations) |
| `listMyServices` | GET | service_provider | Provider's own listings |
| `createPackage` | POST | service_provider (owner) | Add package to service |
| `updatePackage` | POST | service_provider (owner) | Edit package |
| `deletePackage` | POST | service_provider (owner) | Remove package |

### Service Discovery (public)

| Function | Method | Auth | Description |
|----------|--------|------|-------------|
| `listServiceCategories` | GET | none | All active service categories |
| `browseServices` | GET | none | Paginated, filtered by category + keyword + location |
| `getService` | GET | none | Full detail with packages, images, provider info |

### Negotiations (organizer + provider)

| Function | Method | Auth | Description |
|----------|--------|------|-------------|
| `requestQuote` | POST | organizer | Request quote for hidden-price service, tied to event |
| `sendOffer` | POST | organizer | Direct offer with price + message, tied to event |
| `sendProviderOffer` | POST | service_provider | Provider initiates offer for a specific event |
| `respondToNegotiation` | POST | organizer/provider | Accept, reject, or counter (new price + message) |
| `cancelNegotiation` | POST | organizer/provider | Withdraw from negotiation |
| `listMyNegotiations` | GET | organizer/provider | All negotiations, filterable by status |
| `getNegotiation` | GET | organizer/provider | Full thread with all rounds |

### Admin

| Function | Method | Auth | Description |
|----------|--------|------|-------------|
| `listAllNegotiations` | GET | admin:negotiations:manage | Admin moderation view |
| `listAllServices` | GET | admin:services:manage | Admin service moderation |
| `createServiceCategory` | POST | admin:service-categories:manage | Create category |
| `updateServiceCategory` | POST | admin:service-categories:manage | Update category |
| `deleteServiceCategory` | POST | admin:service-categories:manage | Delete (reject if services reference it) |

---

## 8. Routes

### Public
- `/services` — Marketplace browse (category filters, keyword search, location)
- `/services/$serviceId` — Service detail (description, packages, gallery, provider info)

### Service Provider
- `/service-provider/` — Dashboard (my services, active negotiations, stats)
- `/service-provider/services/new` — Create service listing
- `/service-provider/services/$serviceId/edit` — Edit service listing
- `/service-provider/negotiations` — Negotiations list (filterable by status)
- `/service-provider/negotiations/$negotiationId` — Negotiation thread view

### Organizer (additions)
- `/organizer/negotiations` — Negotiations list
- `/organizer/negotiations/$negotiationId` — Negotiation thread view
- Event detail page: "Services" section showing linked providers

### Admin (additions)
- `/admin/service-categories` — Manage service categories
- `/admin/services` — Service moderation
- `/admin/negotiations` — Negotiation oversight

---

## 9. UI Components

### Service Components
- `ServiceCard` — Browse card (banner, title, category badge, location, starting price or "Get a Quote")
- `ServiceFilters` — Sidebar: category select, keyword search, location input
- `ServiceForm` — Multi-step form: Details → Packages → Gallery (reuses ImageUploader, GalleryUploader, RichTextEditor)
- `PackageCard` — Package display with price or "Request a Quote" button

### Negotiation Components
- `NegotiationThread` — Chat-like view of all rounds (price, message, timestamp, sender)
- `NegotiationActions` — Accept / Reject / Counter buttons with counter form
- `NegotiationStatusBadge` — Color-coded status (requested=amber, offered=blue, countered=indigo, accepted=green, rejected=red, cancelled/expired=gray)
- `NegotiationCard` — List item (event name, other party, status, last price, last activity)

### Event Additions
- `EventServicesList` — Accepted service providers on event detail page

---

## 10. Dependencies

### New packages
- None — reuses existing Tiptap, DOMPurify, R2 SDK from Phase 2

### Reused from Phase 2
- `ImageUploader`, `GalleryUploader` — service portfolio images
- `RichTextEditor` — service descriptions
- R2 presigned uploads — service images
- `EventStatusBadge` pattern — for `NegotiationStatusBadge`

---

## 11. Migration & Seeding

### Migration
- `drizzle/0003_*.sql` — creates service_categories, services, service_packages, service_images, negotiations, negotiation_rounds, event_services

### Seed Script
- `scripts/seed-service-categories.ts` — Seeds default service categories:
  DJ, Catering, Photography, Videography, Security, Lighting & Sound, Venue, Transportation, Decoration, Entertainment, Planning & Coordination, Other

---

## 12. Testing Checklist

### Service Listings
- [ ] Provider can create a service with category, description, banner
- [ ] Provider can add/edit/remove packages with price visibility toggle
- [ ] Provider can upload portfolio images
- [ ] Provider can deactivate a service listing
- [ ] Non-providers cannot create services

### Discovery
- [ ] Public browse page shows active services from active providers
- [ ] Category filter works
- [ ] Keyword search matches title, description, package names
- [ ] Location filter works
- [ ] Suspended/inactive providers' services are hidden

### Negotiations
- [ ] Organizer can request a quote (hidden price) → status: requested
- [ ] Organizer can send a direct offer (public price) → status: offered
- [ ] Provider can send an offer to organizer for an event → status: offered
- [ ] Provider responds to quote request with offer → status: offered
- [ ] Either party can counter → status: countered, loops back
- [ ] Either party can accept → status: accepted, event_services record created
- [ ] Either party can reject → status: rejected (terminal)
- [ ] Either party can cancel → status: cancelled (terminal)
- [ ] Suspended users cannot create or respond to negotiations
- [ ] Negotiation thread shows all rounds with correct sender/price/message
- [ ] Accepted provider appears on event detail page

### Admin
- [ ] Admin can manage service categories
- [ ] Admin can view/moderate services
- [ ] Admin can view negotiations
