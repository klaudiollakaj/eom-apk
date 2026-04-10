import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

export interface TicketPdfData {
  ticketId: string
  qrCode: string
  eventTitle: string
  startDate: string | Date
  startTime?: string | null
  venueName?: string | null
  city?: string | null
  country?: string | null
  tierName: string
  priceCents: number
  attendeeName: string
  orderNumber?: string | null
}

function formatDate(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export async function generateTicketPdf(data: TicketPdfData): Promise<void> {
  const qrDataUrl = await QRCode.toDataURL(data.qrCode, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'M',
  })

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 20
  const contentWidth = pageWidth - marginX * 2

  // ── Header bar ──
  doc.setFillColor(79, 70, 229) // indigo-600
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('EOM', marginX, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('Event of Mine', marginX, 25)
  doc.setFontSize(11)
  doc.text('ADMIT ONE', pageWidth - marginX, 22, { align: 'right' })

  // ── Event title ──
  doc.setTextColor(17, 24, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  const titleLines = doc.splitTextToSize(data.eventTitle, contentWidth)
  doc.text(titleLines, marginX, 48)

  let cursorY = 48 + titleLines.length * 8 + 6

  // ── Divider ──
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY)
  cursorY += 10

  // ── Details (left column) ──
  const detailX = marginX
  const labelColor: [number, number, number] = [107, 114, 128]
  const valueColor: [number, number, number] = [17, 24, 39]

  function drawField(label: string, value: string) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...labelColor)
    doc.text(label.toUpperCase(), detailX, cursorY)
    cursorY += 5
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...valueColor)
    const valueLines = doc.splitTextToSize(value, contentWidth / 2 - 5)
    doc.text(valueLines, detailX, cursorY)
    cursorY += valueLines.length * 6 + 4
  }

  drawField('Date', formatDate(data.startDate) + (data.startTime ? ` · ${data.startTime}` : ''))

  const location = [data.venueName, data.city, data.country].filter(Boolean).join(', ')
  if (location) drawField('Location', location)

  drawField('Attendee', data.attendeeName)
  drawField('Ticket Type', data.tierName)

  const priceStr = data.priceCents > 0 ? `$${(data.priceCents / 100).toFixed(2)}` : 'Free'
  drawField('Price', priceStr)

  if (data.orderNumber) drawField('Order', data.orderNumber)

  // ── QR code (right side) ──
  const qrSize = 70
  const qrX = pageWidth - marginX - qrSize
  const qrY = 70
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...labelColor)
  doc.text('Scan at entry', qrX + qrSize / 2, qrY + qrSize + 5, { align: 'center' })

  // ── Ticket ID footer ──
  doc.setFontSize(8)
  doc.setTextColor(...labelColor)
  doc.text(`Ticket ID: ${data.ticketId}`, marginX, 285)
  doc.text('Present this ticket at entry. Do not share the QR code.', pageWidth - marginX, 285, { align: 'right' })

  // ── Save ──
  const filename = `ticket-${data.eventTitle.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${data.ticketId.slice(0, 8)}.pdf`
  doc.save(filename)
}
