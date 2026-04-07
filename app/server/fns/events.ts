import { createServerFn } from '@tanstack/react-start'
import {
  eq, and, or, asc, desc, ilike, gte, lte, inArray, count, sql,
} from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  events, eventImages, eventTags, tags, categories, users, userLogs,
  publishingPermissions, navigationLinks,
} from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import { isAdmin, type Role } from '~/lib/permissions'
import { findOrCreateTag } from './tags'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '~/lib/r2'
import DOMPurify from 'isomorphic-dompurify'

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ['script', 'iframe', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
  })
}

function activeOrganizerIds() {
  return db.select({ id: users.id }).from(users).where(eq(users.isActive, true))
}

// ==================== PUBLIC QUERIES ====================

export const listPublicEvents = createServerFn({ method: 'GET' })
  .validator((input: {
    categoryId?: string
    startAfter?: string
    startBefore?: string
    priceFilter?: 'free' | 'paid'
    search?: string
    tagIds?: string[]
    offset?: number
    limit?: number
  }) => input)
  .handler(async ({ data }) => {
    const limit = data.limit ?? 12
    const offset = data.offset ?? 0

    const conditions: any[] = [
      eq(events.status, 'published'),
      eq(events.visibility, 'public'),
      inArray(events.organizerId, activeOrganizerIds()),
    ]

    if (data.categoryId) conditions.push(eq(events.categoryId, data.categoryId))
    if (data.startAfter) conditions.push(gte(events.startDate, new Date(data.startAfter)))
    if (data.startBefore) conditions.push(lte(events.startDate, new Date(data.startBefore)))
    if (data.priceFilter === 'free') conditions.push(sql`(${events.price} IS NULL OR ${events.price} = 0)`)
    if (data.priceFilter === 'paid') conditions.push(sql`(${events.price} IS NOT NULL AND ${events.price} > 0)`)
    if (data.search) conditions.push(ilike(events.title, `%${data.search}%`))

    const where = and(...conditions)

    const [rows, [total]] = await Promise.all([
      db.query.events.findMany({
        where,
        orderBy: [asc(events.startDate)],
        limit,
        offset,
        with: {
          category: true,
          organizer: { columns: { id: true, name: true, image: true } },
          tags: { with: { tag: true } },
        },
      }),
      db.select({ count: count() }).from(events).where(where),
    ])

    let filtered = rows
    if (data.tagIds && data.tagIds.length > 0) {
      filtered = rows.filter((e) =>
        e.tags.some((et) => data.tagIds!.includes(et.tag.id))
      )
    }

    return { events: filtered, total: total.count }
  })

export const getFeaturedEvents = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.query.events.findMany({
      where: and(
        eq(events.status, 'published'),
        eq(events.visibility, 'public'),
        eq(events.isFeatured, true),
        inArray(events.organizerId, activeOrganizerIds()),
      ),
      orderBy: [asc(events.startDate)],
      limit: 6,
      with: {
        category: true,
        organizer: { columns: { id: true, name: true, image: true } },
      },
    })
  },
)

export const getLatestEvents = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.query.events.findMany({
      where: and(
        eq(events.status, 'published'),
        eq(events.visibility, 'public'),
        eq(events.isFeatured, false),
        inArray(events.organizerId, activeOrganizerIds()),
      ),
      orderBy: [desc(events.createdAt)],
      limit: 6,
      with: {
        category: true,
        organizer: { columns: { id: true, name: true, image: true } },
      },
    })
  },
)

export const getEvent = createServerFn({ method: 'GET' })
  .validator((input: { eventId: string }) => input)
  .handler(async ({ data }) => {
    const event = await db.query.events.findFirst({
      where: eq(events.id, data.eventId),
      with: {
        category: true,
        organizer: { columns: { id: true, name: true, image: true, isActive: true } },
        images: { orderBy: [asc(eventImages.sortOrder)] },
        tags: { with: { tag: true } },
      },
    })

    if (!event) throw new Error('NOT_FOUND')

    let session = null
    try { session = await requireAuth() } catch {}

    const isOwner = session?.user.id === event.organizerId
    const isAdminUser = session ? isAdmin(session.user.role as Role) : false

    if (!event.organizer.isActive && !isAdminUser) throw new Error('NOT_FOUND')
    if (event.status !== 'published' && !isOwner && !isAdminUser) throw new Error('NOT_FOUND')

    return event
  })

// ==================== ORGANIZER OPERATIONS ====================

export const listOrganizerEvents = createServerFn({ method: 'GET' })
  .validator((input: { status?: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const conditions: any[] = [eq(events.organizerId, session.user.id)]
    if (data.status) conditions.push(eq(events.status, data.status))

    return db.query.events.findMany({
      where: and(...conditions),
      orderBy: [desc(events.updatedAt)],
      with: {
        category: true,
        tags: { with: { tag: true } },
      },
    })
  })

export const createEvent = createServerFn({ method: 'POST' })
  .validator((input: {
    title: string
    description: string
    categoryId?: string
    type: 'single_day' | 'multi_day'
    startDate: string
    endDate?: string
    startTime?: string
    endTime?: string
    venueName?: string
    address?: string
    city?: string
    country?: string
    onlineUrl?: string
    bannerImage?: string
    price?: string
    capacity?: number
    visibility?: 'public' | 'unlisted'
    ageRestriction?: string
    contactEmail?: string
    contactPhone?: string
    tagNames?: string[]
    galleryImages?: { imageUrl: string; caption?: string; sortOrder: number }[]
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    })
    if (user?.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const sanitizedDescription = sanitizeHtml(data.description)

    const [event] = await db.insert(events).values({
      organizerId: session.user.id,
      title: data.title,
      description: sanitizedDescription,
      categoryId: data.categoryId || null,
      type: data.type,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      venueName: data.venueName || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      onlineUrl: data.onlineUrl || null,
      bannerImage: data.bannerImage || null,
      price: data.price || null,
      capacity: data.capacity || null,
      visibility: data.visibility ?? 'public',
      ageRestriction: data.ageRestriction || null,
      contactEmail: data.contactEmail || null,
      contactPhone: data.contactPhone || null,
      status: 'draft',
    }).returning()

    if (data.tagNames && data.tagNames.length > 0) {
      for (const name of data.tagNames) {
        const tagId = await findOrCreateTag(name)
        await db.insert(eventTags).values({ eventId: event.id, tagId })
      }
    }

    if (data.galleryImages && data.galleryImages.length > 0) {
      await db.insert(eventImages).values(
        data.galleryImages.map((img) => ({
          eventId: event.id,
          imageUrl: img.imageUrl,
          caption: img.caption || null,
          sortOrder: img.sortOrder,
        })),
      )
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'event_created',
      details: { eventId: event.id, title: data.title },
    })

    return event
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    title?: string
    description?: string
    categoryId?: string
    type?: 'single_day' | 'multi_day'
    startDate?: string
    endDate?: string
    startTime?: string
    endTime?: string
    venueName?: string
    address?: string
    city?: string
    country?: string
    onlineUrl?: string
    bannerImage?: string
    price?: string
    capacity?: number
    visibility?: 'public' | 'unlisted'
    ageRestriction?: string
    contactEmail?: string
    contactPhone?: string
    tagNames?: string[]
    galleryImages?: { imageUrl: string; caption?: string; sortOrder: number }[]
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    })
    if (user?.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const existing = await db.query.events.findFirst({
      where: eq(events.id, data.id),
    })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.organizerId !== session.user.id) throw new Error('FORBIDDEN')

    const { id, tagNames, galleryImages, ...updates } = data
    const values: Record<string, unknown> = { updatedAt: new Date() }

    if (updates.description) values.description = sanitizeHtml(updates.description)
    if (updates.title !== undefined) values.title = updates.title
    if (updates.categoryId !== undefined) values.categoryId = updates.categoryId || null
    if (updates.type !== undefined) values.type = updates.type
    if (updates.startDate !== undefined) values.startDate = new Date(updates.startDate)
    if (updates.endDate !== undefined) values.endDate = updates.endDate ? new Date(updates.endDate) : null
    if (updates.startTime !== undefined) values.startTime = updates.startTime || null
    if (updates.endTime !== undefined) values.endTime = updates.endTime || null
    if (updates.venueName !== undefined) values.venueName = updates.venueName || null
    if (updates.address !== undefined) values.address = updates.address || null
    if (updates.city !== undefined) values.city = updates.city || null
    if (updates.country !== undefined) values.country = updates.country || null
    if (updates.onlineUrl !== undefined) values.onlineUrl = updates.onlineUrl || null
    if (updates.bannerImage !== undefined) values.bannerImage = updates.bannerImage || null
    if (updates.price !== undefined) values.price = updates.price || null
    if (updates.capacity !== undefined) values.capacity = updates.capacity || null
    if (updates.visibility !== undefined) values.visibility = updates.visibility
    if (updates.ageRestriction !== undefined) values.ageRestriction = updates.ageRestriction || null
    if (updates.contactEmail !== undefined) values.contactEmail = updates.contactEmail || null
    if (updates.contactPhone !== undefined) values.contactPhone = updates.contactPhone || null

    const [event] = await db
      .update(events)
      .set(values)
      .where(eq(events.id, id))
      .returning()

    if (tagNames !== undefined) {
      await db.delete(eventTags).where(eq(eventTags.eventId, id))
      for (const name of tagNames) {
        const tagId = await findOrCreateTag(name)
        await db.insert(eventTags).values({ eventId: id, tagId })
      }
    }

    if (galleryImages !== undefined) {
      await db.delete(eventImages).where(eq(eventImages.eventId, id))
      if (galleryImages.length > 0) {
        await db.insert(eventImages).values(
          galleryImages.map((img) => ({
            eventId: id,
            imageUrl: img.imageUrl,
            caption: img.caption || null,
            sortOrder: img.sortOrder,
          })),
        )
      }
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'event_updated',
      details: { eventId: id },
    })

    return event
  })

export const publishEvent = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    })
    if (user?.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.id),
    })
    if (!event) throw new Error('NOT_FOUND')
    if (event.organizerId !== session.user.id) throw new Error('FORBIDDEN')
    if (event.status !== 'draft') throw new Error('INVALID_STATUS')

    const eventsNavLink = await db.query.navigationLinks.findFirst({
      where: eq(navigationLinks.url, '/events'),
    })
    if (eventsNavLink?.isPublishable) {
      const permission = await db.query.publishingPermissions.findFirst({
        where: and(
          eq(publishingPermissions.role, session.user.role),
          eq(publishingPermissions.targetPage, '/events'),
          eq(publishingPermissions.canPublish, true),
        ),
      })
      if (!permission) throw new Error('PUBLISHING_NOT_ALLOWED')
    }

    const [updated] = await db
      .update(events)
      .set({ status: 'published', updatedAt: new Date() })
      .where(eq(events.id, data.id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'event_published',
      details: { eventId: data.id, title: event.title },
    })

    return updated
  })

export const cancelEvent = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.id),
    })
    if (!event) throw new Error('NOT_FOUND')

    const isOwner = event.organizerId === session.user.id
    const isAdminUser = isAdmin(session.user.role as Role)
    if (!isOwner && !isAdminUser) throw new Error('FORBIDDEN')
    if (event.status !== 'published') throw new Error('INVALID_STATUS')

    const [updated] = await db
      .update(events)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(events.id, data.id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'event_cancelled',
      details: { eventId: data.id, title: event.title },
    })

    return updated
  })

export const archiveEvent = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.id),
    })
    if (!event) throw new Error('NOT_FOUND')

    const isOwner = event.organizerId === session.user.id
    const isAdminUser = isAdmin(session.user.role as Role)
    if (!isOwner && !isAdminUser) throw new Error('FORBIDDEN')
    if (event.status !== 'published' && event.status !== 'cancelled') throw new Error('INVALID_STATUS')

    const [updated] = await db
      .update(events)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(events.id, data.id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'event_archived',
      details: { eventId: data.id, title: event.title },
    })

    return updated
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.id),
      with: { images: true },
    })
    if (!event) throw new Error('NOT_FOUND')
    if (event.organizerId !== session.user.id) throw new Error('FORBIDDEN')
    if (event.status !== 'draft') throw new Error('ONLY_DRAFT_DELETABLE')

    const allImageUrls = [
      ...(event.bannerImage ? [event.bannerImage] : []),
      ...event.images.map((img) => img.imageUrl),
    ]
    for (const url of allImageUrls) {
      const key = url.replace(`${R2_PUBLIC_URL}/`, '')
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      } catch {}
    }

    await db.delete(events).where(eq(events.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'event_deleted',
      details: { eventId: data.id, title: event.title },
    })
  })

export const toggleFeatured = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:events:manage')

    const event = await db.query.events.findFirst({
      where: eq(events.id, data.id),
    })
    if (!event) throw new Error('NOT_FOUND')

    const [updated] = await db
      .update(events)
      .set({ isFeatured: !event.isFeatured, updatedAt: new Date() })
      .where(eq(events.id, data.id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: updated.isFeatured ? 'event_featured' : 'event_unfeatured',
      details: { eventId: data.id, title: event.title },
    })

    return updated
  })

// ==================== ADMIN ====================

export const listAllEvents = createServerFn({ method: 'GET' })
  .validator((input: {
    status?: string
    categoryId?: string
    search?: string
    offset?: number
    limit?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:events:manage')

    const limit = data.limit ?? 20
    const offset = data.offset ?? 0
    const conditions: any[] = []

    if (data.status) conditions.push(eq(events.status, data.status))
    if (data.categoryId) conditions.push(eq(events.categoryId, data.categoryId))
    if (data.search) conditions.push(ilike(events.title, `%${data.search}%`))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, [total]] = await Promise.all([
      db.query.events.findMany({
        where,
        orderBy: [desc(events.updatedAt)],
        limit,
        offset,
        with: {
          category: true,
          organizer: { columns: { id: true, name: true } },
        },
      }),
      db.select({ count: count() }).from(events).where(where),
    ])

    return { events: rows, total: total.count }
  })
