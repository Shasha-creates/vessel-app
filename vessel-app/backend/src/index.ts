import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
const port = Number(process.env.PORT) || 4000

app.get('/api/hello', (_req, res) => {
  res.json({ message: 'Hello from Vessel backend' })
})

app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://0.0.0.0:${port}`)
})
