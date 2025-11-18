import nodemailer from 'nodemailer'

type EmailPayload = {
  to: string
  subject: string
  html: string
  text?: string
}

let transporter: nodemailer.Transporter | null = null

function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL?.trim() || 'http://localhost:5173'
}

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

export function buildPasswordResetEmail(recipient: string, token: string) {
  const resetUrl = `${getAppBaseUrl().replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px;">
      <h2>Reset your Godlyme password</h2>
      <p>We received a request to reset the password for your account. Click the button below or paste the link into your browser.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background:#1d4ed8;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Create a new password</a>
      </p>
      <p style="font-size:14px;color:#444;">If you didn’t request this, you can ignore this email. The link expires in 15 minutes.</p>
      <p style="font-size:12px;color:#888;">Reset link: ${resetUrl}</p>
    </div>
  `

  return {
    to: recipient,
    subject: 'Reset your Godlyme password',
    html,
    text: `Reset your Godlyme password by visiting: ${resetUrl}`,
  }
}
