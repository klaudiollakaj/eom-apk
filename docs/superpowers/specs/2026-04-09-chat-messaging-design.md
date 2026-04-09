# Chat/Messaging Design Spec

## Goal

Add real-time text messaging to negotiations so organizers and service providers can communicate freely during deal-making, with silent content filtering to detect attempts to exchange contact information off-platform.

## Scope

- **In scope:** Negotiation-scoped chat, SSE real-time delivery, two-layer content filter, admin monitoring, read receipts, read-only mode for closed negotiations
- **Out of scope:** File attachments, group chat, direct messaging outside negotiations, push notifications (mobile), end-to-end encryption, typing indicators

## Architecture

Chat is embedded as a tab within the existing negotiation detail page. Each negotiation has exactly one chat thread. Messages are delivered in near-real-time via Server-Sent Events (SSE), with POST for sending and polling as fallback.

Every outbound message passes through a two-layer content filter before storage. Flagged messages are stored and delivered normally (user never knows), but a `message_flags` record is created for admin review.

### Real-Time Delivery

- **Send:** `POST` via `createServerFn` — standard TanStack Start server function
- **Receive:** SSE endpoint streams new messages to connected clients
- **Fallback:** Client polls every 5 seconds if SSE connection drops; polling stops once SSE reconnects
- **Reconnection:** SSE auto-reconnects with exponential backoff (1s → 2s → 4s, capped at 30s), using `Last-Event-ID` header to avoid missed messages
- **Keepalive:** SSE sends a heartbeat comment (`: keepalive`) every 30 seconds to prevent Railway from closing idle connections

## Data Model

### `messages` table

| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| negotiationId | text (FK → negotiations) | NOT NULL, onDelete: cascade |
| senderId | text (FK → users) | NOT NULL, onDelete: restrict |
| content | text | NOT NULL, max 2000 chars (validated in sendMessage) |
| createdAt | timestamp | NOT NULL, DEFAULT now() |

- Index on `(negotiationId, createdAt)` for efficient thread loading
- No `updatedAt` — messages are immutable once sent

### `message_flags` table

| Column | Type | Notes |
|--------|------|-------|
| id | text (UUID) | PK |
| messageId | text (FK → messages) | NOT NULL, onDelete: cascade |
| flagType | text | 'phone', 'email', 'social', 'url', 'messaging_app' |
| matchedContent | text | The exact substring that triggered the flag |
| resolvedAt | timestamp | NULL until admin acts |
| resolvedBy | text (FK → users, nullable) | Admin who resolved, NULL when unresolved |
| resolution | text | 'dismissed', 'warned', NULL when unresolved |
| createdAt | timestamp | NOT NULL, DEFAULT now() |

### `message_read_receipts` table

| Column | Type | Notes |
|--------|------|-------|
| negotiationId | text (FK → negotiations) | Composite PK part 1, onDelete: cascade |
| userId | text (FK → users) | Composite PK part 2 |
| lastReadAt | timestamp | NOT NULL |
| lastReadMessageId | text (FK → messages) | NOT NULL |

- Composite primary key on `(negotiationId, userId)` — no separate UUID needed
- Updated (upsert) each time the user opens/scrolls the chat

### Indexes

- `messages(negotiationId, createdAt)` — thread loading
- `message_flags(messageId)` — join from flags to messages
- `message_flags(resolvedAt)` — filtering pending vs resolved flags

### Relations

```
messages → negotiation (many-to-one)
messages → sender/user (many-to-one)
messages → messageFlags (one-to-many)
messageFlags → message (many-to-one)
messageFlags → resolvedByUser (many-to-one)
messageReadReceipts → negotiation (many-to-one)
messageReadReceipts → user (many-to-one)
messageReadReceipts → lastReadMessage (many-to-one)
```

## Chat Access Rules

### Who can access chat

Both parties of a negotiation (organizer + provider) can access the chat tab, provided:

1. **Email verified** — unverified accounts cannot send messages
2. **Account not suspended/banned** — suspended or banned users see chat as read-only
3. **Mutual engagement** — Chat unlocks only after the negotiation has at least 2 rounds in `negotiation_rounds` where both parties have sent at least one round each. A `requestQuote` action does not create a round — the provider's first `offer` is round 1, and the organizer's `counter` is round 2. This prevents users from creating dummy negotiations just to access chat.

### When chat is active vs read-only

| Negotiation Status | Chat State |
|---|---|
| `requested` | Locked (no chat tab visible) |
| `offered` (1 round only) | Locked (waiting for counterparty response) |
| `offered` / `countered` (2+ rounds) | **Active** — can send messages |
| `accepted` | **Active** until event `endDate` (or `startDate` if no `endDate`), then permanently read-only |
| `rejected` / `cancelled` | **Read-only** immediately |
| `expired` | **Read-only** immediately |

For **accepted** negotiations: chat remains active until the event's `endDate` passes (falls back to `startDate` if no `endDate`), allowing logistics coordination. `getChatStatus` joins `negotiations → events` to read the date. After the event date, it becomes read-only.

### Rate limiting

- Maximum 30 messages per hour per user per negotiation
- Prevents spam and harassment

## Content Filter

### Two-Layer Architecture

Every message passes through both layers before being stored:

**Layer 1 — Regex (fast pattern matching):**
- Phone numbers: international formats, local formats, spaced digits (`+355 69 123 4567`, `069-234-5678`, `0 6 9 2 3 4`)
- Email addresses: standard email regex
- URLs: `http(s)://`, `www.`, `.com/.net/.org/etc`
- Social handles: `@username` patterns
- App name references: WhatsApp, Telegram, Signal, Viber, Messenger, Instagram DM, etc.

**Layer 2 — Normalization (evasion detection):**

Before running regex, normalize the message:

1. **Spelled-out numbers → digits (English + Albanian):**
   - English: `one` → `1`, `two` → `2`, ..., `nine` → `9`, `zero` → `0`
   - Albanian: `nje` → `1`, `dy` → `2`, `tre` → `3`, `kater` → `4`, `pese` → `5`, `gjashte` → `6`, `shtate` → `7`, `tete` → `8`, `nente` → `9`, `zero` → `0`
2. **Concatenated spelled numbers:** `sixnine` → `69`, `njedy` → `12`, `onetwothree` → `123`
3. **Strip separators between single chars:** `0 6 9 2 3 4` → `069234`
4. **Common letter substitutions:** `O/o` → `0`, `l/I` → `1`, `S/s` → `5`, `B` → `8`
5. **Run phone/email regex on normalized string**

This catches most evasion tricks. False positives are acceptable since flagging is silent — admin simply dismisses false positives.

### Filter Output

- Message is **always delivered** to the recipient (user never knows about flagging)
- If any pattern matches, a `message_flags` record is created with:
  - `flagType`: which category triggered
  - `matchedContent`: the exact substring that matched

## Server Functions

### Chat Functions (`app/server/fns/chat.ts`)

| Function | Method | Access | Description |
|----------|--------|--------|-------------|
| `sendMessage` | POST | negotiation party | Validate access, run content filter, store message, return message |
| `getMessages` | GET | negotiation party | Paginated messages for a negotiation (newest first, with cursor) |
| `markAsRead` | POST | negotiation party | Upsert read receipt for current user |
| `getUnreadCounts` | GET | authenticated | Unread message counts across all user's negotiations |
| `getChatStatus` | GET | negotiation party | Returns whether chat is active/locked/read-only for this negotiation |

### Admin Functions (add to `app/server/fns/chat.ts`)

| Function | Method | Access | Description |
|----------|--------|--------|-------------|
| `getFlaggedMessages` | GET | admin:chat:moderate | Paginated flagged messages, filterable by status (pending/resolved) |
| `resolveFlag` | POST | admin:chat:moderate | Dismiss or warn — sets resolvedAt, resolvedBy, resolution |
| `getMessages` (admin override) | GET | admin:chat:moderate | Same `getMessages` function but skips party-access check when caller has admin capability |

### SSE Endpoint (`app/routes/api/chat-stream.ts`)

A `createServerFileRoute` API route that:
1. Validates auth + negotiation access via query params (`?negotiationId=...`)
2. Returns a `Response` with `ReadableStream` and `Content-Type: text/event-stream` headers
3. Polls the database every 3 seconds for new messages in that negotiation
4. Streams new messages as SSE events with message ID as event ID
5. Sends `: keepalive` comment every 30 seconds to prevent Railway connection timeout
6. Supports `Last-Event-ID` header for reconnection (resumes from that message ID)

Implementation: Use `createServerFileRoute` with `methods({ GET })` returning a `new Response(readableStream, { headers })`. This matches the existing API route pattern in `app/routes/api/auth.$.ts`.

## UI Components

### `ChatThread` (`app/components/chat/ChatThread.tsx`)
- Scrollable message list with date separators
- Messages: bubble style, right-aligned (self) in indigo, left-aligned (other) in white/gray
- Avatar initials, sender name, timestamp
- "Read" indicator on own messages when recipient has seen them
- Auto-scroll to bottom on new messages
- "Load older messages" button at top (cursor-based pagination)

### `ChatInput` (`app/components/chat/ChatInput.tsx`)
- Text input with send button
- Disabled state with explanation banner for read-only/locked
- Enter to send, Shift+Enter for newline
- Rate limit feedback ("Slow down — too many messages")

### `ChatTab` (`app/components/chat/ChatTab.tsx`)
- Tab component for negotiation detail page
- Shows unread count badge
- Handles chat status (locked/active/read-only) display

### `ChatUnreadBadge` (`app/components/chat/ChatUnreadBadge.tsx`)
- Small badge component used on negotiation list cards
- Shows unread count per negotiation

## Page Integrations

### Negotiation Detail Pages
- **`/organizer/negotiations/$negotiationId`** — Add Chat tab alongside existing Negotiation tab
- **`/service-provider/negotiations/$negotiationId`** — Same Chat tab

Both pages:
1. Check `getChatStatus` to determine tab visibility and state
2. If chat is locked (< 2 rounds), no Chat tab shown
3. If active, show Chat tab with unread badge + full ChatThread + ChatInput
4. If read-only, show Chat tab with ChatThread + disabled input banner

### Negotiation List Pages
- **`/organizer/negotiations/`** — Show unread badge on each negotiation card
- **`/service-provider/negotiations/`** — Same

### Admin
- **`/admin/chat`** — New route with Flagged/All Conversations/Resolved tabs
- Add to AdminSidebar with `admin:chat:moderate` capability
- Add capability to `VALID_CAPABILITY_PREFIXES` and admin route `capList`

## Capability

- `admin:chat:moderate` — view all conversations, resolve flagged messages

## Migration

Use `drizzle-kit generate` to create the migration (auto-named `0005_*.sql`):
- Create `messages` table with index on `(negotiation_id, created_at)`
- Create `message_flags` table with indexes on `message_id` and `resolved_at`
- Create `message_read_receipts` table with composite PK `(negotiation_id, user_id)`
