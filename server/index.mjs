import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SalesDatabase } from './database.mjs'
import { createApiServer } from './app.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(process.env.SALES_DATA_DIR || join(here, 'data'))
mkdirSync(dataDir, { recursive: true })
const database = new SalesDatabase(join(dataDir, 'sales.sqlite'))
const generatedPassword = process.env.SALES_ADMIN_PASSWORD || randomBytes(12).toString('base64url')
const initialAdmin = database.ensureInitialAdmin({ username: process.env.SALES_ADMIN_USERNAME || 'admin', password: generatedPassword, name: process.env.SALES_ADMIN_NAME || '店长' })
if (initialAdmin) console.log(`Initial manager created. Username: ${initialAdmin.username}; temporary password: ${generatedPassword}; change it after signing in.`)
const server = createApiServer({
  database,
  uploadDir: join(dataDir, 'uploads'),
  maxBodyBytes: Number(process.env.SALES_MAX_BODY_BYTES || 20 * 1_048_576),
  corsOrigin: process.env.SALES_CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',
  secureCookies: process.env.NODE_ENV === 'production',
  sessionTtlMs: Number(process.env.SALES_SESSION_TTL_MS || 8 * 60 * 60 * 1000),
})
const port = Number(process.env.PORT || 3001)
server.listen(port, () => console.log(`Sales data API listening on http://localhost:${port}`))

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received, shutting down`)
  server.close(() => { database.close(); process.exit(0) })
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
