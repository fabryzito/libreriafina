import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import routes from './routes/index.js'

const app = express()

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN,
    credentials: true,
  }),
)
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'libreria-api' })
})

app.use('/api', routes)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor' })
})

export default app
