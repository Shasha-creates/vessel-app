import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../utils/authMiddleware'
import { enforceModeration } from '../utils/moderation'
import {
  appendMessage,
  createThreadWithMessage,
  getThreadForUser,
  listMessagesForThread,
  listThreadsForUser,
  presentMessage,
  presentThread,
  removeThreadForUser,
  createMessageRequest,
  listIncomingMessageRequests,
  getMessageRequest,
  acceptMessageRequest,
  declineMessageRequest,
  presentMessageRequest,
  findExistingThreadForExactParticipants,
} from '../services/messagingService'
import { findUserByHandle, findUserById, presentUser } from '../services/userService'
import { isMutualFollow } from '../services/followService'

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

    const creatorId = req.authUser!.id

    // Resolve handles to target users
    const recipients = await Promise.all(payload.handles.map((h) => findUserByHandle(h)))
    const validRecipients = recipients.filter(Boolean) as any[]
    if (!validRecipients.length) {
      throw new Error('No valid recipients found.')
    }

    // If a thread with this exact participant set already exists, append to it and return it.
    const participantIds = [creatorId, ...validRecipients.map((u) => u.id)]
    const existing = await findExistingThreadForExactParticipants(participantIds)
    if (existing) {
      enforceModeration('message', [
        { label: 'Message', text: payload.message },
        { label: 'Subject', text: payload.subject ?? '' },
      ])
      await appendMessage(existing.id, creatorId, payload.message)
      const refreshed = await getThreadForUser(existing.id, creatorId)
      res.status(200).json({ thread: presentThread(refreshed ?? existing) })
      return
    }

    // Build message requests for any non-mutual relationship
    const requestRows: any[] = []
    for (const recipient of validRecipients) {
      if (recipient.id === creatorId) continue
      try {
        const mutual = await isMutualFollow(creatorId, recipient.id)
        if (!mutual) {
          const reqRow = await createMessageRequest(creatorId, recipient.id, payload.message)
          requestRows.push(reqRow)
        }
      } catch (err) {
        // ignore per-recipient errors
      }
    }

    if (requestRows.length) {
      // return 202 to indicate message requests created instead of a live thread
      const presented = requestRows.map((r) => presentMessageRequest(r))
      res.status(202).json({ requests: presented })
      return
    }

    // Otherwise, create the thread normally
    enforceModeration('message', [
      { label: 'Message', text: payload.message },
      { label: 'Subject', text: payload.subject ?? '' },
    ])

    const thread = await createThreadWithMessage(creatorId, payload.handles, payload.message, payload.subject)
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
    enforceModeration('message', [{ label: 'Message', text: payload.body }])
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

// delete a user's participation in a thread
router.delete('/threads/:threadId', requireAuth, async (req, res, next) => {
  try {
    const threadId = req.params.threadId
    await removeThreadForUser(threadId, req.authUser!.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

// incoming message requests
router.get('/requests', requireAuth, async (req, res, next) => {
  try {
    const incoming = await listIncomingMessageRequests(req.authUser!.id)
    const withUsers = await Promise.all(
      incoming.map(async (r) => ({ id: r.id, sender: await findUserById(r.sender_id).then((u) => (u ? presentUser(u) : null)), body: r.body, createdAt: r.created_at }))
    )
    res.json({ requests: withUsers })
  } catch (err) {
    next(err)
  }
})

router.post('/requests/:id/accept', requireAuth, async (req, res, next) => {
  try {
    const reqId = req.params.id
    const thread = await acceptMessageRequest(reqId, req.authUser!.id)
    res.json({ thread: presentThread(thread) })
  } catch (err) {
    next(err)
  }
})

router.post('/requests/:id/decline', requireAuth, async (req, res, next) => {
  try {
    const reqId = req.params.id
    await declineMessageRequest(reqId, req.authUser!.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router

