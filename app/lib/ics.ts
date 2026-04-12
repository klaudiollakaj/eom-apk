/**
 * Minimal iCalendar (.ics) VEVENT generator — no external dependencies.
 * Produces RFC 5545-compliant output.
 */

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Format a Date to iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ */
function toIcsUtc(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

/**
 * Parse a time string like "14:00", "2:00 PM", "9:30 am" into { hours, minutes }.
 * Returns null on failure.
 */
function parseTime(raw: string): { hours: number; minutes: number } | null {
  const trimmed = raw.trim()

  // Try 24-h format "HH:MM"
  const m24 = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (m24) {
    const h = Number(m24[1])
    const m = Number(m24[2])
    if (h >= 0 && h < 24 && m >= 0 && m < 60) return { hours: h, minutes: m }
  }

  // Try 12-h format "H:MM AM/PM"
  const m12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i)
  if (m12) {
    let h = Number(m12[1])
    const m = Number(m12[2])
    const period = m12[3].toLowerCase()
    if (h < 1 || h > 12 || m < 0 || m >= 60) return null
    if (period === 'am' && h === 12) h = 0
    else if (period === 'pm' && h !== 12) h += 12
    return { hours: h, minutes: m }
  }

  return null
}

/** Escape special characters per RFC 5545 (TEXT type). */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export function buildIcsEvent(opts: {
  title: string
  startDate: Date
  startTime?: string | null
  durationMinutes?: number
  location?: string | null
  description?: string
}): string {
  const { title, startDate, startTime, durationMinutes = 120, location, description } = opts

  // Build start datetime
  const start = new Date(startDate)
  if (startTime) {
    const parsed = parseTime(startTime)
    if (parsed) {
      start.setUTCHours(parsed.hours, parsed.minutes, 0, 0)
    }
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000)

  const uid = crypto.randomUUID()
  const now = new Date()

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EOM//Event//EN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(start)}`,
    `DTEND:${toIcsUtc(end)}`,
    `SUMMARY:${escapeText(title)}`,
  ]

  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`)
  }
  if (description) {
    lines.push(`DESCRIPTION:${escapeText(description)}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.join('\r\n')
}
