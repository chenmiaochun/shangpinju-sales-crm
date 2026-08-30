import { DatabaseSync } from 'node:sqlite'
import { scryptSync, randomBytes } from 'node:crypto'

const db = new DatabaseSync('server/data/sales.sqlite')

function hashPassword(pwd) {
  const salt = randomBytes(16)
  const hash = scryptSync(pwd, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

const rows = db.prepare('SELECT id, username, name, role, active, custom_permissions FROM auth_accounts ORDER BY role, username').all()
console.log('TOTAL', rows.length)
for (const r of rows) {
  console.log(JSON.stringify({ username: r.username, name: r.name, role: r.role, active: r.active }))
}

const TEST_PWD = '123456'
const newHash = hashPassword(TEST_PWD)
const update = db.prepare('UPDATE auth_accounts SET password_hash = ?, must_change_password = 0, active = 1')
const result = update.run(newHash)
console.log('RESET_ROWS', result.changes, 'PWD', TEST_PWD)

db.close()
