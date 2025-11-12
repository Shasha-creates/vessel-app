import { Router } from 'express'
import { z } from 'zod'
import { matchUsersByEmailHashes, hashContactIdentifier } from '../services/userService'

const router = Router()

const matchSchema = z.object({
  emails: z.array(z.string().email()).max(128).optional(),
  hashes: z.array(z.string().min(32)).max(256).optional(),
})

router.post('/match', async (req, res, next) => {
  try {
    const payload = matchSchema.parse(req.body ?? {})
    const hashesFromEmails = payload.emails?.map((email) => hashContactIdentifier(email)) ?? []
    const hashes = [...hashesFromEmails, ...(payload.hashes ?? [])]
    const matches = await matchUsersByEmailHashes(hashes)
    res.json({
      matches: matches.map((user) => ({
        id: user.id,
        handle: user.handle,
        name: user.name,
        email: user.email,
        church: user.church,
        country: user.country,
        photoUrl: user.photo_url,
      })),
    })
  } catch (error) {
    next(error)
  }
})

export default router
