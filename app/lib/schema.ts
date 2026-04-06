import {
  pgTable,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  date,
  unique,
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
