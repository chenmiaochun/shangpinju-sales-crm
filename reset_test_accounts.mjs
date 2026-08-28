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

const rows = db.prepare('SELECT id, username, name, role, roles, active, must_change_password FROM auth_accounts').all()
console.log('ACCOUNTS:', JSON.stringify(rows, null, 2))

const BOSS_PW = 'AcceptTest-2026'
const EMP_PW = 'AcceptTest-2026'
const at = new Date().toISOString()

// Reset boss (manager) password
const boss = rows.find((r) => r.role === 'manager') || rows[0]
if (boss) {
  db.prepare('UPDATE auth_accounts SET password_hash=?, must_change_password=0 WHERE id=?').run(hashPassword(BOSS_PW), boss.id)
  console.log('RESET BOSS:', boss.username, '->', BOSS_PW)
}

// Ensure an employee (sales) account with known password
let emp = rows.find((r) => r.role === 'sales')
if (emp) {
  db.prepare('UPDATE auth_accounts SET password_hash=?, must_change_password=0 WHERE id=?').run(hashPassword(EMP_PW), emp.id)
  console.log('RESET EMP:', emp.username, '->', EMP_PW)
} else {
  const id = 'account-' + randomBytes(8).toString('hex')
  db.prepare(
    "INSERT INTO auth_accounts(id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, 'spjtest', hashPassword(EMP_PW), '测试销售', 'sales', 1, 0, at, at, '', 0, null, JSON.stringify(['sales']))
  console.log('CREATED EMP: spjtest ->', EMP_PW)
}

db.exec('PRAGMA wal_checkpoint(TRUNCATE);')
console.log('DONE')
