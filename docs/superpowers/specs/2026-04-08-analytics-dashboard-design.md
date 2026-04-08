# Analytics Dashboard — Design Spec

## Overview

Add analytics dashboards to EOM at three levels: a dedicated admin analytics page, and enhanced organizer and service provider dashboards with charts and trend data. All analytics are derived from existing transactional data — no new database tables.

## Approach

- **Server-side aggregation**: New `app/server/fns/analytics.ts` with dedicated query functions
- **Charting**: Recharts (React, SVG-based, ~45kb gzipped)
- **Time periods**: Admin page has 7-day/30-day toggle. Organizer and provider dashboards are fixed at 30 days (no toggle).
- **No new DB tables**: All metrics computed from events, services, negotiations, negotiation_rounds, event_services, user_logs, users

## Negotiation Statuses (canonical)

Referenced throughout this spec. From the `negotiations` table:
- **Active**: `requested`, `offered`, `countered`
- **Terminal**: `accepted`, `rejected`, `cancelled`, `expired`

## Data Sources

| Metric | Source Tables | Query Pattern |
|--------|-------------|---------------|
| User growth | `users` | COUNT + GROUP BY date |
| Event counts by status | `events` | COUNT + GROUP BY status |
| Events by category | `events` JOIN `categories` (FK: events.categoryId) | COUNT + GROUP BY category.name |
| Service counts by category | `services` JOIN `service_categories` (FK: services.categoryId) | COUNT + GROUP BY serviceCategories.name |
| Negotiation funnel | `negotiations` | COUNT + GROUP BY status (all 7 statuses) |
| Negotiation outcomes per user | `negotiations` | COUNT + GROUP BY status WHERE provider/organizer |
| Revenue (platform) | `event_services` | SUM(agreed_price) |
| Revenue per provider | `event_services` JOIN `negotiations` | SUM(agreed_price) WHERE providerId = current user |
| Spend per organizer | `event_services` JOIN `events` | SUM(agreed_price) WHERE organizerId = current user |
| Spend per event | `event_services` | SUM(agreed_price) GROUP BY event_id |
| Avg rounds | `negotiation_rounds` | AVG of MAX(round_number) per negotiation |
| Daily registrations | `users` | COUNT + GROUP BY DATE(created_at) |
| Daily negotiation activity | `negotiations` | COUNT + GROUP BY DATE(created_at) |
| Service performance | `negotiations` + `event_services` | JOIN + GROUP BY service |

## Page 1: Admin Analytics (`/admin/analytics`)

**Capability required**: `admin:analytics:view` (new capability prefix). Auto-granted to superadmin via the existing capability system — superadmins bypass capability checks.

### KPI Cards (Row 1)
4 cards showing totals with period delta:
- **Total Users** — count of all users + new this period
- **Published Events** — count where status=published + new this period
- **Active Services** — count where is_active=true + new this period
- **Deals Closed** — count of accepted negotiations + total agreed value (€)

### Charts (Row 2)
- **User Registrations** — bar chart, daily new signups for selected period
- **Negotiation Funnel** — horizontal progress bars showing all 7 statuses: requested, offered, countered, accepted, rejected, cancelled, expired (all-time, not period-filtered)

### Charts (Row 3)
- **Events by Category** — donut chart with legend (all-time, not period-filtered)
- **Top Service Categories** — ranked list with service count per category, top 5 (all-time, not period-filtered)

### Period Toggle
Toggle between 7 days and 30 days. Affects only KPI deltas and User Registrations bar chart. Funnel, category charts are always all-time.

## Page 2: Enhanced Organizer Dashboard (`/organizer`)

Added below existing stats (Total Events, Published, Total Capacity). Fixed 30-day window, no toggle.

### New KPI Cards
- **Negotiations** — total count + active (non-terminal) count
- **Deals Closed** — accepted count + success rate (accepted / total terminal, as percentage)
- **Total Spent** — sum of agreed_price from event_services for this organizer's events
- **Avg Deal Value** — total spent / deals closed (show "—" if 0 deals)

### Charts
- **Event Status Breakdown** — donut chart (published/draft/cancelled/archived counts)
- **Service Spend per Event** — horizontal bar chart, top 5 events by total service cost
- **Negotiation Activity (30 Days)** — line chart with two series: total sent and accepted per day

### Empty States
- KPI cards show 0 / "—" for division-by-zero cases
- Charts show "No data yet" centered text when no records exist

## Page 3: Enhanced Service Provider Dashboard (`/service-provider`)

Added below existing stats (Services, Active Negotiations, Deals Closed). Fixed 30-day window, no toggle.

### New KPI Cards
- **Total Revenue** — sum of agreed_price from event_services for this provider
- **Avg Deal Value** — total revenue / deals closed (show "—" if 0 deals)
- **Success Rate** — accepted / total terminal negotiations (percentage, show "—" if 0 terminal)
- **Avg Rounds** — average of max round_number across terminal negotiations (show "—" if none)

### Charts
- **Revenue Trend (30 Days)** — area chart showing daily incremental revenue (not cumulative)
- **Negotiation Outcomes** — donut chart showing all terminal statuses: accepted, rejected, cancelled, expired

### Service Performance Table
Table with columns: Service Name, Inquiries (total negotiations), Deals (accepted), Conversion Rate (%), Revenue (€). One row per active service owned by the provider. Sorted by revenue descending.

### Empty States
- KPI cards show 0 / "—" for division-by-zero cases
- Charts show "No data yet" centered text when no records exist
- Table shows "No services yet" message when provider has no services

## Server Functions

### `app/server/fns/analytics.ts`

All functions return plain objects. Types are defined inline in the file.

**Admin functions** (require `admin:analytics:view`):

```typescript
getAdminKPIs({ period: 7 | 30 }) → {
  totalUsers: number; newUsers: number;
  publishedEvents: number; newEvents: number;
  activeServices: number; newServices: number;
  dealsClosed: number; newDeals: number; totalRevenue: string;
}

getAdminUserGrowth({ period: 7 | 30 }) → Array<{ date: string; count: number }>

getAdminNegotiationFunnel() → Array<{ status: string; count: number }>
// All-time, all 7 statuses

getAdminEventsByCategory() → Array<{ name: string; count: number }>
// All-time, all categories with at least 1 event

getAdminTopServiceCategories({ limit?: number }) → Array<{ name: string; count: number }>
// All-time, default limit 5
```

**Organizer functions** (require auth, scoped to session user):

```typescript
getOrganizerAnalytics() → {
  totalNegotiations: number; activeNegotiations: number;
  dealsClosed: number; successRate: number;
  totalSpent: string; avgDealValue: string;
}

getOrganizerEventBreakdown() → Array<{ status: string; count: number }>

getOrganizerSpendByEvent({ limit?: number }) → Array<{ eventId: string; title: string; totalSpend: string }>
// Default limit 5, sorted by spend descending

getOrganizerNegotiationTrend() → Array<{ date: string; sent: number; accepted: number }>
// Last 30 days, one entry per day
```

**Provider functions** (require auth, scoped to session user):

```typescript
getProviderAnalytics() → {
  totalRevenue: string; avgDealValue: string;
  successRate: number; avgRounds: number;
}

getProviderRevenueTrend() → Array<{ date: string; revenue: string }>
// Last 30 days, daily incremental revenue

getProviderNegotiationOutcomes() → Array<{ status: string; count: number }>
// Terminal statuses only: accepted, rejected, cancelled, expired

getProviderServicePerformance() → Array<{
  serviceId: string; title: string;
  inquiries: number; deals: number;
  conversionRate: number; revenue: string;
}>
// One row per active service, sorted by revenue desc
```

## Components

### Shared analytics components (`app/components/analytics/`)
- `KPICard.tsx` — stat card with label, value, subtitle (optional), delta (optional). Shows "—" for null/undefined values.
- `PeriodToggle.tsx` — 7d/30d toggle button group (admin only)
- `FunnelChart.tsx` — horizontal progress bar funnel (used by admin negotiation funnel)
- `EmptyChart.tsx` — "No data yet" placeholder for empty chart areas

### Page-specific sections
- `AdminAnalyticsCharts.tsx` — admin page chart grid (uses Recharts BarChart, PieChart directly)
- `OrganizerAnalyticsSection.tsx` — organizer dashboard analytics section (uses Recharts PieChart, BarChart, LineChart directly)
- `ProviderAnalyticsSection.tsx` — provider dashboard analytics section (uses Recharts AreaChart, PieChart directly)

Note: Recharts PieChart is used directly for all donut charts (set `innerRadius` prop). No shared donut wrapper needed — each usage is a few lines of JSX.

## Routes

### New
- `app/routes/admin/analytics.tsx` — full admin analytics page

### Modified
- `app/routes/admin/route.tsx` — add `admin:analytics:view` to capList
- `app/components/layout/AdminSidebar.tsx` — add Analytics menu item
- `app/routes/organizer/index.tsx` — import and render OrganizerAnalyticsSection
- `app/routes/service-provider/index.tsx` — import and render ProviderAnalyticsSection
- `app/server/fns/capabilities.ts` — add `admin:analytics:view` prefix

## Dependencies

Add to `package.json`:
```
"recharts": "^2.15.0"
```

## Out of Scope

- Custom date range picker
- Export to CSV/PDF
- Real-time updates / WebSocket
- Caching layer for analytics queries
- Comparative periods ("vs last month")
- Loading skeletons (use simple "Loading..." text, consistent with existing pattern)
