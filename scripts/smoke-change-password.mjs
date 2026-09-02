// 冒烟：员工自助改密（临时账号自清理）
import { DatabaseSync } from 'node:sqlite'
import { scryptSync, randomBytes } from 'node:crypto'

const DB_PATH = 'C:/Users/Administrator/Documents/销售软件/server/data/sales.sqlite'
const BASE = 'http://127.0.0.1:3001'
const ORIGIN = 'http://localhost:5173'
const USERNAME = `smoke-pwd-${Date.now()}`
const OLD = 'temp-old-1234'
const NEW = '246810'

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

const db = new DatabaseSync(DB_PATH)
try { db.prepare("DELETE FROM auth_accounts WHERE username LIKE 'smoke-pwd-%'").run() } catch {}
const at = new Date().toISOString()
const accountId = `account-pwd-${Date.now()}`
db.prepare('INSERT INTO auth_accounts(id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles) VALUES(?, ?, ?, ?, ?, 1, 0, ?, ?, ?, 0, ?, ?)')
  .run(accountId, USERNAME, hashPassword(OLD), '冒烟改密', 'sales', at, at, '', JSON.stringify(['tasks.own', 'customers.own']), JSON.stringify(['sales']))

let cookie = ''
async function call(path, options = {}) {
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      origin: ORIGIN,
      ...(cookie ? { cookie } : {}),
      ...(options.headers || {}),
    },
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  let body = null
  try { body = await res.json() } catch { /* empty */ }
  return { status: res.status, body }
}

try {
  // 未登录改密 → 401
  const anon = await call('/api/auth/change-password', { method: 'POST', cookie: false, body: JSON.stringify({ oldPassword: OLD, newPassword: NEW }) })
  console.log('未登录改密 →', anon.status, '(期望 401)')

  const login = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: OLD }) })
  console.log('登录 →', login.status)

  // 当前密码错误 → 400
  const wrong = await call('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: 'wrong-pass-9999', newPassword: NEW }) })
  console.log('旧密码错误改密 →', wrong.status, wrong.body?.error?.message || '')

  // 正常改密 → 200
  const ok = await call('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: OLD, newPassword: NEW }) })
  console.log('正常改密 →', ok.status)

  // 新密码登录 / 旧密码失效
  const relogin = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: NEW }) })
  console.log('新密码登录 →', relogin.status, '(期望 200)')
  const stale = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: OLD }) })
  console.log('旧密码登录 →', stale.status, '(期望 401)')
} finally {
  db.prepare('DELETE FROM auth_sessions WHERE account_id = ?').run(accountId)
  db.prepare('DELETE FROM auth_accounts WHERE id = ?').run(accountId)
  console.log('临时账号已清理')
  db.close()
}
