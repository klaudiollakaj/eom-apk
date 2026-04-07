import { createServerFn } from '@tanstack/react-start'
import { eq, asc, count } from 'drizzle-orm'
import { db } from '~/lib/db'
import { categories, events, userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import { slugify } from '~/lib/slugify'

export const listCategories = createServerFn({ method: 'GET' }).handler(
  async () => {
    return db.query.categories.findMany({
      where: eq(categories.isActive, true),
      orderBy: [asc(categories.sortOrder)],
    })
  },
)

export const listAllCategories = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:categories:manage')
    return db.query.categories.findMany({
      orderBy: [asc(categories.sortOrder)],
    })
  },
)

export const createCategory = createServerFn({ method: 'POST' })
  .validator((input: {
    name: string
    description?: string
    sortOrder?: number
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:categories:manage')

    const slug = slugify(data.name)
    const [category] = await db.insert(categories).values({
      name: data.name,
      slug,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    }).returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'category_created',
      details: { categoryId: category.id, name: data.name },
    })

    return category
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .validator((input: {
    id: string
    name?: string
    description?: string
    sortOrder?: number
    isActive?: boolean
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:categories:manage')

    const { id, ...updates } = data
    const values: Record<string, unknown> = { ...updates }
    if (updates.name) {
      values.slug = slugify(updates.name)
    }

    const [category] = await db
      .update(categories)
      .set(values)
      .where(eq(categories.id, id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'category_updated',
      details: { categoryId: id, updates },
    })

    return category
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:categories:manage')

    const [result] = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.categoryId, data.id))

    if (result.count > 0) {
      throw new Error(`CANNOT_DELETE: ${result.count} events use this category`)
    }

    const category = await db.query.categories.findFirst({
      where: eq(categories.id, data.id),
    })
    if (!category) throw new Error('NOT_FOUND')

    await db.delete(categories).where(eq(categories.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'category_deleted',
      details: { categoryId: data.id, name: category.name },
    })
  })
