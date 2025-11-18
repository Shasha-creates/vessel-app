import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import {
  comparePassword,
  createUser,
  findUserByEmail,
  findUserByHandle,
  updateVerificationCode,
  verifyUserByCode,
  presentUser,
  type DbUser,
  createPasswordResetToken,
  resetPasswordWithToken,
} from '../services/userService'
import { buildVerificationEmail, buildPasswordResetEmail, sendEmail } from '../services/emailService'

const router = Router()

const signupSchema = z.object({
  name: z.string().min(2).max(120),
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Handle can only contain letters, numbers, and underscores.'),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  church: z.string().max(160).optional(),
  country: z.string().max(160).optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(4).max(10),
})

const resendSchema = z.object({
  email: z.string().email(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(6).max(200),
})

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not configured. Set it in backend/.env')
  }
  return secret
}

function createToken(user: DbUser) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      handle: user.handle,
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  )
}

router.post('/signup', async (req, res, next) => {
  try {
    const payload = signupSchema.parse(req.body)
    const normalizedEmail = payload.email.trim().toLowerCase()
    const normalizedHandle = payload.handle.trim().toLowerCase()

    const [existingEmail, existingHandle] = await Promise.all([
      findUserByEmail(normalizedEmail),
      findUserByHandle(normalizedHandle),
    ])

    if (existingEmail) {
      return res.status(409).json({ message: 'Email already registered. Try signing in instead.' })
    }
    if (existingHandle) {
      return res.status(409).json({ message: 'Handle already in use. Pick a different one.' })
    }

    const user = await createUser({
      name: payload.name,
      handle: payload.handle,
      email: normalizedEmail,
      password: payload.password,
      church: payload.church,
      country: payload.country,
    })

    if (user.verification_token) {
      const emailPayload = buildVerificationEmail(user.email, user.verification_token)
      sendEmail(emailPayload).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to send verification email', err)
      })
    }

    res.status(201).json({
      message: 'Account created. Enter the verification code we sent to your email.',
      user: presentUser(user),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body)
    const normalizedEmail = payload.email.trim().toLowerCase()
    const user = await findUserByEmail(normalizedEmail)

    if (!user) {
      return res.status(404).json({ message: 'No account found for that email.' })
    }
    const passwordOk = await comparePassword(user, payload.password.trim())
    if (!passwordOk) {
      return res.status(401).json({ message: 'Incorrect password. Please try again.' })
    }
    if (!user.is_verified) {
      return res
        .status(403)
        .json({ message: 'Please verify your email before signing in.', needsVerification: true })
    }

    const token = createToken(user)
    res.json({
      token,
      user: presentUser(user),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/verify-email', async (req, res, next) => {
  try {
    const payload = verifySchema.parse(req.body)
    const user = await verifyUserByCode(payload.email, payload.code)
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code.' })
    }

    res.json({
      message: 'Email verified. You can now sign in.',
      user: presentUser(user),
    })
  } catch (error) {
    next(error)
  }
})

router.post('/resend-verification', async (req, res, next) => {
  try {
    const payload = resendSchema.parse(req.body)
    const user = await findUserByEmail(payload.email.trim().toLowerCase())
    if (!user) {
      return res.status(404).json({ message: 'No account found for that email.' })
    }
    if (user.is_verified) {
      return res.status(400).json({ message: 'This account is already verified.' })
    }
    const updated = await updateVerificationCode(user.id)
    if (!updated?.verification_token) {
      return res.status(500).json({ message: 'Unable to generate verification token. Try again later.' })
    }
    const emailPayload = buildVerificationEmail(updated.email, updated.verification_token)
    sendEmail(emailPayload).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Failed to send verification email', err)
    })
    res.json({ message: 'Verification code resent.' })
  } catch (error) {
    next(error)
  }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const payload = forgotPasswordSchema.parse(req.body)
    const normalizedEmail = payload.email.trim().toLowerCase()
    const successMessage = 'If an account exists for that email, we sent password reset instructions.'
    const user = await createPasswordResetToken(normalizedEmail)
    if (user?.reset_token) {
      const emailPayload = buildPasswordResetEmail(user.email, user.reset_token)
      sendEmail(emailPayload).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to send password reset email', err)
      })
    }
    res.json({ message: successMessage })
  } catch (error) {
    next(error)
  }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const payload = resetPasswordSchema.parse(req.body)
    const user = await resetPasswordWithToken(payload.token, payload.password)
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' })
    }
    const token = createToken(user)
    res.json({
      message: 'Password updated. You are now signed in.',
      token,
      user: presentUser(user),
    })
  } catch (error) {
    next(error)
  }
})

export default router
