import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { verifyConnections, shutdownConnections } from './clients'

const app = express()
app.use(cors())

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
  res.json({ message: 'Hello from Vessel backend' })
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

async function start() {
  let port: number

  try {
    port = resolvePort(process.env.PORT)
    await verifyConnections()
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
