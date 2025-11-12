import nodemailer from 'nodemailer'

type EmailPayload = {
  to: string
  subject: string
  html: string
  text?: string
}

let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter | null {
  if (transporter !== null) {
    return transporter
  }

  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !port || !user || !pass) {
    transporter = null
    return null
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  })

  return transporter
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const from = process.env.EMAIL_FROM ?? 'no-reply@godlyme.com'
  const activeTransporter = getTransporter()

  if (!activeTransporter) {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP settings missing. Email to %s was not sent. Subject: %s', payload.to, payload.subject)
    // eslint-disable-next-line no-console
    console.info('[email] Preview:\n%s', payload.html)
    return
  }

  await activeTransporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  })
}

export function buildVerificationEmail(recipient: string, verificationCode: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px;">
      <h2>Confirm your Godlyme account</h2>
      <p>Thanks for joining Godlyme! Enter the verification code below to finish creating your account.</p>
      <p style="margin: 32px 0; font-size: 32px; letter-spacing: 8px; font-weight: bold;">
        ${verificationCode}
      </p>
      <p style="color:#666;font-size:12px;">If you didn't create this account, you can ignore this email.</p>
    </div>
  `

  return {
    to: recipient,
    subject: 'Verify your Godlyme email',
    html,
    text: `Your Godlyme verification code is ${verificationCode}.`,
  }
}
