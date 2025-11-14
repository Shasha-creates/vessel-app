import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../utils/authMiddleware'
import {
  appendMessage,
  createThreadWithMessage,
  getThreadForUser,
  listMessagesForThread,
  listThreadsForUser,
  presentMessage,
  presentThread,
} from '../services/messagingService'

const router = Router()

const createThreadSchema = z.object({
  handles: z.array(z.string().min(2)).min(1).max(20),
  message: z.string().min(1).max(2000),
  subject: z.string().max(140).optional(),
})

const messageSchema = z.object({
  body: z.string().min(1).max(2000),
})

router.get('/threads', requireAuth, async (req, res, next) => {
  try {
    const threads = await listThreadsForUser(req.authUser!.id)
    res.json({ threads: threads.map(presentThread) })
  } catch (error) {
    next(error)
  }
})

router.post('/threads', requireAuth, async (req, res, next) => {
  try {
    const payload = createThreadSchema.parse(req.body ?? {})
    const thread = await createThreadWithMessage(req.authUser!.id, payload.handles, payload.message, payload.subject)
    res.status(201).json({ thread: presentThread(thread) })
  } catch (error) {
    next(error)
  }
})

router.get('/threads/:threadId/messages', requireAuth, async (req, res, next) => {
  try {
    const threadId = req.params.threadId
    const messages = await listMessagesForThread(threadId, req.authUser!.id)
    res.json({ messages: messages.map(presentMessage) })
  } catch (error) {
    next(error)
  }
})

router.post('/threads/:threadId/messages', requireAuth, async (req, res, next) => {
  try {
    const payload = messageSchema.parse(req.body ?? {})
    const message = await appendMessage(req.params.threadId, req.authUser!.id, payload.body)
    res.status(201).json({ message: presentMessage(message) })
  } catch (error) {
    next(error)
  }
})

router.get('/threads/:threadId', requireAuth, async (req, res, next) => {
  try {
    const thread = await getThreadForUser(req.params.threadId, req.authUser!.id)
    if (!thread) {
      return res.status(404).json({ message: 'Conversation not found.' })
    }
    res.json({ thread: presentThread(thread) })
  } catch (error) {
    next(error)
  }
})

export default router
