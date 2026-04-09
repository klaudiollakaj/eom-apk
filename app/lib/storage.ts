import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  projectId: process.env.GCS_PROJECT_ID,
  credentials: {
    client_email: process.env.GCS_CLIENT_EMAIL!,
    private_key: process.env.GCS_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  },
})

export const BUCKET_NAME = process.env.GCS_BUCKET_NAME!
export const bucket = storage.bucket(BUCKET_NAME)

export function getPublicUrl(key: string): string {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${key}`
}

export function getKeyFromUrl(url: string): string {
  return url.replace(`https://storage.googleapis.com/${BUCKET_NAME}/`, '')
}
