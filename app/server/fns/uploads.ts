import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '~/lib/db.server'
import { eventImages, events } from '~/lib/schema'
import { utapi, getKeyFromUrl } from '~/lib/storage'
import { requireAuth } from './auth-helpers'

export const deleteImage = createServerFn({ method: 'POST' })
  .validator((input: { imageId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const image = await db.query.eventImages.findFirst({
      where: eq(eventImages.id, data.imageId),
      with: { event: true },
    })
    if (!image) throw new Error('NOT_FOUND')
    if (image.event.organizerId !== session.user.id) throw new Error('FORBIDDEN')

    const key = getKeyFromUrl(image.imageUrl)
    await utapi.deleteFiles(key)

    await db.delete(eventImages).where(eq(eventImages.id, data.imageId))
  })
