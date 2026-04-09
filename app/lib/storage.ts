import { UTApi } from 'uploadthing/server'

export const utapi = new UTApi()

/**
 * Extract the file key from an uploadthing URL.
 * URL format: https://<app-id>.ufs.sh/f/<file-key>
 */
export function getKeyFromUrl(url: string): string {
  const parts = url.split('/f/')
  return parts[parts.length - 1]
}
