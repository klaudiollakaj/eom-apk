import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '~/lib/db'
import { eventImages, events } from '~/lib/schema'
import { bucket, getPublicUrl, getKeyFromUrl } from '~/lib/storage'
import { requireAuth } from './auth-helpers'

export const getUploadUrl = createServerFn({ method: 'POST' })
  .validator((input: {
    filename: string
    contentType: string
    purpose: 'banner' | 'gallery'
  }) => input)
  .handler(async ({ data }) => {
    const session = await requireAuth()

    const timestamp = Date.now()
    const safeName = data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `uploads/${session.user.id}/${data.purpose}/${timestamp}-${safeName}`

    const file = bucket.file(key)
    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 10 * 60 * 1000, // 10 minutes
      contentType: data.contentType,
    })

    const publicUrl = getPublicUrl(key)

    return { uploadUrl, publicUrl }
  })

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
    await bucket.file(key).delete()

    await db.delete(eventImages).where(eq(eventImages.id, data.imageId))
  })
