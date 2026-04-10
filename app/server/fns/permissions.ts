import { createServerFn } from '@tanstack/react-start'
import { eq, and } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import {
  publishingPermissions,
  navigationLinks,
  userLogs,
} from '~/lib/schema'
import { requireAuth } from './auth-helpers'
import { requireCapability } from '~/lib/permissions.server'
import { isAdmin, type Role } from '~/lib/permissions'

export const getPublishingPermissions = createServerFn({
  method: 'GET',
}).handler(async () => {
  const session = await requireAuth()
  await requireCapability(session, 'admin:permissions:manage')

  const [perms, pages] = await Promise.all([
    db.query.publishingPermissions.findMany(),
    db.query.navigationLinks.findMany({
      where: eq(navigationLinks.isPublishable, true),
    }),
  ])

  return { permissions: perms, publishablePages: pages }
})

export const updatePublishingPermission = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      role: string
      targetPage: string
      canPublish: boolean
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireAuth()
    await requireCapability(session, 'admin:permissions:manage')

    const existing = await db.query.publishingPermissions.findFirst({
      where: and(
        eq(publishingPermissions.role, data.role),
        eq(publishingPermissions.targetPage, data.targetPage),
      ),
    })

    if (existing) {
      await db
        .update(publishingPermissions)
        .set({
          canPublish: data.canPublish,
          grantedBy: session.user.id,
          updatedAt: new Date(),
        })
        .where(eq(publishingPermissions.id, existing.id))
    } else {
      await db.insert(publishingPermissions).values({
        role: data.role,
        targetPage: data.targetPage,
        canPublish: data.canPublish,
        grantedBy: session.user.id,
      })
    }

    await db.insert(userLogs).values({
      userId: session.user.id,
      action: 'permission_changed',
      details: data,
    })
  })

export const getMyPublishingPermissions = createServerFn({
  method: 'GET',
}).handler(async () => {
  const session = await requireAuth()

  if (isAdmin(session.user.role as Role)) {
    const pages = await db.query.navigationLinks.findMany({
      where: eq(navigationLinks.isPublishable, true),
    })
    return pages.map((p) => p.url)
  }

  const perms = await db.query.publishingPermissions.findMany({
    where: and(
      eq(publishingPermissions.role, session.user.role),
      eq(publishingPermissions.canPublish, true),
    ),
  })

  return perms.map((p) => p.targetPage)
})
