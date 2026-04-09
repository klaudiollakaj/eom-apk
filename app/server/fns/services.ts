// app/server/fns/services.ts
import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc, desc, ilike, or, sql, avg, count } from 'drizzle-orm'
import { db } from '~/lib/db'
import {
  services, servicePackages, serviceImages, serviceCategories,
  negotiations, users, userLogs, reviews,
} from '~/lib/schema'
import { requireAuth } from '~/server/fns/auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import DOMPurify from 'isomorphic-dompurify'

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html)
}

// ── Provider: Create service ──
export const createService = createServerFn({ method: 'POST' })
  .validator((input: {
    categoryId: string
    title: string
    description?: string
    city?: string
    country?: string
    bannerImage?: string
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    if (session.user.role !== 'service_provider' && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }
    if (session.user.isSuspended) throw new Error('ACCOUNT_SUSPENDED')

    const [service] = await db.insert(services).values({
      providerId: session.user.id,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description ? sanitizeHtml(data.description) : null,
      city: data.city || null,
      country: data.country || null,
      bannerImage: data.bannerImage || null,
    }).returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_created',
      details: { serviceId: service.id, title: data.title },
    })

    return service
  })

// ── Provider: Update service ──
export const updateService = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    categoryId?: string
    title?: string
    description?: string
    city?: string
    country?: string
    bannerImage?: string | null
    isActive?: boolean
    galleryImages?: { imageUrl: string; caption: string; sortOrder: number }[]
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const { id, galleryImages, ...updates } = data

    const existing = await db.query.services.findFirst({ where: eq(services.id, id) })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (updates.categoryId !== undefined) values.categoryId = updates.categoryId
    if (updates.title !== undefined) values.title = updates.title
    if (updates.description !== undefined) values.description = sanitizeHtml(updates.description)
    if (updates.city !== undefined) values.city = updates.city || null
    if (updates.country !== undefined) values.country = updates.country || null
    if (updates.bannerImage !== undefined) values.bannerImage = updates.bannerImage
    if (updates.isActive !== undefined) values.isActive = updates.isActive

    const [service] = await db.update(services).set(values).where(eq(services.id, id)).returning()

    // Sync gallery images if provided
    if (galleryImages !== undefined) {
      await db.delete(serviceImages).where(eq(serviceImages.serviceId, id))
      if (galleryImages.length > 0) {
        await db.insert(serviceImages).values(
          galleryImages.map((img) => ({
            serviceId: id,
            imageUrl: img.imageUrl,
            caption: img.caption || null,
            sortOrder: img.sortOrder,
          })),
        )
      }
    }

    return service
  })

// ── Provider: Delete service (blocked if negotiations exist) ──
export const deleteService = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const existing = await db.query.services.findFirst({ where: eq(services.id, data.id) })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const hasNegotiations = await db.query.negotiations.findFirst({
      where: eq(negotiations.serviceId, data.id),
    })
    if (hasNegotiations) {
      throw new Error('CANNOT_DELETE: Service has negotiations')
    }

    await db.delete(services).where(eq(services.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_deleted',
      details: { serviceId: data.id },
    })
  })

// ── Provider: List my services ──
export const listMyServices = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    return db.query.services.findMany({
      where: eq(services.providerId, session.user.id),
      with: {
        category: true,
        packages: { orderBy: [asc(servicePackages.sortOrder)] },
      },
      orderBy: [desc(services.createdAt)],
    })
  },
)

// ── Package CRUD ──
export const createPackage = createServerFn({ method: 'POST' })
  .validator((input: {
    serviceId: string
    name: string
    description?: string
    price?: string | null
    priceIsPublic?: boolean
    sortOrder?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const service = await db.query.services.findFirst({ where: eq(services.id, data.serviceId) })
    if (!service) throw new Error('NOT_FOUND')
    if (service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const [pkg] = await db.insert(servicePackages).values({
      serviceId: data.serviceId,
      name: data.name,
      description: data.description || null,
      price: data.price || null,
      priceIsPublic: data.priceIsPublic ?? true,
      sortOrder: data.sortOrder ?? 0,
    }).returning()

    return pkg
  })

export const updatePackage = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    name?: string
    description?: string
    price?: string | null
    priceIsPublic?: boolean
    sortOrder?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const pkg = await db.query.servicePackages.findFirst({
      where: eq(servicePackages.id, data.id),
      with: { service: true },
    })
    if (!pkg) throw new Error('NOT_FOUND')
    if (pkg.service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) values.name = data.name
    if (data.description !== undefined) values.description = data.description || null
    if (data.price !== undefined) values.price = data.price || null
    if (data.priceIsPublic !== undefined) values.priceIsPublic = data.priceIsPublic
    if (data.sortOrder !== undefined) values.sortOrder = data.sortOrder

    const [updated] = await db.update(servicePackages).set(values).where(eq(servicePackages.id, data.id)).returning()
    return updated
  })

export const deletePackage = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    const pkg = await db.query.servicePackages.findFirst({
      where: eq(servicePackages.id, data.id),
      with: { service: true },
    })
    if (!pkg) throw new Error('NOT_FOUND')
    if (pkg.service.providerId !== session.user.id && session.user.role !== 'superadmin') {
      throw new Error('FORBIDDEN')
    }

    await db.delete(servicePackages).where(eq(servicePackages.id, data.id))
  })

// ── Public: Browse services ──
export const browseServices = createServerFn({ method: 'GET' })
  .validator((input: {
    categoryId?: string
    keyword?: string
    city?: string
    country?: string
    page?: number
    limit?: number
  }) => input)
  .handler(async ({ data }) => {
    const page = data.page ?? 1
    const limit = data.limit ?? 12
    const offset = (page - 1) * limit

    const conditions = [
      eq(services.isActive, true),
    ]

    if (data.categoryId) {
      conditions.push(eq(services.categoryId, data.categoryId))
    }
    if (data.city) {
      conditions.push(ilike(services.city, `%${data.city}%`))
    }
    if (data.country) {
      conditions.push(ilike(services.country, `%${data.country}%`))
    }

    let results
    if (data.keyword) {
      const keyword = `%${data.keyword}%`
      results = await db.query.services.findMany({
        where: and(
          ...conditions,
          or(
            ilike(services.title, keyword),
            ilike(services.description, keyword),
          ),
        ),
        with: {
          category: true,
          packages: { orderBy: [asc(servicePackages.sortOrder)] },
          provider: { columns: { id: true, name: true, image: true, isActive: true } },
        },
        limit,
        offset,
        orderBy: [desc(services.createdAt)],
      })
    } else {
      results = await db.query.services.findMany({
        where: and(...conditions),
        with: {
          category: true,
          packages: { orderBy: [asc(servicePackages.sortOrder)] },
          provider: { columns: { id: true, name: true, image: true, isActive: true } },
        },
        limit,
        offset,
        orderBy: [desc(services.createdAt)],
      })
    }

    // Filter out services from inactive/suspended providers
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
  })

// ── Public: Get service detail ──
export const getService = createServerFn({ method: 'GET' })
  .validator((input: { serviceId: string }) => input)
  .handler(async ({ data }) => {
    const service = await db.query.services.findFirst({
      where: eq(services.id, data.serviceId),
      with: {
        category: true,
        packages: { orderBy: [asc(servicePackages.sortOrder)] },
        images: { orderBy: [asc(serviceImages.sortOrder)] },
        provider: { columns: { id: true, name: true, image: true, isActive: true } },
      },
    })
    if (!service) throw new Error('NOT_FOUND')
    return service
  })

// ── Admin: List all services ──
export const listAllServices = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:services:manage')
    return db.query.services.findMany({
      with: {
        category: true,
        provider: { columns: { id: true, name: true, email: true } },
      },
      orderBy: [desc(services.createdAt)],
    })
  },
)
