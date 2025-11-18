import { Router } from 'express'
import { requireAuth } from '../utils/authMiddleware'
import { findUserByHandle, findUserById, presentUser } from '../services/userService'
import {
  createFollow,
  getFollowStats,
  listFollowers,
  listFollowing,
  listMutualFollows,
  removeFollow,
} from '../services/followService'
import { recordNotification } from '../services/notificationService'

const router = Router()

function normalizeHandle(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

router.post('/:handle', requireAuth, async (req, res, next) => {
  try {
    const targetHandle = normalizeHandle(req.params.handle || '')
    const targetUser = await findUserByHandle(targetHandle)
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' })
    }
    const inserted = await createFollow(req.authUser!.id, targetUser.id)
    if (inserted) {
      await recordNotification({
        recipientId: targetUser.id,
        actorId: req.authUser!.id,
        type: 'follow',
      })
    }
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.delete('/:handle', requireAuth, async (req, res, next) => {
  try {
    const targetHandle = normalizeHandle(req.params.handle || '')
    const targetUser = await findUserByHandle(targetHandle)
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' })
    }
    await removeFollow(req.authUser!.id, targetUser.id)
    res.status(204).end()
  } catch (error) {
    next(error)
  }
})

router.get('/following', requireAuth, async (req, res, next) => {
  try {
    const following = await listFollowing(req.authUser!.id)
    res.json({ following: following.map(presentUser) })
  } catch (error) {
    next(error)
  }
})

router.get('/followers', requireAuth, async (req, res, next) => {
  try {
    const followers = await listFollowers(req.authUser!.id)
    res.json({ followers: followers.map(presentUser) })
  } catch (error) {
    next(error)
  }
})

router.get('/mutual', requireAuth, async (req, res, next) => {
  try {
    const mutual = await listMutualFollows(req.authUser!.id)
    res.json({ mutual: mutual.map(presentUser) })
  } catch (error) {
    next(error)
  }
})

router.get('/profiles/:handle/stats', async (req, res, next) => {
  try {
    const identifierRaw = (req.params.handle || '').trim()
    if (!identifierRaw) {
      return res.status(400).json({ message: 'handle is required' })
    }
    const normalizedHandle = normalizeHandle(identifierRaw)
    let targetUser = normalizedHandle ? await findUserByHandle(normalizedHandle) : null
    if (
      !targetUser &&
      /^[0-9a-f-]{8}-[0-9a-f-]{4}-[1-5][0-9a-f-]{3}-[89ab][0-9a-f-]{3}-[0-9a-f-]{12}$/i.test(identifierRaw)
    ) {
      targetUser = await findUserById(identifierRaw)
    }
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found.' })
    }
    const stats = await getFollowStats(targetUser.id)
    res.json(stats)
  } catch (error) {
    next(error)
  }
})

export default router
