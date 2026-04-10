import { createServerFn } from '@tanstack/react-start'
import { eq, asc } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { serviceCategories, services, userLogs } from '~/lib/schema'
import { requireAuth } from '~/server/fns/auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import { slugify } from '~/lib/slugify'

export const listServiceCategories = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.query.serviceCategories.findMany({
      where: eq(serviceCategories.isActive, true),
      orderBy: [asc(serviceCategories.sortOrder)],
    })
  },
)

export const listAllServiceCategories = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')
    return db.query.serviceCategories.findMany({
      orderBy: [asc(serviceCategories.sortOrder)],
    })
  },
)

export const createServiceCategory = createServerFn({ method: 'POST' })
  .validator((input: {
    name: string
    description?: string
    sortOrder?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')

    const slug = slugify(data.name)
    const [category] = await db.insert(serviceCategories).values({
      name: data.name,
      slug,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    }).returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_category_created',
      details: { categoryId: category.id, name: data.name },
    })

    return category
  })

export const updateServiceCategory = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    name?: string
    description?: string
    sortOrder?: number
    isActive?: boolean
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')

    const { id, ...updates } = data
    const values: Record<string, unknown> = { ...updates }
    if (updates.name) {
      values.slug = slugify(updates.name)
    }

    const [category] = await db
      .update(serviceCategories)
      .set(values)
      .where(eq(serviceCategories.id, id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_category_updated',
      details: { categoryId: id, updates },
    })

    return category
  })

export const deleteServiceCategory = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:service-categories:manage')

    const hasServices = await db.query.services.findFirst({
      where: eq(services.categoryId, data.id),
    })
    if (hasServices) {
      throw new Error('CANNOT_DELETE: Services reference this category')
    }

    const category = await db.query.serviceCategories.findFirst({
      where: eq(serviceCategories.id, data.id),
    })
    if (!category) throw new Error('NOT_FOUND')

    await db.delete(serviceCategories).where(eq(serviceCategories.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'service_category_deleted',
      details: { categoryId: data.id, name: category.name },
    })
  })
