import { createServerFn } from '@tanstack/react-start'
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { eq } from 'drizzle-orm'
import { db } from '~/lib/db'
import { eventImages, events } from '~/lib/schema'
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '~/lib/r2'
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

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: data.contentType,
    })

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 })
    const publicUrl = `${R2_PUBLIC_URL}/${key}`

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

    const key = image.imageUrl.replace(`${R2_PUBLIC_URL}/`, '')
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))

    await db.delete(eventImages).where(eq(eventImages.id, data.imageId))
  })
