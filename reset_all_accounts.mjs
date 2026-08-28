import { DatabaseSync } from 'node:sqlite'
import { randomBytes, scryptSync } from 'node:crypto'
import { resolve } from 'node:path'

const file = resolve('server/data/sales.sqlite')
const db = new DatabaseSync(file)
db.exec('PRAGMA busy_timeout = 8000;')

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

const NEW_PW = 'SpjTest@2026'
const at = new Date().toISOString()
const hash = hashPassword(NEW_PW)

const rows = db.prepare('SELECT id, username, name, role FROM auth_accounts').all()
console.log('ACCOUNTS BEFORE RESET:', JSON.stringify(rows, null, 2))

const stmt = db.prepare('UPDATE auth_accounts SET password_hash=?, must_change_password=0, updated_at=? WHERE id=?')
let count = 0
for (const r of rows) {
  stmt.run(hash, at, r.id)
  count++
  console.log(`RESET: ${r.username} (${r.name}/${r.role}) -> ${NEW_PW}`)
}

db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
console.log(`DONE. Reset ${count} accounts to password: ${NEW_PW}`)
