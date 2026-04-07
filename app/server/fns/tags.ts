import { createServerFn } from '@tanstack/react-start'
import { eq, ilike, asc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { tags } from '~/lib/schema'
import { slugify } from '~/lib/slugify'

export const listTags = createServerFn({ method: 'GET' })
  .validator((input: { search?: string }) => input)
  .handler(async ({ data }) => {
    if (data.search) {
      return db.query.tags.findMany({
        where: ilike(tags.name, `%${data.search}%`),
        orderBy: [asc(tags.name)],
        limit: 20,
      })
    }
    return db.query.tags.findMany({
      orderBy: [asc(tags.name)],
    })
  })

export async function findOrCreateTag(name: string): Promise<string> {
  const slug = slugify(name)
  const existing = await db.query.tags.findFirst({
    where: eq(tags.slug, slug),
  })
  if (existing) return existing.id

  const [created] = await db.insert(tags).values({ name: name.trim(), slug }).returning()
  return created.id
}
