import { Pool, PoolConfig } from 'pg'
import Redis from 'ioredis'

const databaseUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL)
const redisUrl = process.env.REDIS_URL

function sanitizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const parsed = new URL(url)
    parsed.searchParams.delete('sslmode')
    return parsed.toString()
  } catch {
    return url
  }
}

function resolvePgConfig(): PoolConfig {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined')
  }

  const base: PoolConfig = {
    connectionString: databaseUrl,
  }

  const sslMode = (process.env.PGSSLMODE ?? '').toLowerCase()
  if (sslMode === 'disable') {
    return base
  }

  return {
    ...base,
    ssl: {
      rejectUnauthorized: sslMode === 'verify-full',
    },
  }
}

if (!databaseUrl) {
  // eslint-disable-next-line no-console
  console.warn('DATABASE_URL is not set. Postgres-backed features are disabled.')
}

if (!redisUrl) {
  // eslint-disable-next-line no-console
  console.warn('REDIS_URL is not set. Redis-backed features are disabled.')
}

const pool = databaseUrl ? new Pool(resolvePgConfig()) : null
const redis = redisUrl ? new Redis(redisUrl) : null

export function getPgPool(): Pool {
  if (!pool) {
    throw new Error('Postgres is not configured. Set DATABASE_URL before starting the server.')
  }
  return pool
}

export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis is not configured. Set REDIS_URL before starting the server.')
  }
  return redis
}

export async function verifyConnections(): Promise<void> {
  if (pool) {
    await pool.query('SELECT 1')
  }

  if (redis) {
    await redis.ping()
  }
}

export async function shutdownConnections(): Promise<void> {
  await Promise.all([
    pool ? pool.end() : Promise.resolve(),
    redis ? redis.quit() : Promise.resolve(),
  ])
}
