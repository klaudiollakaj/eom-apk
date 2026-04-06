import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { eq } from 'drizzle-orm'
import * as schema from '../app/lib/schema'

const CORE_LINKS = [
  {
    label: 'Home',
    url: '/',
    position: 'both',
    sortOrder: 1,
    isDeletable: false,
    isPublishable: false,
  },
  {
    label: 'Events',
    url: '/events',
    position: 'both',
    sortOrder: 2,
    isDeletable: false,
    isPublishable: true,
  },
  {
    label: 'News',
    url: '/posts',
    position: 'header',
    sortOrder: 3,
    isDeletable: false,
    isPublishable: true,
  },
  {
    label: 'FAQ',
    url: '/faq',
    position: 'header',
    sortOrder: 4,
    isDeletable: false,
    isPublishable: false,
  },
  {
    label: 'Contact',
    url: '/contact',
    position: 'footer',
    sortOrder: 6,
    isDeletable: false,
    isPublishable: false,
  },
]

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { max: 1 })
  const db = drizzle(client, { schema })

  for (const link of CORE_LINKS) {
    const existing = await db.query.navigationLinks.findFirst({
      where: eq(schema.navigationLinks.url, link.url),
    })
    if (existing) {
      console.log(`Skipping existing link: ${link.label} (${link.url})`)
      continue
    }
    await db.insert(schema.navigationLinks).values(link)
    console.log(`Created link: ${link.label} (${link.url})`)
  }

  console.log('Navigation seeding complete.')
  await client.end()
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
