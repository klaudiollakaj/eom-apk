import { createServerFn } from '@tanstack/react-start'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '~/lib/db'
import { navigationLinks, userLogs } from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'

export const getNavLinks = createServerFn({ method: 'GET' })
  .validator((input: { position: 'header' | 'footer' }) => input)
  .handler(async ({ data }) => {
    const links = await db.query.navigationLinks.findMany({
      where: eq(navigationLinks.isVisible, true),
      orderBy: [asc(navigationLinks.sortOrder)],
    })

    return links.filter(
      (link) =>
        link.position === data.position || link.position === 'both',
    )
  })

export const listAllNavLinks = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    return db.query.navigationLinks.findMany({
      orderBy: [asc(navigationLinks.sortOrder)],
    })
  },
)

export const createNavLink = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      label: string
      url: string
      position: string
      sortOrder: number
      isExternal: boolean
      isPublishable: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    const [link] = await db
      .insert(navigationLinks)
      .values(data)
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'nav_link_created',
      details: { linkId: link.id, label: data.label, url: data.url },
    })

    return link
  })

export const updateNavLink = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      id: string
      label?: string
      url?: string
      position?: string
      sortOrder?: number
      isVisible?: boolean
      isExternal?: boolean
      isPublishable?: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    const { id, ...updates } = data
    const [link] = await db
      .update(navigationLinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(navigationLinks.id, id))
      .returning()

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'nav_link_updated',
      details: { linkId: id, updates },
    })

    return link
  })

export const deleteNavLink = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:navigation:manage')

    const link = await db.query.navigationLinks.findFirst({
      where: eq(navigationLinks.id, data.id),
    })

    if (!link) throw new Error('NOT_FOUND')
    if (!link.isDeletable) throw new Error('CANNOT_DELETE_CORE_LINK')

    await db
      .delete(navigationLinks)
      .where(eq(navigationLinks.id, data.id))

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'nav_link_deleted',
      details: { linkId: data.id, label: link.label, url: link.url },
    })
  })
