# Chat/Messaging Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time negotiation-scoped chat with silent contact-info filtering and admin monitoring.

**Architecture:** Messages stored in PostgreSQL, delivered via SSE (with polling fallback). Every message runs through a two-layer content filter (regex + normalization) before storage. Flagged messages are delivered normally but silently logged for admin review.

**Tech Stack:** TanStack Start, Drizzle ORM, PostgreSQL, Server-Sent Events, createServerFn / createServerFileRoute

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `app/lib/content-filter.ts` | Two-layer content filter (regex + normalization) |
| `app/server/fns/chat.ts` | All chat server functions (send, get, read receipts, status, admin) |
| `app/routes/api/chat-stream.ts` | SSE endpoint for real-time message delivery |
| `app/components/chat/ChatThread.tsx` | Scrollable message bubble list with date separators |
| `app/components/chat/ChatInput.tsx` | Text input with send button, disabled/read-only states |
| `app/components/chat/ChatTab.tsx` | Tab orchestrator — SSE connection, polling fallback, state management |
| `app/components/chat/ChatUnreadBadge.tsx` | Small unread count badge for negotiation cards |
| `app/routes/admin/chat.tsx` | Admin chat moderation page (flagged queue + conversation browser) |

### Modified Files
| File | Changes |
|------|---------|
| `app/lib/schema.ts` | Add `messages`, `messageFlags`, `messageReadReceipts` tables + relations |
| `app/server/fns/capabilities.ts` | Add `'admin:chat:moderate'` to `VALID_CAPABILITY_PREFIXES` |
| `app/routes/admin/route.tsx` | Add `'admin:chat:moderate'` to `capList` |
| `app/components/layout/AdminSidebar.tsx` | Add Chat menu item |
| `app/routes/organizer/negotiations/$negotiationId.tsx` | Add Chat tab integration |
| `app/routes/service-provider/negotiations/$negotiationId.tsx` | Add Chat tab integration |
| `app/components/negotiations/NegotiationCard.tsx` | Add `unreadCount` prop + badge |
| `app/routes/organizer/negotiations/index.tsx` | Fetch + pass unread counts |
| `app/routes/service-provider/negotiations/index.tsx` | Fetch + pass unread counts |

---

## Chunk 1: Schema, Capabilities, Content Filter, Server Functions

### Task 1: Schema — Add messages, messageFlags, messageReadReceipts tables

**Files:**
- Modify: `app/lib/schema.ts`

- [ ] **Step 1: Add the three new tables to schema.ts**

Add this block **before** the `// Singular aliases` section at the bottom of `app/lib/schema.ts` (after the `reviewsRelations`):

```typescript
// ============================================================
// Chat / Messaging
// ============================================================

export const messages = pgTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  negotiationId: text('negotiation_id').notNull().references(() => negotiations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('messages_negotiation_created_idx').on(table.negotiationId, table.createdAt),
])

export const messageFlags = pgTable('message_flags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  flagType: text('flag_type').notNull(),
  matchedContent: text('matched_content').notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: text('resolved_by').references(() => users.id),
  resolution: text('resolution'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('message_flags_message_idx').on(table.messageId),
  index('message_flags_resolved_idx').on(table.resolvedAt),
])

export const messageReadReceipts = pgTable('message_read_receipts', {
  negotiationId: text('negotiation_id').notNull().references(() => negotiations.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  lastReadAt: timestamp('last_read_at').notNull(),
  lastReadMessageId: text('last_read_message_id').notNull().references(() => messages.id),
}, (table) => [
  primaryKey({ columns: [table.negotiationId, table.userId] }),
])
```

- [ ] **Step 2: Add relations for the new tables**

Add below the table definitions, still before the singular aliases:

```typescript
export const messagesRelations = relations(messages, ({ one, many }) => ({
  negotiation: one(negotiations, { fields: [messages.negotiationId], references: [negotiations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  flags: many(messageFlags),
}))

export const messageFlagsRelations = relations(messageFlags, ({ one }) => ({
  message: one(messages, { fields: [messageFlags.messageId], references: [messages.id] }),
  resolvedByUser: one(users, { fields: [messageFlags.resolvedBy], references: [users.id] }),
}))

export const messageReadReceiptsRelations = relations(messageReadReceipts, ({ one }) => ({
  negotiation: one(negotiations, { fields: [messageReadReceipts.negotiationId], references: [negotiations.id] }),
  user: one(users, { fields: [messageReadReceipts.userId], references: [users.id] }),
  lastReadMessage: one(messages, { fields: [messageReadReceipts.lastReadMessageId], references: [messages.id] }),
}))
```

- [ ] **Step 3: Update `negotiationsRelations` to include messages**

In the existing `negotiationsRelations`, add `messages: many(messages),` after the `rounds` line:

```typescript
export const negotiationsRelations = relations(negotiations, ({ one, many }) => ({
  event: one(events, { fields: [negotiations.eventId], references: [events.id] }),
  service: one(services, { fields: [negotiations.serviceId], references: [services.id] }),
  package: one(servicePackages, { fields: [negotiations.packageId], references: [servicePackages.id] }),
  organizer: one(users, { fields: [negotiations.organizerId], references: [users.id] }),
  provider: one(users, { fields: [negotiations.providerId], references: [users.id] }),
  rounds: many(negotiationRounds),
  messages: many(messages),
  eventService: one(eventServices),
}))
```

- [ ] **Step 4: Update the imports at the top of schema.ts**

The file already imports `primaryKey` from `drizzle-orm/pg-core` (used by `eventTags`). Add `index` to the `drizzle-orm/pg-core` import:

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
  numeric,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core'
```

Also add `sentMessages: many(messages)` to `usersRelations`:

```typescript
export const usersRelations = relations(users, ({ one, many }) => ({
  // ... existing relations ...
  sentMessages: many(messages),
}))
```

- [ ] **Step 5: Generate the migration**

```bash
npx drizzle-kit generate
```

Expected: Creates `drizzle/0005_*.sql` with CREATE TABLE statements for `messages`, `message_flags`, `message_read_receipts`.

- [ ] **Step 6: Commit**

```bash
git add app/lib/schema.ts drizzle/
git commit -m "feat(chat): add messages, messageFlags, messageReadReceipts schema + migration"
```

---

### Task 2: Admin capability + sidebar

**Files:**
- Modify: `app/server/fns/capabilities.ts`
- Modify: `app/routes/admin/route.tsx`
- Modify: `app/components/layout/AdminSidebar.tsx`

- [ ] **Step 1: Add capability prefix**

In `app/server/fns/capabilities.ts`, add `'admin:chat:moderate'` to the `VALID_CAPABILITY_PREFIXES` array (after `'admin:reviews:moderate'`):

```typescript
  'admin:reviews:moderate',
  'admin:chat:moderate',
]
```

- [ ] **Step 2: Add to admin route capList**

In `app/routes/admin/route.tsx`, add `'admin:chat:moderate'` to the `capList` array (after `'admin:reviews:moderate'`):

```typescript
          'admin:reviews:moderate',
          'admin:chat:moderate',
        ]
```

- [ ] **Step 3: Add sidebar item**

In `app/components/layout/AdminSidebar.tsx`, add a Chat item to `SIDEBAR_ITEMS` (after the Reviews item):

```typescript
  {
    label: 'Chat',
    href: '/admin/chat',
    capability: 'admin:chat:moderate',
  },
```

- [ ] **Step 4: Commit**

```bash
git add app/server/fns/capabilities.ts app/routes/admin/route.tsx app/components/layout/AdminSidebar.tsx
git commit -m "feat(chat): add admin:chat:moderate capability + sidebar item"
```

---

### Task 3: Content filter module

**Files:**
- Create: `app/lib/content-filter.ts`

- [ ] **Step 1: Create the content filter**

```typescript
// app/lib/content-filter.ts

export interface ContentFlag {
  flagType: 'phone' | 'email' | 'social' | 'url' | 'messaging_app'
  matchedContent: string
}

// ── Number word maps ──

const EN_NUMBERS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4',
  five: '5', six: '6', seven: '7', eight: '8', nine: '9',
}

const AL_NUMBERS: Record<string, string> = {
  zero: '0', nje: '1', dy: '2', tre: '3', kater: '4',
  pese: '5', gjashte: '6', shtate: '7', tete: '8', nente: '9',
}

// Sorted longest-first so "shtate" matches before "sh" prefix issues
const ALL_NUMBER_WORDS = Object.keys({ ...EN_NUMBERS, ...AL_NUMBERS })
  .sort((a, b) => b.length - a.length)

const NUMBER_MAP: Record<string, string> = { ...EN_NUMBERS, ...AL_NUMBERS }

// ── Letter substitutions ──
const LETTER_SUBS: Record<string, string> = {
  o: '0', O: '0', l: '1', I: '1', s: '5', S: '5', B: '8',
}

// ── Regex patterns (Layer 1) ──

const PHONE_REGEX = /(?:\+?\d[\d\s\-().]{6,15}\d)/g
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const URL_REGEX = /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|net|org|io|co|al|me|info|biz|app|dev)(?:\/[^\s]*)?/gi
const SOCIAL_REGEX = /@[a-zA-Z0-9_]{3,30}/g
const MESSAGING_APP_REGEX = /\b(?:whatsapp|telegram|signal|viber|messenger|instagram\s*dm|insta\s*dm)\b/gi

// ── Normalization (Layer 2) ──

function normalizeMessage(text: string): string {
  let normalized = text.toLowerCase()

  // Replace spelled-out number words with digits (longest first)
  for (const word of ALL_NUMBER_WORDS) {
    const regex = new RegExp(word, 'gi')
    normalized = normalized.replace(regex, NUMBER_MAP[word])
  }

  // Letter substitutions — only in sequences that already contain digits
  // to avoid massive false positives on normal text like "Hello Boss"
  normalized = normalized.replace(/(?:\d[oOlISsB\d\s-]*|[oOlISsB][oOlISsB\d\s-]*\d)[oOlISsB\d\s-]*/g, (match) => {
    return match.replace(/[oOlISsB]/g, (ch) => LETTER_SUBS[ch] ?? ch)
  })

  // Strip separators between single digits/chars: "0 6 9" → "069"
  normalized = normalized.replace(/(\d)\s+(?=\d)/g, '$1')

  return normalized
}

// ── Main filter function ──

export function scanMessage(content: string): ContentFlag[] {
  const flags: ContentFlag[] = []
  const seen = new Set<string>()

  function addFlag(flagType: ContentFlag['flagType'], matched: string) {
    const key = `${flagType}:${matched}`
    if (!seen.has(key)) {
      seen.add(key)
      flags.push({ flagType, matchedContent: matched })
    }
  }

  // Layer 1: Direct regex on original text
  for (const match of content.matchAll(PHONE_REGEX)) addFlag('phone', match[0])
  for (const match of content.matchAll(EMAIL_REGEX)) addFlag('email', match[0])
  for (const match of content.matchAll(URL_REGEX)) addFlag('url', match[0])
  for (const match of content.matchAll(SOCIAL_REGEX)) addFlag('social', match[0])
  for (const match of content.matchAll(MESSAGING_APP_REGEX)) addFlag('messaging_app', match[0])

  // Layer 2: Normalize then re-scan for phone/email
  const normalized = normalizeMessage(content)
  for (const match of normalized.matchAll(PHONE_REGEX)) addFlag('phone', match[0])
  for (const match of normalized.matchAll(EMAIL_REGEX)) addFlag('email', match[0])

  return flags
}
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/content-filter.ts
git commit -m "feat(chat): add two-layer content filter with English/Albanian number normalization"
```

---

### Task 4: Chat server functions

**Files:**
- Create: `app/server/fns/chat.ts`

- [ ] **Step 1: Create the chat server functions file**

```typescript
// app/server/fns/chat.ts
import { createServerFn } from '@tanstack/react-start'
import { db } from '~/lib/db'
import { messages, messageFlags, messageReadReceipts, negotiations, negotiationRounds, events, users } from '~/lib/schema'
import { eq, and, desc, asc, gt, sql, isNull, isNotNull, count } from 'drizzle-orm'
import { requireAuth } from './auth-helpers'
import { requireCapability, hasCapability } from '~/lib/permissions.server'
import { scanMessage } from '~/lib/content-filter'
import type { Role } from '~/lib/permissions'

// ── Helpers ──

const TERMINAL_STATUSES = ['accepted', 'rejected', 'cancelled', 'expired']
const MAX_MESSAGE_LENGTH = 2000
const RATE_LIMIT_PER_HOUR = 30

async function verifyNegotiationParty(negotiationId: string, userId: string) {
  const neg = await db.query.negotiations.findFirst({
    where: eq(negotiations.id, negotiationId),
    columns: { id: true, organizerId: true, providerId: true },
  })
  if (!neg) throw new Error('NOT_FOUND')
  if (neg.organizerId !== userId && neg.providerId !== userId) {
    throw new Error('FORBIDDEN')
  }
  return neg
}

// ── Chat status helper (plain function, usable from other server fns) ──

async function getChatStatusInternal(negotiationId: string, userId: string) {
  const neg = await db.query.negotiations.findFirst({
    where: eq(negotiations.id, negotiationId),
    columns: { id: true, organizerId: true, providerId: true, status: true },
    with: {
      event: { columns: { startDate: true, endDate: true } },
      rounds: {
        columns: { senderId: true },
        orderBy: [asc(negotiationRounds.roundNumber)],
      },
    },
  })
  if (!neg) throw new Error('NOT_FOUND')
  if (neg.organizerId !== userId && neg.providerId !== userId) {
    throw new Error('FORBIDDEN')
  }

  // Count distinct senders in rounds
  const senderIds = new Set(neg.rounds.map((r) => r.senderId))
  const roundCount = neg.rounds.length
  const bothPartiesEngaged = senderIds.size >= 2 && roundCount >= 2

  // Determine chat state
  if (!bothPartiesEngaged) {
    return { status: 'locked' as const, reason: 'Waiting for both parties to engage in negotiation' }
  }

  if (['rejected', 'cancelled', 'expired'].includes(neg.status)) {
    return { status: 'readonly' as const, reason: `Negotiation ${neg.status}` }
  }

  if (neg.status === 'accepted') {
    const eventDate = neg.event.endDate ?? neg.event.startDate
    if (eventDate && new Date(eventDate) < new Date()) {
      return { status: 'readonly' as const, reason: 'Event has ended' }
    }
    return { status: 'active' as const }
  }

  // offered/countered with 2+ rounds from both parties
  return { status: 'active' as const }
}

// ── getChatStatus (public server function wrapper) ──

export const getChatStatus = createServerFn({ method: 'GET' })
  .validator((input: { negotiationId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    return getChatStatusInternal(data.negotiationId, session.user.id)
  })

// ── sendMessage ──

export const sendMessage = createServerFn({ method: 'POST' })
  .validator((input: { negotiationId: string; content: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.isSuspended || session.user.banned) throw new Error('ACCOUNT_SUSPENDED')
    if (!session.user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED')

    const content = data.content.trim()
    if (!content) throw new Error('EMPTY_MESSAGE')
    if (content.length > MAX_MESSAGE_LENGTH) throw new Error('MESSAGE_TOO_LONG')

    // Verify party access
    await verifyNegotiationParty(data.negotiationId, session.user.id)

    // Verify chat is active (not locked or readonly) — use internal helper to avoid nested server fn call
    const status = await getChatStatusInternal(data.negotiationId, session.user.id)
    if (status.status !== 'active') {
      throw new Error('CHAT_NOT_ACTIVE')
    }

    // Rate limiting: count messages in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const [rateCheck] = await db
      .select({ count: count() })
      .from(messages)
      .where(and(
        eq(messages.negotiationId, data.negotiationId),
        eq(messages.senderId, session.user.id),
        gt(messages.createdAt, oneHourAgo),
      ))
    if ((rateCheck?.count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      throw new Error('RATE_LIMIT_EXCEEDED')
    }

    // Store the message
    const [msg] = await db.insert(messages).values({
      negotiationId: data.negotiationId,
      senderId: session.user.id,
      content,
    }).returning()

    // Run content filter (async, non-blocking for the user)
    const flagResults = scanMessage(content)
    if (flagResults.length > 0) {
      await db.insert(messageFlags).values(
        flagResults.map((f) => ({
          messageId: msg.id,
          flagType: f.flagType,
          matchedContent: f.matchedContent,
        })),
      )
    }

    return {
      id: msg.id,
      negotiationId: msg.negotiationId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt,
      sender: { id: session.user.id, name: session.user.name, image: session.user.image ?? null },
    }
  })

// ── getMessages ──

export const getMessages = createServerFn({ method: 'GET' })
  .validator((input: { negotiationId: string; cursor?: string; limit?: number }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const limit = data.limit ?? 50

    // Check if admin or party
    const isAdmin = await hasCapability(session.user.id, session.user.role as Role, 'admin:chat:moderate')
    if (!isAdmin) {
      await verifyNegotiationParty(data.negotiationId, session.user.id)
    }

    const conditions = [eq(messages.negotiationId, data.negotiationId)]
    if (data.cursor) {
      // Cursor is a message ID — get messages older than that message
      const cursorMsg = await db.query.messages.findFirst({
        where: eq(messages.id, data.cursor),
        columns: { createdAt: true },
      })
      if (cursorMsg) {
        conditions.push(sql`${messages.createdAt} < ${cursorMsg.createdAt}`)
      }
    }

    const results = await db.query.messages.findMany({
      where: and(...conditions),
      with: {
        sender: { columns: { id: true, name: true, image: true } },
      },
      orderBy: [desc(messages.createdAt)],
      limit: limit + 1, // fetch one extra to detect "has more"
    })

    const hasMore = results.length > limit
    const items = hasMore ? results.slice(0, limit) : results

    // Get the other party's read receipt for "Read" indicator
    let otherReadAt: string | null = null
    if (!isAdmin) {
      const neg = await db.query.negotiations.findFirst({
        where: eq(negotiations.id, data.negotiationId),
        columns: { organizerId: true, providerId: true },
      })
      if (neg) {
        const otherUserId = neg.organizerId === session.user.id ? neg.providerId : neg.organizerId
        const otherReceipt = await db.query.messageReadReceipts.findFirst({
          where: and(
            eq(messageReadReceipts.negotiationId, data.negotiationId),
            eq(messageReadReceipts.userId, otherUserId),
          ),
        })
        if (otherReceipt) otherReadAt = otherReceipt.lastReadAt.toISOString()
      }
    }

    return {
      messages: items.reverse(), // return in chronological order
      hasMore,
      nextCursor: hasMore ? items[0]?.id : null, // oldest message in this page
      otherReadAt,
    }
  })

// ── markAsRead ──

export const markAsRead = createServerFn({ method: 'POST' })
  .validator((input: { negotiationId: string; messageId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await verifyNegotiationParty(data.negotiationId, session.user.id)

    await db
      .insert(messageReadReceipts)
      .values({
        negotiationId: data.negotiationId,
        userId: session.user.id,
        lastReadAt: new Date(),
        lastReadMessageId: data.messageId,
      })
      .onConflictDoUpdate({
        target: [messageReadReceipts.negotiationId, messageReadReceipts.userId],
        set: {
          lastReadAt: new Date(),
          lastReadMessageId: data.messageId,
        },
      })

    return { success: true }
  })

// ── getUnreadCounts ──

export const getUnreadCounts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()

    // Get all negotiations where user is a party
    const myNegotiations = await db.query.negotiations.findMany({
      where: sql`${negotiations.organizerId} = ${session.user.id} OR ${negotiations.providerId} = ${session.user.id}`,
      columns: { id: true },
    })

    if (myNegotiations.length === 0) return {}

    const negIds = myNegotiations.map((n) => n.id)

    // For each negotiation, count messages after the user's last read receipt
    const results = await db.execute(sql`
      SELECT
        m.negotiation_id AS "negotiationId",
        COUNT(*)::int AS "unreadCount"
      FROM messages m
      LEFT JOIN message_read_receipts mrr
        ON mrr.negotiation_id = m.negotiation_id
        AND mrr.user_id = ${session.user.id}
      WHERE m.negotiation_id IN (${sql.join(negIds.map(id => sql`${id}`), sql`, `)})
        AND m.sender_id != ${session.user.id}
        AND (mrr.last_read_at IS NULL OR m.created_at > mrr.last_read_at)
      GROUP BY m.negotiation_id
    `)

    const counts: Record<string, number> = {}
    for (const row of results.rows as { negotiationId: string; unreadCount: number }[]) {
      counts[row.negotiationId] = row.unreadCount
    }
    return counts
  },
)

// ── Admin: getFlaggedMessages ──

export const getFlaggedMessages = createServerFn({ method: 'GET' })
  .validator((input: { status?: 'pending' | 'resolved'; limit?: number; offset?: number } | undefined) => input ?? {})
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:chat:moderate')

    const limit = data.limit ?? 20
    const offset = data.offset ?? 0

    const conditions = []
    if (data.status === 'resolved') {
      conditions.push(isNotNull(messageFlags.resolvedAt))
    } else {
      // Default to pending
      conditions.push(isNull(messageFlags.resolvedAt))
    }

    const results = await db.query.messageFlags.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        message: {
          with: {
            sender: { columns: { id: true, name: true, image: true } },
            negotiation: {
              columns: { id: true },
              with: {
                organizer: { columns: { id: true, name: true } },
                provider: { columns: { id: true, name: true } },
                service: { columns: { title: true } },
                event: { columns: { title: true } },
              },
            },
          },
        },
        resolvedByUser: { columns: { id: true, name: true } },
      },
      orderBy: [desc(messageFlags.createdAt)],
      limit,
      offset,
    })

    const [totalResult] = await db
      .select({ count: count() })
      .from(messageFlags)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return { flags: results, total: totalResult?.count ?? 0 }
  })

// ── Admin: resolveFlag ──

export const resolveFlag = createServerFn({ method: 'POST' })
  .validator((input: { flagId: string; resolution: 'dismissed' | 'warned' }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:chat:moderate')

    const flag = await db.query.messageFlags.findFirst({
      where: eq(messageFlags.id, data.flagId),
    })
    if (!flag) throw new Error('NOT_FOUND')

    await db.update(messageFlags).set({
      resolvedAt: new Date(),
      resolvedBy: session.user.id,
      resolution: data.resolution,
    }).where(eq(messageFlags.id, data.flagId))

    return { success: true }
  })
```

- [ ] **Step 2: Commit**

```bash
git add app/server/fns/chat.ts
git commit -m "feat(chat): add chat server functions — send, get, read receipts, unread counts, admin moderation"
```

---

### Task 5: SSE endpoint

**Files:**
- Create: `app/routes/api/chat-stream.ts`

- [ ] **Step 1: Create the SSE API route**

```typescript
// app/routes/api/chat-stream.ts
import { createServerFileRoute } from '@tanstack/react-start/server'
import { db } from '~/lib/db'
import { messages, negotiations } from '~/lib/schema'
import { eq, and, gt, desc } from 'drizzle-orm'
import { auth } from '~/lib/auth'

export const ServerRoute = createServerFileRoute('/api/chat-stream').methods({
  GET: async ({ request }) => {
    const url = new URL(request.url)
    const negotiationId = url.searchParams.get('negotiationId')
    const lastEventId = request.headers.get('Last-Event-ID')

    if (!negotiationId) {
      return new Response('Missing negotiationId', { status: 400 })
    }

    // Auth check — use auth.api directly since getSession() relies on
    // TanStack Start async context which is unavailable in createServerFileRoute
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Verify party access
    const neg = await db.query.negotiations.findFirst({
      where: eq(negotiations.id, negotiationId),
      columns: { organizerId: true, providerId: true },
    })
    if (!neg) {
      return new Response('Not found', { status: 404 })
    }
    if (neg.organizerId !== session.user.id && neg.providerId !== session.user.id) {
      return new Response('Forbidden', { status: 403 })
    }

    // Track the last sent message ID
    let lastSentId = lastEventId || ''

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let keepaliveInterval: ReturnType<typeof setInterval>
        let pollInterval: ReturnType<typeof setInterval>

        function send(data: string, id?: string) {
          try {
            if (id) controller.enqueue(encoder.encode(`id: ${id}\n`))
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } catch {
            // Stream closed
            cleanup()
          }
        }

        function cleanup() {
          clearInterval(keepaliveInterval)
          clearInterval(pollInterval)
          try { controller.close() } catch {}
        }

        // Send keepalive every 30 seconds
        keepaliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            cleanup()
          }
        }, 30000)

        // Poll for new messages every 3 seconds
        pollInterval = setInterval(async () => {
          try {
            const conditions = [eq(messages.negotiationId, negotiationId)]

            if (lastSentId) {
              // Get the timestamp of the last sent message
              const lastMsg = await db.query.messages.findFirst({
                where: eq(messages.id, lastSentId),
                columns: { createdAt: true },
              })
              if (lastMsg) {
                conditions.push(gt(messages.createdAt, lastMsg.createdAt))
              }
            }

            const newMessages = await db.query.messages.findMany({
              where: and(...conditions),
              with: {
                sender: { columns: { id: true, name: true, image: true } },
              },
              orderBy: [desc(messages.createdAt)],
              limit: 50,
            })

            // Send in chronological order
            for (const msg of newMessages.reverse()) {
              send(JSON.stringify({
                id: msg.id,
                negotiationId: msg.negotiationId,
                senderId: msg.senderId,
                content: msg.content,
                createdAt: msg.createdAt,
                sender: msg.sender,
              }), msg.id)
              lastSentId = msg.id
            }
          } catch {
            cleanup()
          }
        }, 3000)

        // Clean up when client disconnects
        request.signal.addEventListener('abort', cleanup)
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/api/chat-stream.ts
git commit -m "feat(chat): add SSE endpoint for real-time message streaming"
```

---

## Chunk 2: UI Components

### Task 6: ChatThread component

**Files:**
- Create: `app/components/chat/ChatThread.tsx`

- [ ] **Step 1: Create the ChatThread component**

```tsx
// app/components/chat/ChatThread.tsx
import { useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  senderId: string
  content: string
  createdAt: string
  sender: { id: string; name: string; image: string | null }
}

interface ChatThreadProps {
  messages: ChatMessage[]
  currentUserId: string
  hasMore: boolean
  onLoadMore: () => void
  otherReadAt?: string | null
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ChatThread({ messages, currentUserId, hasMore, onLoadMore, otherReadAt }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const prevLengthRef = useRef(messages.length)

  // Auto-scroll to bottom on new messages (only if already near bottom)
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const container = containerRef.current
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
        if (isNearBottom) {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }
    }
    prevLengthRef.current = messages.length
  }, [messages.length])

  // Scroll to bottom on initial load
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [])

  // Group messages by date
  let lastDate = ''

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="mx-auto block text-xs text-indigo-600 hover:underline"
        >
          Load older messages
        </button>
      )}

      {messages.map((msg) => {
        const isMe = msg.senderId === currentUserId
        const dateLabel = formatDate(msg.createdAt)
        const showDate = dateLabel !== lastDate
        lastDate = dateLabel

        // Check if the other party has read up to this message
        const isRead = isMe && otherReadAt && new Date(msg.createdAt) <= new Date(otherReadAt)

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="my-3 text-center text-xs text-gray-400">{dateLabel}</div>
            )}
            <div className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`} style={{ maxWidth: '75%', marginLeft: isMe ? 'auto' : undefined }}>
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isMe ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                }`}
              >
                {isMe ? 'You' : getInitials(msg.sender.name)}
              </div>
              <div>
                <div
                  className={`rounded-xl px-3.5 py-2.5 text-sm ${
                    isMe
                      ? 'rounded-tr-sm bg-indigo-600 text-white'
                      : 'rounded-tl-sm border bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  {msg.content}
                </div>
                <div className={`mt-1 text-[10px] text-gray-400 ${isMe ? 'text-right' : ''}`}>
                  {isMe ? 'You' : msg.sender.name} · {formatTime(msg.createdAt)}
                  {isRead && <span className="ml-1">· Read</span>}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/chat/ChatThread.tsx
git commit -m "feat(chat): add ChatThread component with date separators and read receipts"
```

---

### Task 7: ChatInput component

**Files:**
- Create: `app/components/chat/ChatInput.tsx`

- [ ] **Step 1: Create the ChatInput component**

```tsx
// app/components/chat/ChatInput.tsx
import { useState, useRef } from 'react'

interface ChatInputProps {
  onSend: (content: string) => Promise<void>
  disabled?: boolean
  disabledReason?: string
}

export function ChatInput({ onSend, disabled, disabledReason }: ChatInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function handleSend() {
    const content = text.trim()
    if (!content || sending || disabled) return

    setSending(true)
    setError(null)
    try {
      await onSend(content)
      setText('')
      inputRef.current?.focus()
    } catch (e: any) {
      if (e.message?.includes('RATE_LIMIT')) {
        setError('Slow down — too many messages. Try again in a minute.')
      } else {
        setError('Failed to send message')
      }
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (disabled) {
    return (
      <div className="border-t bg-gray-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-800/50">
        <p className="text-sm text-gray-400">{disabledReason || 'Chat is not available'}</p>
      </div>
    )
  }

  return (
    <div className="border-t px-4 py-3 dark:border-gray-700">
      {error && (
        <p className="mb-2 text-xs text-red-500">{error}</p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-2xl border bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-800 dark:focus:border-indigo-600"
          style={{ maxHeight: 120 }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:opacity-40"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/chat/ChatInput.tsx
git commit -m "feat(chat): add ChatInput component with Enter-to-send and rate limit feedback"
```

---

### Task 8: ChatTab orchestrator component

**Files:**
- Create: `app/components/chat/ChatTab.tsx`

- [ ] **Step 1: Create the ChatTab orchestrator**

This component manages the SSE connection, polling fallback, and coordinates ChatThread + ChatInput:

```tsx
// app/components/chat/ChatTab.tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatThread, type ChatMessage } from './ChatThread'
import { ChatInput } from './ChatInput'
import { sendMessage, getMessages, markAsRead, getChatStatus } from '~/server/fns/chat'

interface ChatTabProps {
  negotiationId: string
  currentUserId: string
}

export function ChatTab({ negotiationId, currentUserId }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [chatStatus, setChatStatus] = useState<{ status: 'active' | 'readonly' | 'locked'; reason?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load initial messages + status
  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        const [statusResult, msgResult] = await Promise.all([
          getChatStatus({ data: { negotiationId } }),
          getMessages({ data: { negotiationId } }),
        ])
        if (!mounted) return
        setChatStatus(statusResult)
        setMessages(msgResult.messages)
        setHasMore(msgResult.hasMore)
        setNextCursor(msgResult.nextCursor)
        if (msgResult.otherReadAt) setOtherReadAt(msgResult.otherReadAt)

        // Mark as read if there are messages
        const lastMsg = msgResult.messages[msgResult.messages.length - 1]
        if (lastMsg) {
          markAsRead({ data: { negotiationId, messageId: lastMsg.id } })
        }
      } catch (err) {
        console.error('Failed to init chat:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    init()
    return () => { mounted = false }
  }, [negotiationId])

  // SSE connection with polling fallback
  useEffect(() => {
    if (chatStatus?.status === 'locked') return

    let reconnectDelay = 1000
    let sseActive = false

    function connectSSE() {
      const es = new EventSource(`/api/chat-stream?negotiationId=${negotiationId}`)
      eventSourceRef.current = es

      es.onopen = () => {
        sseActive = true
        reconnectDelay = 1000
        // Stop polling if active
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
      }

      es.onmessage = (event) => {
        try {
          const msg: ChatMessage = JSON.parse(event.data)
          setMessages((prev) => {
            // Dedupe
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // Auto-mark as read if from other party
          if (msg.senderId !== currentUserId) {
            markAsRead({ data: { negotiationId, messageId: msg.id } })
          }
        } catch {}
      }

      es.onerror = () => {
        sseActive = false
        es.close()
        eventSourceRef.current = null

        // Start polling fallback
        startPolling()

        // Attempt reconnect with exponential backoff
        setTimeout(() => {
          connectSSE()
          reconnectDelay = Math.min(reconnectDelay * 2, 30000)
        }, reconnectDelay)
      }
    }

    function startPolling() {
      if (pollIntervalRef.current) return
      pollIntervalRef.current = setInterval(async () => {
        if (sseActive) return
        try {
          const result = await getMessages({ data: { negotiationId } })
          setMessages(result.messages)
        } catch {}
      }, 5000)
    }

    connectSSE()

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [negotiationId, currentUserId, chatStatus?.status])

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return
    try {
      const result = await getMessages({ data: { negotiationId, cursor: nextCursor } })
      setMessages((prev) => [...result.messages, ...prev])
      setHasMore(result.hasMore)
      setNextCursor(result.nextCursor)
    } catch {}
  }, [negotiationId, nextCursor])

  const handleSend = useCallback(async (content: string) => {
    const msg = await sendMessage({ data: { negotiationId, content } })
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [negotiationId])

  if (loading) {
    return <p className="p-4 text-sm text-gray-400">Loading chat...</p>
  }

  if (chatStatus?.status === 'locked') {
    return null // Tab shouldn't be visible when locked
  }

  const isReadonly = chatStatus?.status === 'readonly'

  return (
    <div className="flex flex-col" style={{ height: '500px' }}>
      <ChatThread
        messages={messages}
        currentUserId={currentUserId}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        otherReadAt={otherReadAt}
      />
      <ChatInput
        onSend={handleSend}
        disabled={isReadonly}
        disabledReason={chatStatus?.reason}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/chat/ChatTab.tsx
git commit -m "feat(chat): add ChatTab orchestrator with SSE connection and polling fallback"
```

---

### Task 9: ChatUnreadBadge component

**Files:**
- Create: `app/components/chat/ChatUnreadBadge.tsx`

- [ ] **Step 1: Create the unread badge component**

```tsx
// app/components/chat/ChatUnreadBadge.tsx

interface ChatUnreadBadgeProps {
  count: number
}

export function ChatUnreadBadge({ count }: ChatUnreadBadgeProps) {
  if (count <= 0) return null

  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/chat/ChatUnreadBadge.tsx
git commit -m "feat(chat): add ChatUnreadBadge component"
```

---

## Chunk 3: Page Integrations

### Task 10: Integrate chat into organizer negotiation detail page

**Files:**
- Modify: `app/routes/organizer/negotiations/$negotiationId.tsx`

- [ ] **Step 1: Add chat tab to the organizer negotiation detail page**

Read the existing file first, then apply these changes surgically. The final result should look like:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { getNegotiation, respondToNegotiation, cancelNegotiation } from '~/server/fns/negotiations'
import { getChatStatus } from '~/server/fns/chat'
import { NegotiationThread } from '~/components/negotiations/NegotiationThread'
import { NegotiationActions } from '~/components/negotiations/NegotiationActions'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'
import { ChatTab } from '~/components/chat/ChatTab'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/organizer/negotiations/$negotiationId')({
  loader: async ({ params }) => {
    const negotiation = await getNegotiation({ data: { negotiationId: params.negotiationId } })
    let chatStatus: { status: 'active' | 'readonly' | 'locked' } = { status: 'locked' }
    try {
      chatStatus = await getChatStatus({ data: { negotiationId: params.negotiationId } })
    } catch {}
    return { negotiation, chatStatus }
  },
  component: OrganizerNegotiationDetailPage,
})

function OrganizerNegotiationDetailPage() {
  const { chatStatus: initialChatStatus } = Route.useLoaderData()
  const [negotiation, setNegotiation] = useState(Route.useLoaderData().negotiation)
  const [activeTab, setActiveTab] = useState<'negotiation' | 'chat'>('negotiation')
  const session = useSession()
  const userId = session.data?.user?.id ?? ''

  const lastRound = negotiation.rounds?.[negotiation.rounds.length - 1]
  const isMyTurn = lastRound ? lastRound.senderId !== userId : false
  const showChatTab = initialChatStatus.status !== 'locked'

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

      {showChatTab && (
        <div className="mb-6 flex border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('negotiation')}
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'negotiation'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Negotiation
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'chat'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chat
          </button>
        </div>
      )}

      {activeTab === 'negotiation' ? (
        <>
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
        </>
      ) : (
        <ChatTab negotiationId={negotiation.id} currentUserId={userId} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/organizer/negotiations/\$negotiationId.tsx
git commit -m "feat(chat): integrate chat tab into organizer negotiation detail page"
```

---

### Task 11: Integrate chat into service provider negotiation detail page

**Files:**
- Modify: `app/routes/service-provider/negotiations/$negotiationId.tsx`

- [ ] **Step 1: Add chat tab to the provider negotiation detail page**

Read the existing file first, then apply these changes surgically. The final result should look like:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { getNegotiation, respondToNegotiation, cancelNegotiation } from '~/server/fns/negotiations'
import { getChatStatus } from '~/server/fns/chat'
import { NegotiationThread } from '~/components/negotiations/NegotiationThread'
import { NegotiationActions } from '~/components/negotiations/NegotiationActions'
import { NegotiationStatusBadge } from '~/components/negotiations/NegotiationStatusBadge'
import { ChatTab } from '~/components/chat/ChatTab'
import { useSession } from '~/lib/auth-client'

export const Route = createFileRoute('/service-provider/negotiations/$negotiationId')({
  loader: async ({ params }) => {
    const negotiation = await getNegotiation({ data: { negotiationId: params.negotiationId } })
    let chatStatus: { status: 'active' | 'readonly' | 'locked' } = { status: 'locked' }
    try {
      chatStatus = await getChatStatus({ data: { negotiationId: params.negotiationId } })
    } catch {}
    return { negotiation, chatStatus }
  },
  component: ProviderNegotiationDetailPage,
})

function ProviderNegotiationDetailPage() {
  const { chatStatus: initialChatStatus } = Route.useLoaderData()
  const [negotiation, setNegotiation] = useState(Route.useLoaderData().negotiation)
  const [activeTab, setActiveTab] = useState<'negotiation' | 'chat'>('negotiation')
  const session = useSession()
  const userId = session.data?.user?.id ?? ''

  const isProvider = negotiation.providerId === userId
  const lastRound = negotiation.rounds?.[negotiation.rounds.length - 1]
  const isMyTurn = lastRound ? lastRound.senderId !== userId : negotiation.status === 'requested' && isProvider
  const isQuoteRequest = negotiation.status === 'requested' && isProvider
  const showChatTab = initialChatStatus.status !== 'locked'

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

      {showChatTab && (
        <div className="mb-6 flex border-b dark:border-gray-700">
          <button
            onClick={() => setActiveTab('negotiation')}
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'negotiation'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Negotiation
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 text-sm font-medium ${
              activeTab === 'chat'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chat
          </button>
        </div>
      )}

      {activeTab === 'negotiation' ? (
        <>
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
        </>
      ) : (
        <ChatTab negotiationId={negotiation.id} currentUserId={userId} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/routes/service-provider/negotiations/\$negotiationId.tsx
git commit -m "feat(chat): integrate chat tab into provider negotiation detail page"
```

---

### Task 12: Add unread badges to negotiation list pages

**Files:**
- Modify: `app/components/negotiations/NegotiationCard.tsx`
- Modify: `app/routes/organizer/negotiations/index.tsx`
- Modify: `app/routes/service-provider/negotiations/index.tsx`

- [ ] **Step 1: Add unreadCount prop to NegotiationCard**

In `app/components/negotiations/NegotiationCard.tsx`, add `unreadCount` to props and render the badge:

```tsx
// app/components/negotiations/NegotiationCard.tsx
import { Link } from '@tanstack/react-router'
import { NegotiationStatusBadge } from './NegotiationStatusBadge'
import { ChatUnreadBadge } from '~/components/chat/ChatUnreadBadge'

interface NegotiationCardProps {
  id: string
  status: string
  event: { id: string; title: string }
  service: { id: string; title: string }
  otherParty: { name: string; image: string | null }
  lastPrice: string | null
  updatedAt: string
  linkPrefix: string
  unreadCount?: number
}

export function NegotiationCard({
  id, status, event, service, otherParty, lastPrice, updatedAt, linkPrefix, unreadCount,
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
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{service.title}</h3>
            {unreadCount != null && unreadCount > 0 && <ChatUnreadBadge count={unreadCount} />}
          </div>
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
            <p className="mt-1 text-sm font-medium">{"\u20AC"}{Number(lastPrice).toFixed(2)}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">{timeAgo}</p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: Fetch unread counts in organizer negotiations list**

In `app/routes/organizer/negotiations/index.tsx`, add the import and fetch:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { listMyNegotiations } from '~/server/fns/negotiations'
import { getUnreadCounts } from '~/server/fns/chat'
import { NegotiationCard } from '~/components/negotiations/NegotiationCard'

export const Route = createFileRoute('/organizer/negotiations/')({
  component: OrganizerNegotiationsPage,
})

function OrganizerNegotiationsPage() {
  const [negotiations, setNegotiations] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    listMyNegotiations({ data: { status: statusFilter || undefined } }).then(setNegotiations)
  }, [statusFilter])

  useEffect(() => {
    getUnreadCounts().then(setUnreadCounts)
  }, [])

  const STATUSES = ['', 'requested', 'offered', 'countered', 'accepted', 'rejected', 'cancelled', 'expired']

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold">My Negotiations</h1>
      <div className="mb-4 flex flex-wrap gap-2">
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
            unreadCount={unreadCounts[n.id] ?? 0}
          />
        ))}
        {negotiations.length === 0 && <p className="text-gray-500">No negotiations yet.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Fetch unread counts in service provider negotiations list**

In `app/routes/service-provider/negotiations/index.tsx`, make these changes:

1. Add import: `import { getUnreadCounts } from '~/server/fns/chat'`
2. Add state: `const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})`
3. Add useEffect: `useEffect(() => { getUnreadCounts().then(setUnreadCounts) }, [])`
4. Add prop to NegotiationCard: `unreadCount={unreadCounts[n.id] ?? 0}`

The `otherParty` in the provider list is already `n.organizer` (correct).

- [ ] **Step 4: Commit**

```bash
git add app/components/negotiations/NegotiationCard.tsx app/routes/organizer/negotiations/index.tsx app/routes/service-provider/negotiations/index.tsx
git commit -m "feat(chat): add unread message badges to negotiation list pages"
```

---

### Task 13: Admin chat moderation page

**Files:**
- Create: `app/routes/admin/chat.tsx`

- [ ] **Step 1: Create the admin chat moderation page**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getFlaggedMessages, resolveFlag, getMessages } from '~/server/fns/chat'

export const Route = createFileRoute('/admin/chat')({
  component: AdminChatPage,
})

function AdminChatPage() {
  const [tab, setTab] = useState<'pending' | 'resolved'>('pending')
  const [data, setData] = useState<any>({ flags: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [viewingChat, setViewingChat] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<any[]>([])

  async function fetchFlags() {
    setLoading(true)
    try {
      const result = await getFlaggedMessages({ data: { status: tab } })
      setData(result)
    } catch (err) {
      console.error('Failed to fetch flagged messages:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchFlags() }, [tab])

  async function handleResolve(flagId: string, resolution: 'dismissed' | 'warned') {
    await resolveFlag({ data: { flagId, resolution } })
    fetchFlags()
  }

  async function handleViewChat(negotiationId: string) {
    setViewingChat(negotiationId)
    try {
      const result = await getMessages({ data: { negotiationId, limit: 100 } })
      setChatMessages(result.messages)
    } catch {
      setChatMessages([])
    }
  }

  const FLAG_TYPE_LABELS: Record<string, string> = {
    phone: 'Phone Number',
    email: 'Email Address',
    social: 'Social Handle',
    url: 'URL/Website',
    messaging_app: 'Messaging App',
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Chat Moderation</h1>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'pending' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          Flagged ({tab === 'pending' ? data.total : '...'})
        </button>
        <button
          onClick={() => setTab('resolved')}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
          }`}
        >
          Resolved
        </button>
      </div>

      {data.flags.length === 0 ? (
        <div className="rounded-lg border p-8 text-center dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400">
            {tab === 'pending' ? 'No flagged messages. All clear!' : 'No resolved flags yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.flags.map((f: any) => (
            <div key={f.id} className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 dark:border-amber-900 dark:bg-amber-950/20">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900 dark:text-red-300">
                      {FLAG_TYPE_LABELS[f.flagType] ?? f.flagType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(f.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="rounded border bg-white p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
                    <p className="text-gray-700 dark:text-gray-300">{f.message?.content}</p>
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Matched: &quot;{f.matchedContent}&quot;
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    <strong>{f.message?.sender?.name}</strong>
                    {' → '}
                    Negotiation: {f.message?.negotiation?.service?.title} · {f.message?.negotiation?.event?.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {f.message?.negotiation?.organizer?.name} ↔ {f.message?.negotiation?.provider?.name}
                  </p>
                  {f.resolution && (
                    <p className="mt-1 text-xs text-green-600">
                      Resolved: {f.resolution} by {f.resolvedByUser?.name}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    onClick={() => handleViewChat(f.message?.negotiationId)}
                    className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                  >
                    View Chat
                  </button>
                  {!f.resolvedAt && (
                    <>
                      <button
                        onClick={() => handleResolve(f.id, 'dismissed')}
                        className="rounded border border-green-300 px-3 py-1.5 text-xs text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleResolve(f.id, 'warned')}
                        className="rounded bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
                      >
                        Warn User
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Chat viewer modal */}
      {viewingChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setViewingChat(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Conversation</h3>
              <button onClick={() => setViewingChat(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="space-y-3">
              {chatMessages.map((msg: any) => (
                <div key={msg.id} className="rounded border p-3 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium">{msg.sender?.name}</span>
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{msg.content}</p>
                </div>
              ))}
              {chatMessages.length === 0 && <p className="text-gray-400 text-sm">No messages in this conversation.</p>}
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
git add app/routes/admin/chat.tsx
git commit -m "feat(chat): add admin chat moderation page with flagged message queue"
```

---

### Task 14: Route tree regeneration + build

- [ ] **Step 1: Delete the route tree to force regeneration**

```bash
rm app/routeTree.gen.ts
```

- [ ] **Step 2: Build to verify everything compiles**

```bash
npx vinxi build
```

Expected: Exit code 0. New route tree generated with `/admin/chat` and `/api/chat-stream` routes. All chat-related chunks appear in the build output.

- [ ] **Step 3: Commit the regenerated route tree**

```bash
git add app/routeTree.gen.ts
git commit -m "chore: regenerate route tree with chat routes"
```

---

### Task 15: Apply migration

- [ ] **Step 1: Push the migration to the database**

```bash
npx drizzle-kit push
```

Expected: Tables `messages`, `message_flags`, `message_read_receipts` created.
