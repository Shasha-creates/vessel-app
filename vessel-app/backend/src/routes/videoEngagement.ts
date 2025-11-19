import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../utils/authMiddleware'
import { enforceModeration } from '../utils/moderation'
import {
  addVideoComment,
  deleteVideoComment,
  likeVideo,
  listVideoComments,
  listVideoLikes,
  unlikeVideo,
  type VideoCommentRow,
} from '../services/videoEngagementService'
import { presentUser } from '../services/userService'
import { getVideoById } from '../services/videoFeedService'
import { recordNotification } from '../services/notificationService'

const router = Router()

const commentSchema = z.object({
  body: z.string().min(1).max(500),
})

router.post('/:videoId/like', requireAuth, async (req, res, next) => {
  try {
    const videoId = req.params.videoId.trim()
    if (!videoId) {
      return res.status(400).json({ message: 'videoId is required' })
    }
    const video = await getVideoById(videoId)
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' })
    }
    const inserted = await likeVideo(req.authUser!.id, videoId)
    const likes = await listVideoLikes(videoId)
    if (inserted && video.user.id !== req.authUser!.id) {
      await recordNotification({
        recipientId: video.user.id,
        actorId: req.authUser!.id,
        type: 'like',
        videoId: video.id,
        videoTitle: video.title,
      })
    }
    res.json({ count: likes.length })
  } catch (error) {
    next(error)
  }
})

router.delete('/:videoId/like', requireAuth, async (req, res, next) => {
  try {
    const videoId = req.params.videoId.trim()
    if (!videoId) {
      return res.status(400).json({ message: 'videoId is required' })
    }
    await unlikeVideo(req.authUser!.id, videoId)
    const likes = await listVideoLikes(videoId)
    res.json({ count: likes.length })
  } catch (error) {
    next(error)
  }
})

router.get('/:videoId/likes', async (req, res, next) => {
  try {
    const videoId = req.params.videoId.trim()
    if (!videoId) {
      return res.status(400).json({ message: 'videoId is required' })
    }
    const likes = await listVideoLikes(videoId)
    res.json({ count: likes.length, users: likes.map(presentUser) })
  } catch (error) {
    next(error)
  }
})

router.get('/:videoId/comments', async (req, res, next) => {
  try {
    const videoId = req.params.videoId.trim()
    if (!videoId) {
      return res.status(400).json({ message: 'videoId is required' })
    }
    const comments = await listVideoComments(videoId)
    res.json({ comments: comments.map(presentComment) })
  } catch (error) {
    next(error)
  }
})

router.post('/:videoId/comments', requireAuth, async (req, res, next) => {
  try {
    const videoId = req.params.videoId.trim()
    if (!videoId) {
      return res.status(400).json({ message: 'videoId is required' })
    }
    const video = await getVideoById(videoId)
    if (!video) {
      return res.status(404).json({ message: 'Video not found.' })
    }
    const payload = commentSchema.parse(req.body)
    enforceModeration('comment', [{ label: 'Comment', text: payload.body }])
    const comment = await addVideoComment(req.authUser!.id, videoId, payload.body)
    if (video.user.id !== req.authUser!.id) {
      await recordNotification({
        recipientId: video.user.id,
        actorId: req.authUser!.id,
        type: 'comment',
        videoId: video.id,
        videoTitle: video.title,
        commentPreview: payload.body.slice(0, 160),
      })
    }
    res.status(201).json({ comment: presentComment(comment) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:videoId/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const deleted = await deleteVideoComment(req.authUser!.id, req.params.commentId)
    if (!deleted) {
      return res.status(404).json({ message: 'Comment not found.' })
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

function presentComment(row: VideoCommentRow) {
  return {
    id: row.id,
    videoId: row.video_id,
    body: row.body,
    createdAt: row.created_at,
    user: presentUser(row.user),
  }
}

export default router
