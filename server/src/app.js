import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import mongoose from 'mongoose'
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'
import healthLogsRoutes from './routes/healthLogs.js'
import recommendationsRoutes from './routes/recommendations.js'
import analyticsRoutes from './routes/analytics.js'
import notificationsRoutes from './routes/notifications.js'
import reportsRoutes from './routes/reports.js'
import settingsRoutes from './routes/settings.js'

const app = express()
const allowedOrigins = new Set([process.env.CLIENT_URL, ...(process.env.CLIENT_URLS || '').split(',')].filter(Boolean))

app.use(cors({
  origin(origin, callback) {
    const localOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    if (!origin || allowedOrigins.has(origin) || localOrigin) return callback(null, true)
    return callback(new Error(`Origin ${origin} not allowed by CORS`))
  },
  credentials: true,
}))
app.use(helmet())
app.use(morgan('dev'))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_req, res) => res.status(200).json({
  status: 'ok',
  message: 'Healthcare API is running',
  database: mongoose.connection.readyState === 1 ? 'mongo' : 'memory',
}))

app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api/health-logs', healthLogsRoutes)
app.use('/api/recommendations', recommendationsRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/reports', reportsRoutes)
app.use('/api/settings', settingsRoutes)

app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found.' }))
app.use((error, _req, res, _next) => {
  if (error.status === 400 || error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Request body contains invalid JSON.' })
  if (error.name === 'ValidationError') return res.status(400).json({ message: error.message })
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier or value.' })
  if (error.message?.includes('not allowed by CORS')) return res.status(403).json({ message: 'Origin not allowed.' })
  console.error(error.message)
  return res.status(500).json({ message: 'Something went wrong.' })
})

export default app
