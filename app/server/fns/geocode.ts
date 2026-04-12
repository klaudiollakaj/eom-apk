import { createServerFn } from '@tanstack/react-start'

export const geocodeAddress = createServerFn({ method: 'GET' })
  .validator((input: { query: string }) => input)
  .handler(async ({ data }) => {
    if (!data.query.trim()) return null

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('q', data.query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('limit', '1')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'EOM-EventApp/1.0' },
    })

    if (!res.ok) return null

    const results = await res.json()
    if (!results.length) return null

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
      displayName: results[0].display_name as string,
    }
  })
