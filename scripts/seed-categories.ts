import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../app/lib/schema'
import { slugify } from '../app/lib/slugify'

const CATEGORIES = [
  { name: 'Music', sortOrder: 1 },
  { name: 'Sports', sortOrder: 2 },
  { name: 'Conference', sortOrder: 3 },
  { name: 'Workshop', sortOrder: 4 },
  { name: 'Festival', sortOrder: 5 },
  { name: 'Food & Drink', sortOrder: 6 },
  { name: 'Art & Culture', sortOrder: 7 },
  { name: 'Technology', sortOrder: 8 },
  { name: 'Business', sortOrder: 9 },
  { name: 'Community', sortOrder: 10 },
  { name: 'Other', sortOrder: 99 },
]

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  for (const cat of CATEGORIES) {
    const slug = slugify(cat.name)
    const existing = await db.query.categories.findFirst({
      where: (c, { eq }) => eq(c.slug, slug),
    })
    if (existing) {
      console.log(`Category "${cat.name}" already exists, skipping.`)
      continue
    }
    await db.insert(schema.categories).values({
      name: cat.name,
      slug,
      sortOrder: cat.sortOrder,
    })
    console.log(`Created category: ${cat.name}`)
  }

  console.log('Done.')
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
