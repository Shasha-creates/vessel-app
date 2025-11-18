import { Pool } from 'pg'
import { getPgPool } from '../clients'
import { DbUser, mapRow } from './userService'

const pool: Pool = getPgPool()

export async function ensureVideoEngagementTables(): Promise<void> {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_likes (
      video_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (video_id, user_id)
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS video_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      video_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
}

export async function likeVideo(userId: string, videoId: string): Promise<boolean> {
  const result = await pool.query(
    `
      INSERT INTO video_likes (video_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING 1
    `,
    [videoId, userId]
  )
  return (result.rowCount ?? 0) > 0
}

export async function unlikeVideo(userId: string, videoId: string): Promise<void> {
  await pool.query('DELETE FROM video_likes WHERE video_id = $1 AND user_id = $2', [videoId, userId])
}

export async function listVideoLikes(videoId: string): Promise<DbUser[]> {
  const result = await pool.query<DbUser>(
    `
      SELECT u.*
      FROM video_likes vl
      JOIN users u ON u.id = vl.user_id
      WHERE vl.video_id = $1
      ORDER BY vl.created_at DESC
      LIMIT 100
    `,
    [videoId]
  )
  return result.rows.map((row) => mapRow(row))
}

export type VideoCommentRow = {
  id: string
  video_id: string
  body: string
  created_at: Date
  user: DbUser
}

type InsertedCommentRow = {
  id: string
  video_id: string
  body: string
  created_at: Date
}

export async function addVideoComment(userId: string, videoId: string, body: string): Promise<VideoCommentRow> {
  const result = await pool.query<InsertedCommentRow>(
    `
      INSERT INTO video_comments (video_id, user_id, body)
      VALUES ($1, $2, $3)
      RETURNING id, video_id, body, created_at
    `,
    [videoId, userId, body]
  )
  const commentRow = result.rows[0]
  const userResult = await pool.query<DbUser>('SELECT * FROM users WHERE id = $1', [userId])
  return {
    ...commentRow,
    user: mapRow(userResult.rows[0]),
  }
}

type VideoCommentQueryRow = {
  comment_id: string
  video_id: string
  body: string
  comment_created_at: Date
  user_json: DbUser
}

export async function listVideoComments(videoId: string): Promise<VideoCommentRow[]> {
  const result = await pool.query<VideoCommentQueryRow>(
    `
      SELECT c.id AS comment_id,
             c.video_id,
             c.body,
             c.created_at AS comment_created_at,
             row_to_json(u) AS user_json
      FROM video_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.video_id = $1
      ORDER BY c.created_at DESC
      LIMIT 100
    `,
    [videoId]
  )

  return result.rows.map((row) => ({
    id: row.comment_id,
    video_id: row.video_id,
    body: row.body,
    created_at: row.comment_created_at,
    user: mapRow(row.user_json),
  }))
}

export async function deleteVideoComment(userId: string, commentId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM video_comments WHERE id = $1 AND user_id = $2', [commentId, userId])
  return (result.rowCount ?? 0) > 0
}
