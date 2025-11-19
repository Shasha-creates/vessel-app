import { Pool } from 'pg'
import { getPgPool } from '../clients'
import { DbUser, findUserByHandle, findUserById, mapRow, presentUser } from './userService'

const pool: Pool = getPgPool()

export type ThreadMessageRow = {
  id: string
  thread_id: string
  body: string
  created_at: Date
  sender: DbUser
}

export type ThreadSummary = {
  id: string
  subject: string | null
  created_at: Date
  updated_at: Date
  participants: DbUser[]
  last_message: ThreadMessageRow | null
  unread_count: number
}

type MessageListOptions = {
  limit?: number
  cursor?: Date
}

function httpError(message: string, status: number) {
  const error = new Error(message)
  ;(error as any).status = status
  return error
}

async function ensurePgCrypto() {
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
}

export async function ensureMessagingTables(): Promise<void> {
  await ensurePgCrypto()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS message_threads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subject TEXT,
      created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS thread_participants (
      thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at TIMESTAMPTZ,
      PRIMARY KEY (thread_id, user_id)
    );
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages(thread_id, created_at DESC);')
}

export async function listThreadsForUser(userId: string, limit = 25): Promise<ThreadSummary[]> {
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.subject,
        t.created_at,
        t.updated_at,
        last_msg.id AS last_message_id,
        last_msg.body AS last_message_body,
        last_msg.created_at AS last_message_created_at,
        last_sender.id AS last_sender_id,
        last_sender.handle AS last_sender_handle,
        last_sender.name AS last_sender_name,
        last_sender.email AS last_sender_email,
        last_sender.password_hash AS last_sender_password_hash,
        last_sender.church AS last_sender_church,
        last_sender.country AS last_sender_country,
        last_sender.photo_url AS last_sender_photo_url,
        last_sender.is_verified AS last_sender_is_verified,
        last_sender.verification_token AS last_sender_verification_token,
        last_sender.verification_token_expires AS last_sender_verification_token_expires,
        last_sender.email_hash AS last_sender_email_hash,
        last_sender.created_at AS last_sender_created_at,
        last_sender.updated_at AS last_sender_updated_at,
        unread.count AS unread_count
      FROM message_threads t
      JOIN thread_participants tp ON tp.thread_id = t.id
      LEFT JOIN LATERAL (
        SELECT m.id, m.body, m.created_at, m.sender_id
        FROM messages m
        WHERE m.thread_id = t.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) last_msg ON TRUE
      LEFT JOIN users last_sender ON last_sender.id = last_msg.sender_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM messages m2
        WHERE m2.thread_id = t.id
          AND m2.sender_id <> $1
          AND m2.created_at > COALESCE(tp.last_read_at, '1970-01-01'::timestamptz)
      ) unread ON TRUE
      WHERE tp.user_id = $1
      ORDER BY t.updated_at DESC
      LIMIT $2
    `,
    [userId, limit]
  )
  const summaries = await hydrateThreadParticipants(userId, result.rows)
  return summaries
}

export async function getThreadForUser(threadId: string, userId: string): Promise<ThreadSummary | null> {
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.subject,
        t.created_at,
        t.updated_at,
        last_msg.id AS last_message_id,
        last_msg.body AS last_message_body,
        last_msg.created_at AS last_message_created_at,
        last_sender.id AS last_sender_id,
        last_sender.handle AS last_sender_handle,
        last_sender.name AS last_sender_name,
        last_sender.email AS last_sender_email,
        last_sender.password_hash AS last_sender_password_hash,
        last_sender.church AS last_sender_church,
        last_sender.country AS last_sender_country,
        last_sender.photo_url AS last_sender_photo_url,
        last_sender.is_verified AS last_sender_is_verified,
        last_sender.verification_token AS last_sender_verification_token,
        last_sender.verification_token_expires AS last_sender_verification_token_expires,
        last_sender.email_hash AS last_sender_email_hash,
        last_sender.created_at AS last_sender_created_at,
        last_sender.updated_at AS last_sender_updated_at,
        unread.count AS unread_count
      FROM message_threads t
      JOIN thread_participants tp ON tp.thread_id = t.id
      LEFT JOIN LATERAL (
        SELECT m.id, m.body, m.created_at, m.sender_id
        FROM messages m
        WHERE m.thread_id = t.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) last_msg ON TRUE
      LEFT JOIN users last_sender ON last_sender.id = last_msg.sender_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS count
        FROM messages m2
        WHERE m2.thread_id = t.id
          AND m2.sender_id <> $2
          AND m2.created_at > COALESCE(tp.last_read_at, '1970-01-01'::timestamptz)
      ) unread ON TRUE
      WHERE tp.user_id = $2
        AND t.id = $1
      LIMIT 1
    `,
    [threadId, userId]
  )
  if (!result.rowCount) {
    return null
  }
  const [summary] = await hydrateThreadParticipants(userId, result.rows)
  return summary ?? null
}

export async function listMessagesForThread(
  threadId: string,
  userId: string,
  options: MessageListOptions = {}
): Promise<ThreadMessageRow[]> {
  await ensureParticipant(threadId, userId)
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const values: unknown[] = [threadId]
  let cursorClause = ''
  if (options.cursor) {
    cursorClause = 'AND m.created_at < $2'
    values.push(options.cursor)
  }
  values.push(limit)
  const result = await pool.query(
    `
      SELECT
        m.id,
        m.thread_id,
        m.body,
        m.created_at,
        row_to_json(u) AS sender_json
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.thread_id = $1
      ${cursorClause}
      ORDER BY m.created_at ASC
      LIMIT $${values.length}
    `,
    values
  )
  await pool.query('UPDATE thread_participants SET last_read_at = NOW() WHERE thread_id = $1 AND user_id = $2', [
    threadId,
    userId,
  ])
  return result.rows.map((row) => ({
    id: row.id,
    thread_id: row.thread_id,
    body: row.body,
    created_at: row.created_at,
    sender: mapRow(row.sender_json),
  }))
}

export async function createThreadWithMessage(
  creatorId: string,
  participantHandles: string[],
  body: string,
  subject?: string | null
): Promise<ThreadSummary> {
  if (!body.trim()) {
    throw httpError('Message body is required.', 400)
  }
  const participants = await resolveParticipantUsers(participantHandles)
  if (!participants.length) {
    throw new Error('Select at least one recipient.')
  }
  const uniqueParticipantIds = Array.from(new Set([creatorId, ...participants.map((user) => user.id)]))
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const threadResult = await client.query(
      `
        INSERT INTO message_threads (subject, created_by)
        VALUES ($1, $2::uuid)
        RETURNING id
      `,
      [subject ?? null, creatorId]
    )
    const threadId = threadResult.rows[0].id
    await Promise.all(
      uniqueParticipantIds.map((userId) =>
        client.query(
          `
            INSERT INTO thread_participants (thread_id, user_id, joined_at, last_read_at)
            VALUES ($1::uuid, $2::uuid, NOW(), CASE WHEN $2::uuid = $3::uuid THEN NOW() ELSE NULL END)
            ON CONFLICT (thread_id, user_id) DO NOTHING
          `,
          [threadId, userId, creatorId]
        )
      )
    )
    await client.query('INSERT INTO messages (thread_id, sender_id, body) VALUES ($1::uuid, $2::uuid, $3)', [
      threadId,
      creatorId,
      body,
    ])
    await client.query('UPDATE message_threads SET updated_at = NOW() WHERE id = $1::uuid', [threadId])
    await client.query('COMMIT')
    const summary = await getThreadForUser(threadId, creatorId)
    if (!summary) {
      throw new Error('Unable to load thread after creation.')
    }
    return summary
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function appendMessage(threadId: string, senderId: string, body: string): Promise<ThreadMessageRow> {
  if (!body.trim()) {
    throw httpError('Message body is required.', 400)
  }
  await ensureParticipant(threadId, senderId)
  const result = await pool.query(
    `
      INSERT INTO messages (thread_id, sender_id, body)
      VALUES ($1::uuid, $2::uuid, $3)
      RETURNING id, thread_id, body, created_at
    `,
    [threadId, senderId, body]
  )
  await pool.query('UPDATE thread_participants SET last_read_at = NOW() WHERE thread_id = $1::uuid AND user_id = $2::uuid', [
    threadId,
    senderId,
  ])
  await pool.query('UPDATE message_threads SET updated_at = NOW() WHERE id = $1::uuid', [threadId])
  const sender = await findUserById(senderId)
  if (!sender) {
    throw new Error('Sender not found.')
  }
  return {
    ...result.rows[0],
    sender,
  }
}

async function ensureParticipant(threadId: string, userId: string): Promise<void> {
  const membership = await pool.query('SELECT 1 FROM thread_participants WHERE thread_id = $1 AND user_id = $2', [
    threadId,
    userId,
  ])
  if (!membership.rowCount) {
    throw httpError('Conversation not found for current user.', 404)
  }
}

async function resolveParticipantUsers(handles: string[]): Promise<DbUser[]> {
  const unique = Array.from(
    new Set(
      handles
        .map((handle) => handle.trim().replace(/^@/, '').toLowerCase())
        .filter((handle) => handle.length > 0)
    )
  )
  if (!unique.length) {
    throw httpError('Provide at least one handle to start a conversation.', 400)
  }
  const users = await Promise.all(unique.map((handle) => findUserByHandle(handle)))
  const validUsers = users.filter((user): user is DbUser => Boolean(user))
  if (!validUsers.length) {
    throw httpError('No valid recipients found.', 404)
  }
  return validUsers
}

async function listThreadParticipantsExcludingSender(threadId: string, senderId: string): Promise<DbUser[]> {
  const result = await pool.query(
    `
      SELECT u.*
      FROM thread_participants tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.thread_id = $1 AND tp.user_id <> $2
    `,
    [threadId, senderId]
  )
  return result.rows.map((row) => mapRow(row))
}

async function hydrateThreadParticipants(userId: string, rows: any[]): Promise<ThreadSummary[]> {
  if (!rows.length) {
    return []
  }
  const threadIds = rows.map((row) => row.id)
  const participantResult = await pool.query(
    `
      SELECT
        tp.thread_id,
        row_to_json(u) AS user_json
      FROM thread_participants tp
      JOIN users u ON u.id = tp.user_id
      WHERE tp.thread_id = ANY($1)
    `,
    [threadIds]
  )
  const participantsByThread = new Map<string, DbUser[]>()
  participantResult.rows.forEach((row) => {
    const list = participantsByThread.get(row.thread_id) ?? []
    list.push(mapRow(row.user_json))
    participantsByThread.set(row.thread_id, list)
  })
  return rows.map((row) => {
    const participants = participantsByThread.get(row.id) ?? []
    let lastMessage: ThreadMessageRow | null = null
    if (row.last_message_id && row.last_sender_id) {
      lastMessage = {
        id: row.last_message_id,
        thread_id: row.id,
        body: row.last_message_body,
        created_at: row.last_message_created_at,
        sender: mapRow({
          id: row.last_sender_id,
          handle: row.last_sender_handle,
          name: row.last_sender_name,
          email: row.last_sender_email,
          password_hash: row.last_sender_password_hash,
          church: row.last_sender_church,
          country: row.last_sender_country,
          photo_url: row.last_sender_photo_url,
          is_verified: row.last_sender_is_verified,
          verification_token: row.last_sender_verification_token,
          verification_token_expires: row.last_sender_verification_token_expires,
          email_hash: row.last_sender_email_hash,
          created_at: row.last_sender_created_at,
          updated_at: row.last_sender_updated_at,
        }),
      }
    }
    return {
      id: row.id,
      subject: row.subject,
      created_at: row.created_at,
      updated_at: row.updated_at,
      participants,
      last_message: lastMessage,
      unread_count: row.unread_count ?? 0,
    }
  })
}

export function presentThread(summary: ThreadSummary) {
  return {
    id: summary.id,
    subject: summary.subject,
    updatedAt: summary.updated_at,
    participants: summary.participants.map(presentUser),
    unreadCount: summary.unread_count,
    lastMessage: summary.last_message
      ? {
          id: summary.last_message.id,
          threadId: summary.last_message.thread_id,
          body: summary.last_message.body,
          createdAt: summary.last_message.created_at,
          sender: presentUser(summary.last_message.sender),
        }
      : null,
  }
}

export function presentMessage(row: ThreadMessageRow) {
  return {
    id: row.id,
    threadId: row.thread_id,
    body: row.body,
    createdAt: row.created_at,
    sender: presentUser(row.sender),
  }
}
