import { Router, type Request } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'
import { requireAuth } from '../utils/authMiddleware'
import {
  createVideoRecord,
  listRecentVideos,
  listVideosByAuthors,
  type FeedVideoRecord,
} from '../services/videoFeedService'
<<<<<<< HEAD
import { presentUser } from '../services/userService'
=======
import { findUserByHandle, findUserById, presentUser } from '../services/userService'
>>>>>>> 8a33d6a (UI Changes)
import { listFollowing } from '../services/followService'

const router = Router()

const uploadDir = path.resolve(process.cwd(), 'uploads')
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname) || '.mp4'
    cb(null, `${unique}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.UPLOAD_MAX_BYTES ?? 200 * 1024 * 1024),
  },
})

const uploadSchema = z.object({
  title: z.string().min(3).max(140),
  description: z.string().max(2000).optional(),
  category: z.string().max(64).optional(),
  tags: z.string().optional(),
  thumbnailUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  durationSeconds: z.coerce.number().int().nonnegative().optional(),
})

router.get('/for-you', async (req, res, next) => {
  try {
    const { limit, cursor } = parsePaginationQuery(req.query)
    const videos = await listRecentVideos({
      limit,
      cursor,
    })
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

router.get('/following', requireAuth, async (req, res, next) => {
  try {
    const { limit, cursor } = parsePaginationQuery(req.query)
<<<<<<< HEAD
    const followees = await listFollowing(req.authUser!.id)
    if (!followees.length) {
      return res.json({ videos: [] })
    }
    const videos = await listVideosByAuthors(
      followees.map((user) => user.id),
=======
    const follower = await listFollowing(req.authUser!.id)
    if (!follower.length) {
      return res.json({ videos: [] })
    }
    const videos = await listVideosByAuthors(
      follower.map((user) => user.id),
>>>>>>> 8a33d6a (UI Changes)
      { limit, cursor }
    )
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

<<<<<<< HEAD
=======
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { limit, cursor } = parsePaginationQuery(req.query)
    const videos = await listVideosByAuthors([req.authUser!.id], { limit, cursor })
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

router.get('/profiles/:profileId', async (req, res, next) => {
  try {
    const identifier = (req.params.profileId || '').trim()
    if (!identifier) {
      return res.status(400).json({ message: 'profileId is required' })
    }
    const authorId = await resolveAuthorId(identifier)
    if (!authorId) {
      return res.status(404).json({ message: 'Creator not found.' })
    }
    const { limit, cursor } = parsePaginationQuery(req.query)
    const videos = await listVideosByAuthors([authorId], { limit, cursor })
    res.json({ videos: videos.map(presentFeedVideo) })
  } catch (error) {
    next(error)
  }
})

>>>>>>> 8a33d6a (UI Changes)
router.post('/videos', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    const payload = uploadSchema.parse(req.body)
    const tags = parseTags(payload.tags)

    let videoUrl = payload.videoUrl?.trim() ?? ''
    let thumbnailUrl = payload.thumbnailUrl?.trim() ?? ''

    if (req.file) {
      const publicPath = `/uploads/${req.file.filename}`
      videoUrl = buildPublicUrl(req, publicPath)
      if (!thumbnailUrl) {
        thumbnailUrl = videoUrl
      }
    }

    if (!videoUrl) {
      return res.status(400).json({ message: 'Upload a video file or provide videoUrl.' })
    }

    const record = await createVideoRecord({
      userId: req.authUser!.id,
      title: payload.title.trim(),
      description: payload.description?.trim() ?? null,
      category: payload.category?.trim() ?? 'testimony',
      tags,
      videoUrl,
      thumbnailUrl,
      durationSeconds: payload.durationSeconds ?? 0,
    })

    res.status(201).json({ video: presentFeedVideo(record) })
  } catch (error) {
    next(error)
  }
})

function parsePaginationQuery(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 50)
  const cursorParam = typeof query.cursor === 'string' ? query.cursor : null
  const cursorCandidate = cursorParam ? new Date(cursorParam) : undefined
  const cursor = cursorCandidate && Number.isNaN(cursorCandidate.getTime()) ? undefined : cursorCandidate
  return { limit, cursor }
}

function parseTags(value?: string): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0)
    }
  } catch {
    // ignore JSON parse failure and fall back to comma parsing
  }
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

function buildPublicUrl(req: Request, relativePath: string) {
  const origin = `${req.protocol}://${req.get('host')}`
  if (relativePath.startsWith('http')) {
    return relativePath
  }
  return `${origin}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`
}

<<<<<<< HEAD
=======
async function resolveAuthorId(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim()
  if (!trimmed) {
    return null
  }
  const normalizedHandle = trimmed.replace(/^@/, '').toLowerCase()
  const byHandle = await findUserByHandle(normalizedHandle)
  if (byHandle) {
    return byHandle.id
  }
  if (/^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$/i.test(trimmed)) {
    const byId = await findUserById(trimmed)
    if (byId) {
      return byId.id
    }
  }
  return null
}

>>>>>>> 8a33d6a (UI Changes)
function presentFeedVideo(row: FeedVideoRecord) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url ?? row.video_url,
    category: row.category,
    tags: row.tags ?? [],
    durationSeconds: row.duration_seconds ?? 0,
    createdAt: row.created_at.toISOString(),
    stats: {
      likes: row.like_count ?? 0,
      comments: row.comment_count ?? 0,
    },
    user: presentUser(row.user),
  }
}

export default router
