import { createUploadthing, UploadThingError } from 'uploadthing/server'
import type { FileRouter } from 'uploadthing/server'
import { auth } from '~/lib/auth'

const f = createUploadthing()

export const uploadRouter = {
  bannerImage: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(async ({ req }) => {
      const session = await auth.api.getSession({ headers: req.headers })
      if (!session) throw new UploadThingError('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, uploadedBy: metadata.userId }
    }),

  galleryImage: f({
    image: { maxFileSize: '10MB', maxFileCount: 6 },
  })
    .middleware(async ({ req }) => {
      const session = await auth.api.getSession({ headers: req.headers })
      if (!session) throw new UploadThingError('Unauthorized')
      return { userId: session.user.id }
    })
    .onUploadComplete(({ metadata, file }) => {
      return { url: file.ufsUrl, uploadedBy: metadata.userId }
    }),
} satisfies FileRouter

export type UploadRouter = typeof uploadRouter
