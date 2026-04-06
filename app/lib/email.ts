import { createTransport } from 'nodemailer'

const transporter = process.env.SMTP_HOST
  ? createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  : null

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) {
  if (!transporter) {
    console.warn(`[email] SMTP not configured, skipping email to ${to}: ${subject}`)
    return
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eom.local',
    to,
    subject,
    text,
  })
}
