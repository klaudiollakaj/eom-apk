import jwt from 'jsonwebtoken'

export interface TicketTokenPayload {
  ticketId: string
  eventId: string
}

function getSecret(): string {
  const secret = process.env.TICKET_SIGNING_SECRET
  if (!secret) {
    throw new Error('TICKET_SIGNING_SECRET is not set')
  }
  return secret
}

export function signTicketToken(payload: TicketTokenPayload): string {
  return jwt.sign(payload, getSecret(), { algorithm: 'HS256' })
}

export function verifyTicketToken(token: string): TicketTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] })
    if (typeof decoded !== 'object' || !decoded) return null
    const { ticketId, eventId } = decoded as Record<string, unknown>
    if (typeof ticketId !== 'string' || typeof eventId !== 'string') return null
    return { ticketId, eventId }
  } catch {
    return null
  }
}
