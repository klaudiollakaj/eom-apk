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
import { relations } from 'drizzle-orm'

// ============================================================
// Auth Tables (managed by Better Auth)
// ============================================================

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  isSuspended: boolean('is_suspended').notNull().default(false),
  banned: boolean('banned').default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// ============================================================
// Domain Tables
// ============================================================

export const userProfiles = pgTable('user_profiles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  phone: text('phone'),
  bio: text('bio'),
  dateOfBirth: date('date_of_birth'),
  location: text('location'),
  avatarUrl: text('avatar_url'),
  companyName: text('company_name'),
  nipt: text('nipt'),
  qkb: text('qkb'),
  operatingField: text('operating_field'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const userLogs = pgTable('user_logs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const navigationLinks = pgTable('navigation_links', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  label: text('label').notNull(),
  url: text('url').notNull(),
  position: text('position').notNull(), // 'header' | 'footer' | 'both'
  sortOrder: integer('sort_order').notNull(),
  isVisible: boolean('is_visible').notNull().default(true),
  isExternal: boolean('is_external').notNull().default(false),
  isDeletable: boolean('is_deletable').notNull().default(true),
  isPublishable: boolean('is_publishable').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const publishingPermissions = pgTable(
  'publishing_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    role: text('role').notNull(),
    targetPage: text('target_page').notNull(),
    canPublish: boolean('can_publish').notNull().default(true),
    grantedBy: text('granted_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.role, table.targetPage)],
)

export const userCapabilities = pgTable(
  'user_capabilities',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    capability: text('capability').notNull(),
    granted: boolean('granted').notNull().default(true),
    grantedBy: text('granted_by').references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [unique().on(table.userId, table.capability)],
)

// ============================================================
// Phase 2: Event Tables
// ============================================================

export const categories = pgTable('categories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const events = pgTable('events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizerId: text('organizer_id').notNull().references(() => users.id),
  categoryId: text('category_id').references(() => categories.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  type: text('type').notNull().default('single_day'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  venueName: text('venue_name'),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  onlineUrl: text('online_url'),
  bannerImage: text('banner_image'),
  price: numeric('price', { precision: 10, scale: 2 }),
  capacity: integer('capacity'),
  status: text('status').notNull().default('draft'),
  visibility: text('visibility').notNull().default('public'),
  isFeatured: boolean('is_featured').notNull().default(false),
  ageRestriction: text('age_restriction'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const eventImages = pgTable('event_images', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tags = pgTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
})

export const eventTags = pgTable('event_tags', {
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => [
  primaryKey({ columns: [table.eventId, table.tagId] }),
])

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

export const serviceImages = pgTable('service_images', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  serviceId: text('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

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

// ============================================================
// Relations
// ============================================================

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  sessions: many(sessions),
  accounts: many(accounts),
  logs: many(userLogs),
  capabilities: many(userCapabilities),
  events: many(events),
  services: many(services),
  reviewsAsReviewer: many(reviews, { relationName: 'reviewer' }),
  reviewsAsReviewee: many(reviews, { relationName: 'reviewee' }),
  sentMessages: many(messages),
  orders: many(orders),
  tickets: many(tickets, { relationName: 'ticketOwner' }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}))

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}))

export const userLogsRelations = relations(userLogs, ({ one }) => ({
  user: one(users, {
    fields: [userLogs.userId],
    references: [users.id],
  }),
}))

export const userCapabilitiesRelations = relations(
  userCapabilities,
  ({ one }) => ({
    user: one(users, {
      fields: [userCapabilities.userId],
      references: [users.id],
    }),
  }),
)

export const categoriesRelations = relations(categories, ({ many }) => ({
  events: many(events),
}))

export const eventsRelations = relations(events, ({ one, many }) => ({
  organizer: one(users, { fields: [events.organizerId], references: [users.id] }),
  category: one(categories, { fields: [events.categoryId], references: [categories.id] }),
  images: many(eventImages),
  tags: many(eventTags),
  negotiations: many(negotiations),
  eventServices: many(eventServices),
  ticketTiers: many(ticketTiers),
  tickets: many(tickets),
  eventReviews: many(eventReviews),
}))

export const eventImagesRelations = relations(eventImages, ({ one }) => ({
  event: one(events, { fields: [eventImages.eventId], references: [events.id] }),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  events: many(eventTags),
}))

export const eventTagsRelations = relations(eventTags, ({ one }) => ({
  event: one(events, { fields: [eventTags.eventId], references: [events.id] }),
  tag: one(tags, { fields: [eventTags.tagId], references: [tags.id] }),
}))

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
  messages: many(messages),
  eventService: one(eventServices),
}))

export const negotiationRoundsRelations = relations(negotiationRounds, ({ one }) => ({
  negotiation: one(negotiations, { fields: [negotiationRounds.negotiationId], references: [negotiations.id] }),
  sender: one(users, { fields: [negotiationRounds.senderId], references: [users.id] }),
}))

export const eventServicesRelations = relations(eventServices, ({ one, many }) => ({
  event: one(events, { fields: [eventServices.eventId], references: [events.id] }),
  service: one(services, { fields: [eventServices.serviceId], references: [services.id] }),
  negotiation: one(negotiations, { fields: [eventServices.negotiationId], references: [negotiations.id] }),
  provider: one(users, { fields: [eventServices.providerId], references: [users.id] }),
  reviews: many(reviews),
}))

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

export const reviewsRelations = relations(reviews, ({ one }) => ({
  eventService: one(eventServices, { fields: [reviews.eventServiceId], references: [eventServices.id] }),
  reviewer: one(users, { fields: [reviews.reviewerId], references: [users.id], relationName: 'reviewer' }),
  reviewee: one(users, { fields: [reviews.revieweeId], references: [users.id], relationName: 'reviewee' }),
}))

// ── Attendee → Event reviews (gated by checked-in ticket) ──

export const eventReviews = pgTable('event_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  isVisible: boolean('is_visible').notNull().default(true),
  reportedAt: timestamp('reported_at'),
  reportReason: text('report_reason'),
  moderatedAt: timestamp('moderated_at'),
  moderationAction: text('moderation_action'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  unique().on(table.eventId, table.userId),
  index('event_reviews_event_idx').on(table.eventId),
])

export const eventReviewsRelations = relations(eventReviews, ({ one }) => ({
  event: one(events, { fields: [eventReviews.eventId], references: [events.id] }),
  user: one(users, { fields: [eventReviews.userId], references: [users.id] }),
}))

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

// ============================================================
// Ticketing
// ============================================================

export const ticketTiers = pgTable('ticket_tiers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  quantityTotal: integer('quantity_total').notNull(),
  quantitySold: integer('quantity_sold').notNull().default(0),
  salesStartAt: timestamp('sales_start_at'),
  salesEndAt: timestamp('sales_end_at'),
  maxPerUser: integer('max_per_user').notNull().default(10),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('ticket_tiers_event_idx').on(table.eventId),
])

export const orders = pgTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderNumber: text('order_number').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id),
  eventId: text('event_id').notNull().references(() => events.id),
  subtotalCents: integer('subtotal_cents').notNull(),
  totalCents: integer('total_cents').notNull(),
  status: text('status').notNull().default('pending'),
  paymentMethod: text('payment_method').notNull().default('mock'),
  paymentRef: text('payment_ref'),
  paidAt: timestamp('paid_at'),
  refundedAt: timestamp('refunded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('orders_user_created_idx').on(table.userId, table.createdAt),
  index('orders_event_idx').on(table.eventId),
])

export const tickets = pgTable('tickets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
  tierId: text('tier_id').notNull().references(() => ticketTiers.id, { onDelete: 'restrict' }),
  eventId: text('event_id').notNull().references(() => events.id),
  ownerId: text('owner_id').notNull().references(() => users.id),
  status: text('status').notNull().default('valid'),
  qrCode: text('qr_code').notNull(),
  checkedInAt: timestamp('checked_in_at'),
  checkedInBy: text('checked_in_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('tickets_owner_idx').on(table.ownerId),
  index('tickets_event_status_idx').on(table.eventId, table.status),
])

export const ticketTransfers = pgTable('ticket_transfers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticketId: text('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  fromUserId: text('from_user_id').notNull().references(() => users.id),
  toUserId: text('to_user_id').notNull().references(() => users.id),
  transferredAt: timestamp('transferred_at').notNull().defaultNow(),
  note: text('note'),
}, (table) => [
  index('ticket_transfers_ticket_idx').on(table.ticketId),
])

export const refunds = pgTable('refunds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id),
  ticketIds: jsonb('ticket_ids').notNull(),
  amountCents: integer('amount_cents').notNull(),
  reason: text('reason'),
  requestedBy: text('requested_by').notNull().references(() => users.id),
  approvedBy: text('approved_by').references(() => users.id),
  status: text('status').notNull().default('approved'),
  refundedAt: timestamp('refunded_at').notNull().defaultNow(),
}, (table) => [
  index('refunds_order_idx').on(table.orderId),
])

export const ticketTiersRelations = relations(ticketTiers, ({ one, many }) => ({
  event: one(events, { fields: [ticketTiers.eventId], references: [events.id] }),
  tickets: many(tickets),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  event: one(events, { fields: [orders.eventId], references: [events.id] }),
  tickets: many(tickets),
  refunds: many(refunds),
}))

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  order: one(orders, { fields: [tickets.orderId], references: [orders.id] }),
  tier: one(ticketTiers, { fields: [tickets.tierId], references: [ticketTiers.id] }),
  event: one(events, { fields: [tickets.eventId], references: [events.id] }),
  owner: one(users, { fields: [tickets.ownerId], references: [users.id], relationName: 'ticketOwner' }),
  checkedInByUser: one(users, { fields: [tickets.checkedInBy], references: [users.id], relationName: 'ticketCheckedInBy' }),
  transfers: many(ticketTransfers),
}))

export const ticketTransfersRelations = relations(ticketTransfers, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketTransfers.ticketId], references: [tickets.id] }),
  fromUser: one(users, { fields: [ticketTransfers.fromUserId], references: [users.id], relationName: 'transferFrom' }),
  toUser: one(users, { fields: [ticketTransfers.toUserId], references: [users.id], relationName: 'transferTo' }),
}))

export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
  requestedByUser: one(users, { fields: [refunds.requestedBy], references: [users.id], relationName: 'refundRequestedBy' }),
  approvedByUser: one(users, { fields: [refunds.approvedBy], references: [users.id], relationName: 'refundApprovedBy' }),
}))

// ============================================================
// Singular aliases for Better Auth's Drizzle adapter
// (it looks up schema[modelName] using singular names)
// ============================================================
export {
  users as user,
  sessions as session,
  accounts as account,
  verifications as verification,
}
