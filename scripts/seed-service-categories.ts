import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../app/lib/schema'
import { slugify } from '../app/lib/slugify'

const SERVICE_CATEGORIES = [
  { name: 'DJ', sortOrder: 1 },
  { name: 'Catering', sortOrder: 2 },
  { name: 'Photography', sortOrder: 3 },
  { name: 'Videography', sortOrder: 4 },
  { name: 'Security', sortOrder: 5 },
  { name: 'Lighting & Sound', sortOrder: 6 },
  { name: 'Venue', sortOrder: 7 },
  { name: 'Transportation', sortOrder: 8 },
  { name: 'Decoration', sortOrder: 9 },
  { name: 'Entertainment', sortOrder: 10 },
  { name: 'Planning & Coordination', sortOrder: 11 },
  { name: 'Other', sortOrder: 12 },
]

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  for (const cat of SERVICE_CATEGORIES) {
    const slug = slugify(cat.name)
    const existing = await db.query.serviceCategories.findFirst({
      where: (c, { eq }) => eq(c.slug, slug),
    })
    if (existing) {
      console.log(`Service category "${cat.name}" already exists, skipping.`)
      continue
    }
    await db.insert(schema.serviceCategories).values({
      name: cat.name,
      slug,
      sortOrder: cat.sortOrder,
    })
    console.log(`Created service category: ${cat.name}`)
  }

  console.log('Done.')
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
