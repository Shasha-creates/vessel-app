import { Pool } from 'pg'
import { getPgPool } from '../clients'
import { DbUser, mapRow } from './userService'

const pool: Pool = getPgPool()

export async function ensureFollowTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_follows (
      follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, followee_id)
    );
  `)
}

export async function createFollow(followerId: string, followeeId: string): Promise<boolean> {
  if (followerId === followeeId) {
    throw new Error('You cannot follow yourself.')
  }
  const result = await pool.query(
    `
      INSERT INTO user_follows (follower_id, followee_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING 1
    `,
    [followerId, followeeId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function removeFollow(followerId: string, followeeId: string): Promise<void> {
  await pool.query('DELETE FROM user_follows WHERE follower_id = $1 AND followee_id = $2', [followerId, followeeId])
}

export async function listFollowing(followerId: string): Promise<DbUser[]> {
  const result = await pool.query(
    `
      SELECT u.*
      FROM user_follows f
      JOIN users u ON u.id = f.followee_id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
    `,
    [followerId]
  )
  return result.rows.map((row) => mapRow(row))
}

export async function listFollowers(followeeId: string): Promise<DbUser[]> {
  const result = await pool.query(
    `
      SELECT u.*
      FROM user_follows f
      JOIN users u ON u.id = f.follower_id
      WHERE f.followee_id = $1
      ORDER BY f.created_at DESC
    `,
    [followeeId]
  )
  return result.rows.map((row) => mapRow(row))
}

export async function listMutualFollows(userId: string): Promise<DbUser[]> {
  const result = await pool.query(
    `
      SELECT u.*
      FROM user_follows f1
      JOIN user_follows f2 ON f1.followee_id = f2.follower_id AND f2.followee_id = f1.follower_id
      JOIN users u ON u.id = f1.followee_id
      WHERE f1.follower_id = $1
      ORDER BY u.name ASC
    `,
    [userId]
  )
  return result.rows.map((row) => mapRow(row))
}

export async function doesUserFollow(followerId: string, followeeId: string): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM user_follows
      WHERE follower_id = $1 AND followee_id = $2
      LIMIT 1
    `,
    [followerId, followeeId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function isMutualFollow(userId: string, otherUserId: string): Promise<boolean> {
  const result = await pool.query(
    `
      SELECT 1
      FROM user_follows f1
      JOIN user_follows f2 ON f1.followee_id = f2.follower_id AND f2.followee_id = f1.follower_id
      WHERE f1.follower_id = $1 AND f1.followee_id = $2
      LIMIT 1
    `,
    [userId, otherUserId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function ensureFollowPrereqs(): Promise<void> {
  await ensureFollowTable()
}

export async function getFollowStats(userId: string): Promise<{ followers: number; following: number }> {
  const result = await pool.query<{ followers: number; following: number }>(
    `
      SELECT
        (SELECT COUNT(*)::int FROM user_follows WHERE followee_id = $1) AS followers,
        (SELECT COUNT(*)::int FROM user_follows WHERE follower_id = $1) AS following
    `,
    [userId]
  )
  return {
    followers: result.rows[0]?.followers ?? 0,
    following: result.rows[0]?.following ?? 0,
  }
}
