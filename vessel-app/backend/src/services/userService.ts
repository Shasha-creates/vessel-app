import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Pool } from 'pg'
import { getPgPool } from '../clients'

const pool: Pool = getPgPool()

export type DbUser = {
  id: string
  handle: string
  name: string
  email: string
  password_hash: string
  church: string | null
  country: string | null
  photo_url: string | null
  is_verified: boolean
  verification_token: string | null
  verification_token_expires: Date | null
  email_hash: string | null
  reset_token: string | null
  reset_token_expires: Date | null
  created_at: Date
  updated_at: Date
}

export function mapRow(row: any): DbUser {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    email: row.email,
    password_hash: row.password_hash,
    church: row.church,
    country: row.country,
    photo_url: row.photo_url,
    is_verified: row.is_verified,
    verification_token: row.verification_token,
    verification_token_expires: row.verification_token_expires,
    email_hash: row.email_hash,
    reset_token: row.reset_token,
    reset_token_expires: row.reset_token_expires,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function hashContactIdentifier(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

export async function ensureUsersTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      handle TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      church TEXT,
      country TEXT,
      photo_url TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT FALSE,
      verification_token TEXT,
      verification_token_expires TIMESTAMPTZ,
      email_hash TEXT,
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS email_hash TEXT;')
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;')
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ;')
  await backfillEmailHashes()
}

async function backfillEmailHashes(): Promise<void> {
  const result = await pool.query<{ id: string; email: string }>('SELECT id, email FROM users WHERE email_hash IS NULL')
  if (!result.rowCount) {
    return
  }
  await Promise.all(
    result.rows.map((row) =>
      pool.query('UPDATE users SET email_hash = $1 WHERE id = $2', [hashContactIdentifier(row.email), row.id])
    )
  )
}

type CreateUserInput = {
  name: string
  handle: string
  email: string
  password: string
  church?: string
  country?: string
  photoUrl?: string | null
}

export async function createUser(input: CreateUserInput): Promise<DbUser> {
  const id = crypto.randomUUID()
  const normalizedEmail = input.email.trim().toLowerCase()
  const normalizedHandle = input.handle.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(input.password.trim(), 10)
  const verificationCode = generateVerificationCode()
  const verificationExpires = new Date(Date.now() + 1000 * 60 * 60 * 24) // 24h
  const emailHash = hashContactIdentifier(normalizedEmail)

  const result = await pool.query(
    `
      INSERT INTO users (
        id, handle, name, email, password_hash, church, country, photo_url,
        verification_token, verification_token_expires, email_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `,
    [
      id,
      normalizedHandle,
      input.name.trim(),
      normalizedEmail,
      passwordHash,
      input.church?.trim() || null,
      input.country?.trim() || null,
      input.photoUrl?.trim() || null,
      verificationCode,
      verificationExpires,
      emailHash,
    ]
  )

  return mapRow(result.rows[0])
}

export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email.trim().toLowerCase()])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function findUserByHandle(handle: string): Promise<DbUser | null> {
  const result = await pool.query('SELECT * FROM users WHERE handle = $1 LIMIT 1', [handle.trim().toLowerCase()])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function findUserById(id: string): Promise<DbUser | null> {
  const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id])
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function verifyUserByCode(email: string, code: string): Promise<DbUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  const trimmedCode = code.trim()
  const result = await pool.query(
    `
      UPDATE users
      SET is_verified = TRUE,
          verification_token = NULL,
          verification_token_expires = NULL,
          updated_at = NOW()
      WHERE email = $1
        AND verification_token = $2
        AND verification_token_expires IS NOT NULL
        AND verification_token_expires > NOW()
      RETURNING *
    `,
    [normalizedEmail, trimmedCode]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function updateVerificationCode(userId: string): Promise<DbUser | null> {
  const newCode = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24)
  const result = await pool.query(
    `
      UPDATE users
      SET verification_token = $1,
          verification_token_expires = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
    [newCode, expiresAt, userId]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function comparePassword(user: DbUser, candidate: string): Promise<boolean> {
  if (!candidate) return false
  return bcrypt.compare(candidate, user.password_hash)
}

export async function matchUsersByEmailHashes(hashes: string[]): Promise<DbUser[]> {
  if (!hashes.length) {
    return []
  }
  const unique = Array.from(new Set(hashes.map((hash) => hash.trim().toLowerCase()).filter(Boolean)))
  if (!unique.length) {
    return []
  }
  const result = await pool.query('SELECT * FROM users WHERE email_hash = ANY($1)', [unique])
  return result.rows.map(mapRow)
}

export async function createPasswordResetToken(email: string): Promise<DbUser | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    return null
  }
  const token = generateResetToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15)
  const result = await pool.query(
    `
      UPDATE users
      SET reset_token = $1,
          reset_token_expires = $2,
          updated_at = NOW()
      WHERE email = $3
      RETURNING *
    `,
    [token, expiresAt, normalizedEmail]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<DbUser | null> {
  const trimmedToken = token.trim()
  if (!trimmedToken) {
    return null
  }
  const passwordHash = await bcrypt.hash(newPassword.trim(), 10)
  const result = await pool.query(
    `
      UPDATE users
      SET password_hash = $1,
          reset_token = NULL,
          reset_token_expires = NULL,
          updated_at = NOW()
      WHERE reset_token = $2
        AND reset_token_expires IS NOT NULL
        AND reset_token_expires > NOW()
      RETURNING *
    `,
    [passwordHash, trimmedToken]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}

export function presentUser(user: DbUser) {
  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    email: user.email,
    church: user.church,
    country: user.country,
    photoUrl: user.photo_url,
    isVerified: user.is_verified,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  }
}
