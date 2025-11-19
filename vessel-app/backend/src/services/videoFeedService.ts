import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { getPgPool } from '../clients'
import { DbUser, mapRow } from './userService'

const pool: Pool = getPgPool()

export type FeedVideoRecord = {
  id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  category: string
  tags: string[]
  duration_seconds: number
  created_at: Date
  like_count: number
  comment_count: number
  user: DbUser
}

export type CreateVideoInput = {
  userId: string
  title: string
  description?: string | null
  videoUrl: string
  thumbnailUrl?: string | null
  category?: string | null
  tags?: string[]
  durationSeconds?: number
}

type ListOptions = {
  limit?: number
  cursor?: Date
  authorIds?: string[]
  videoId?: string
}

export const DEFAULT_THUMBNAIL_URL = 'https://placehold.co/640x360?text=Vessel'

export async function ensureVideoFeedTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      video_url TEXT NOT NULL,
      thumbnail_url TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos(created_at DESC);')
}

export async function createVideoRecord(input: CreateVideoInput): Promise<FeedVideoRecord> {
  const id = `vid_${randomUUID()}`
  await pool.query(
    `
      INSERT INTO videos (id, user_id, title, description, video_url, thumbnail_url, category, tags, duration_seconds)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      id,
      input.userId,
      input.title,
      input.description ?? null,
      input.videoUrl,
      input.thumbnailUrl ?? DEFAULT_THUMBNAIL_URL,
      (input.category ?? 'testimony').toLowerCase(),
      input.tags && input.tags.length ? input.tags : [],
      input.durationSeconds ?? 0,
    ]
  )
  const video = await getVideoById(id)
  if (!video) {
    throw new Error('Unable to load uploaded video after saving.')
  }
  return video
}

export async function listRecentVideos(options: ListOptions = {}): Promise<FeedVideoRecord[]> {
  return queryVideos(options)
}

export async function listVideosByAuthors(authorIds: string[], options: ListOptions = {}): Promise<FeedVideoRecord[]> {
  if (!authorIds.length) {
    return []
  }
  return queryVideos({ ...options, authorIds })
}

export async function getVideoById(id: string): Promise<FeedVideoRecord | null> {
  const videos = await queryVideos({ videoId: id, limit: 1 })
  return videos[0] ?? null
}

export async function deleteVideoRecord(videoId: string, ownerId: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM videos WHERE id = $1 AND user_id = $2 RETURNING 1', [videoId, ownerId])
  return (result.rowCount ?? 0) > 0
}

type VideoQueryRow = {
  id: string
  title: string
  description: string | null
  video_url: string
  thumbnail_url: string | null
  category: string
  tags: string[] | null
  duration_seconds: number | null
  created_at: Date
  like_count: number
  comment_count: number
  user_json: DbUser
}

async function queryVideos(options: ListOptions): Promise<FeedVideoRecord[]> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50)
  const values: unknown[] = []
  const conditions: string[] = []
  let paramIndex = 1

  if (options.videoId) {
    conditions.push(`v.id = $${paramIndex}`)
    values.push(options.videoId)
    paramIndex++
  }

  if (options.authorIds && options.authorIds.length) {
    conditions.push(`v.user_id = ANY($${paramIndex}::uuid[])`)
    values.push(options.authorIds)
    paramIndex++
  }

  if (options.cursor) {
    conditions.push(`v.created_at < $${paramIndex}`)
    values.push(options.cursor)
    paramIndex++
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  values.push(limit)

  const result = await pool.query<VideoQueryRow>(
    `
      SELECT
        v.id,
        v.user_id,
        v.title,
        v.description,
        v.video_url,
        v.thumbnail_url,
        v.category,
        v.tags,
        v.duration_seconds,
        v.created_at,
        l.like_count,
        c.comment_count,
        row_to_json(u) AS user_json
      FROM videos v
      JOIN users u ON u.id = v.user_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS like_count
        FROM video_likes vl
        WHERE vl.video_id = v.id
      ) l ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS comment_count
        FROM video_comments vc
        WHERE vc.video_id = v.id
      ) c ON TRUE
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${paramIndex}
    `,
    values
  )

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    video_url: row.video_url,
    thumbnail_url: row.thumbnail_url,
    category: row.category,
    tags: row.tags ?? [],
    duration_seconds: row.duration_seconds ?? 0,
    created_at: row.created_at,
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    user: mapRow(row.user_json),
  }))
}
