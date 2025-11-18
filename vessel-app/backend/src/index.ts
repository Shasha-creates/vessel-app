import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { verifyConnections, shutdownConnections } from './clients'
import authRouter from './routes/auth'
import contactsRouter from './routes/contacts'
import followRouter from './routes/follow'
import videoEngagementRouter from './routes/videoEngagement'
import feedRouter from './routes/feed'
import messagesRouter from './routes/messages'
import { ensureUsersTable } from './services/userService'
import { ensureFollowPrereqs } from './services/followService'
import { ensureVideoEngagementTables } from './services/videoEngagementService'
import { ensureVideoFeedTables } from './services/videoFeedService'
import { ensureMessagingTables } from './services/messagingService'
import notificationsRouter from './routes/notifications'
import { ensureNotificationTables } from './services/notificationService'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
const uploadsDir = path.resolve(process.cwd(), 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

const DEFAULT_PORT = 4000

function resolvePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT
  }

  const trimmed = value.trim()

  if (trimmed === '') {
    return DEFAULT_PORT
  }

  const parsed = Number(trimmed)

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value "${value}". Expected an integer between 0 and 65535.`)
  }

  return parsed
}

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from godlyme backend' })
})

app.get('/api/health', async (_req, res) => {
  try {
    await verifyConnections()
    res.json({ status: 'ok' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown connectivity issue'
    res.status(503).json({ status: 'error', message })
  }
})

app.use('/api/auth', authRouter)
app.use('/api/contacts', contactsRouter)
app.use('/api/follows', followRouter)
app.use('/api/feed', feedRouter)
app.use('/api/videos', videoEngagementRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/notifications', notificationsRouter)
app.set('trust proxy', true)

async function start() {
  let port: number

  try {
    port = resolvePort(process.env.PORT)
    await verifyConnections()
    await ensureUsersTable()
    await ensureFollowPrereqs()
    await ensureVideoEngagementTables()
    await ensureVideoFeedTables()
    await ensureMessagingTables()
    await ensureNotificationTables()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect to external services'
    // eslint-disable-next-line no-console
    console.error(message)
    process.exit(1)
    return
  }

  const server = app.listen(port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://0.0.0.0:${port}`)
  })

  let isShuttingDown = false

  const shutdown = () => {
    if (isShuttingDown) {
      return
    }
    isShuttingDown = true

    // eslint-disable-next-line no-console
    console.log('Shutting down server...')
    server.close((closeError) => {
      if (closeError) {
        // eslint-disable-next-line no-console
        console.error('Error closing HTTP server', closeError)
        process.exit(1)
        return
      }

      shutdownConnections()
        .then(() => process.exit(0))
        .catch((error) => {
          // eslint-disable-next-line no-console
          console.error('Error closing external connections', error)
          process.exit(1)
        })
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

void start()
