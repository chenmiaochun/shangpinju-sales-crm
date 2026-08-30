// 案例库冒烟：直写库临时建冒烟账号（普通 INSERT 安全）→ 走 API 全链路 → 清理
import { DatabaseSync } from 'node:sqlite'
import { scryptSync, randomBytes } from 'node:crypto'

const DB_PATH = 'C:/Users/Administrator/Documents/销售软件/server/data/sales.sqlite'
const BASE = 'http://127.0.0.1:3001'
const ORIGIN = 'http://localhost:5173'
const USERNAME = 'smoke-case'
const PASSWORD = 'smoke-case-246810'

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

const db = new DatabaseSync(DB_PATH)
const at = new Date().toISOString()
const accountId = `account-smoke-${Date.now()}`
db.prepare('INSERT INTO auth_accounts(id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles) VALUES(?, ?, ?, ?, ?, 1, 0, ?, ?, ?, 0, ?, ?)')
  .run(accountId, USERNAME, hashPassword(PASSWORD), '冒烟临时', 'sales', at, at, '', JSON.stringify(['customers.own', 'tasks.own']), JSON.stringify(['sales']))
console.log('临时冒烟账号已创建 →', USERNAME)

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

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
let caseId = ''
try {
  const anon = await call('/api/cases')
  console.log('未登录 /api/cases →', anon.status, '(期望 401)')

  const login = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) })
  console.log('登录冒烟账号 →', login.status, login.body?.user?.name || login.body?.error?.code)

  const upload = await call('/api/files', { method: 'POST', body: JSON.stringify({ name: 'smoke.png', dataUrl: png, type: 'image/png', ownerId: USERNAME, category: 'case-media' }) })
  console.log('上传图片 →', upload.status, upload.body?.file?.url || upload.body?.error?.code)
  const file = upload.body?.file

  const create = await call('/api/cases', { method: 'POST', body: JSON.stringify({ title: '冒烟测试案例', category: '客户实拍', productNames: ['测试产品'], customerName: '测试客户', note: 'smoke', images: [{ id: file.id, name: file.name, type: file.type, url: file.url, size: file.size }] }) })
  console.log('创建案例 →', create.status, create.body?.case?.id || create.body?.error?.code)
  caseId = create.body?.case?.id || ''

  const list = await call('/api/cases')
  console.log('案例列表 →', list.status, '共', list.body?.cases?.length, '条')

  if (caseId) {
    const patch = await call(`/api/cases/${encodeURIComponent(caseId)}`, { method: 'PATCH', body: JSON.stringify({ status: '已隐藏' }) })
    console.log('隐藏案例(作者本人) →', patch.status, patch.body?.case?.status || patch.body?.error?.code)
    const del = await call(`/api/cases/${encodeURIComponent(caseId)}`, { method: 'DELETE' })
    console.log('删除案例(作者本人) →', del.status)
  }
} finally {
  db.prepare('DELETE FROM auth_sessions WHERE account_id = ?').run(accountId)
  db.prepare('DELETE FROM auth_accounts WHERE id = ?').run(accountId)
  console.log('临时冒烟账号已清理')
  db.close()
}
