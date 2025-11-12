import { Router } from 'express'
import { requireAuth } from '../utils/authMiddleware'
import { findUserByHandle, presentUser } from '../services/userService'
import { createFollow, listFollowers, listFollowing, listMutualFollows, removeFollow } from '../services/followService'

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
    await createFollow(req.authUser!.id, targetUser.id)
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

export default router
