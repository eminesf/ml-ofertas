import './env'
import express from 'express'
import cors from 'cors'
import { startScheduler } from './jobs/scheduler'
import offersRouter from './api/routes/offers'
import postsRouter from './api/routes/posts'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api/offers', offersRouter)
app.use('/api/posts', postsRouter)

app.get('/health', (_, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`[Server] Rodando em http://localhost:${PORT}`)
  startScheduler()
})

