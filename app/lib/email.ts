import { createTransport } from 'nodemailer'

const transporter = createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
})

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string
  subject: string
  text: string
}) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@eom.local',
    to,
    subject,
    text,
  })
}
