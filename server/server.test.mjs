import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { SalesDatabase } from './database.mjs'
import { createApiServer } from './app.mjs'

let database, server, base
before(async () => {
  database = new SalesDatabase(':memory:')
  database.ensureInitialAdmin({ username: 'manager', password: 'manager-password-1', name: '店长' })
  database.createAccount({ username: 'sales', password: 'sales-password-12', name: '销售一', role: 'sales', mustChangePassword: false })
  server = createApiServer({ database, maxBodyBytes: 256 })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => { await new Promise(resolve => server.close(resolve)); database.close() })

let managerCookie = '', salesCookie = ''
const json = (path, options = {}) => fetch(base + path, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.cookie === false ? {} : managerCookie ? { cookie: managerCookie } : {}), ...(options.headers || {}) } }).then(async r => ({ status: r.status, body: r.status === 204 ? null : await r.json(), headers: r.headers }))
const put = (path, body, options = {}) => json(path, { ...options, method: 'PUT', body: JSON.stringify(body) })

test('authentication requires valid credentials and issues an HttpOnly cookie', async () => {
  const anonymous = await json('/api/state', { cookie: false })
  assert.equal(anonymous.status, 401)
  const wrong = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'manager', password: 'wrong-password' }), cookie: false })
  assert.equal(wrong.status, 401); assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS')
  const login = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'manager', password: 'manager-password-1' }), cookie: false })
  assert.equal(login.status, 200); assert.equal(login.body.user.role, 'manager')
  managerCookie = login.headers.get('set-cookie').split(';')[0]
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i); assert.match(login.headers.get('set-cookie'), /SameSite=Lax/i)
  const sales = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'sales', password: 'sales-password-12' }), cookie: false })
  salesCookie = sales.headers.get('set-cookie').split(';')[0]
  const me = await json('/api/auth/me')
  assert.equal(me.status, 200); assert.equal(me.body.user.username, 'manager')
})

test('manager can create, disable and reset accounts', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'designer', password: 'designer-pass-123', name: '设计一', role: 'designer', permissions: ['customers.own', 'customers.design', 'tasks.own'] }) })
  assert.equal(created.status, 201); assert.equal(created.body.account.username, 'designer')
  assert.deepEqual(created.body.account.permissions, ['customers.own', 'customers.design', 'tasks.own'])
  const listed = await json('/api/accounts'); assert.equal(listed.status, 200); assert.ok(listed.body.accounts.some(item => item.username === 'designer'))
  const disabled = await json(`/api/accounts/${created.body.account.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: false }) })
  assert.equal(disabled.status, 200); assert.equal(disabled.body.account.active, false)
  const reset = await json(`/api/accounts/${created.body.account.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: 'new-designer-pass-123' }) })
  assert.equal(reset.status, 200); assert.equal(reset.body.ok, true)
  const updated = await json(`/api/accounts/${created.body.account.id}`, { method: 'PATCH', body: JSON.stringify({ username: 'designer2', name: '设计二', role: 'designer', phone: '13800138000', permissions: ['customers.own', 'tasks.own', 'conversation.analysis'] }) })
  assert.equal(updated.status, 200); assert.equal(updated.body.account.phone, '13800138000')
  assert.deepEqual(updated.body.account.permissions, ['customers.own', 'tasks.own', 'conversation.analysis'])
  const removed = await json(`/api/accounts/${created.body.account.id}`, { method: 'DELETE' })
  assert.equal(removed.status, 204)
})

test('employees can list active designers without account secrets', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'design-directory', password: 'designer-pass-123', name: '方案设计师', role: 'designer' }) })
  const listed = await json('/api/designers', { headers: { cookie: salesCookie } })
  assert.equal(listed.status, 200)
  assert.ok(listed.body.designers.some(item => item.id === created.body.account.id && item.name === '方案设计师'))
  assert.equal(JSON.stringify(listed.body).includes('password'), false)
})

test('sales designers appear in both sales and designer directories', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'sales-designer', password: 'sales-design-pass', name: '销售设计师', role: 'sales', canDesign: true }) })
  assert.equal(created.body.account.canDesign, true)
  const designers = await json('/api/designers', { headers: { cookie: salesCookie } })
  const salespeople = await json('/api/salespeople', { headers: { cookie: salesCookie } })
  assert.ok(designers.body.designers.some(item => item.id === created.body.account.id))
  assert.ok(salespeople.body.salespeople.some(item => item.id === created.body.account.id))
})

test('multi-position employees appear in every matching assignment directory', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'multi-role', password: 'multi-role-pass-123', name: '多岗位员工', role: 'sales', roles: ['sales', 'designer', 'aftersales'] }) })
  assert.equal(created.status, 201)
  assert.deepEqual(created.body.account.roles, ['sales', 'designer', 'aftersales'])
  const [salespeople, designers, delivery] = await Promise.all([
    json('/api/salespeople', { headers: { cookie: salesCookie } }),
    json('/api/designers', { headers: { cookie: salesCookie } }),
    json('/api/delivery-staff', { headers: { cookie: salesCookie } }),
  ])
  assert.ok(salespeople.body.salespeople.some(item => item.id === created.body.account.id))
  assert.ok(designers.body.designers.some(item => item.id === created.body.account.id))
  assert.ok(delivery.body.deliveryStaff.some(item => item.id === created.body.account.id))
})

test('keeps the selected primary role ahead of auxiliary roles', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'primary-operations', password: 'primary-role-pass', name: '主客服辅销售', role: 'operations', roles: ['operations', 'sales', 'designer'] }) })
  assert.equal(created.status, 201)
  assert.equal(created.body.account.role, 'operations')
  assert.deepEqual(created.body.account.roles, ['operations', 'sales', 'designer'])
})

test('manager can register operations and aftersales employees', async () => {
  for (const role of ['operations', 'aftersales']) {
    const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: `${role}-user`, password: `${role}-password-123`, name: role, role }) })
    assert.equal(created.status, 201); assert.equal(created.body.account.role, role)
  }
})

test('employees can list active delivery staff', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'delivery-directory', password: 'delivery-pass-123', name: '配送专员', role: 'aftersales' }) })
  const listed = await json('/api/delivery-staff', { headers: { cookie: salesCookie } })
  assert.equal(listed.status, 200)
  assert.ok(listed.body.deliveryStaff.some(item => item.id === created.body.account.id && item.name === '配送专员'))
})

test('health and CORS', async () => { const r = await json('/api/health'); assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.headers.get('access-control-allow-origin'), '*') })
test('state round trip and audit', async () => {
  assert.deepEqual((await put('/api/state', { pipeline: ['new'] })).body.value, { pipeline: ['new'] })
  assert.deepEqual((await json('/api/state')).body.value, { pipeline: ['new'] })
  const audit = await json('/api/audit?limit=20&offset=0'); assert.ok(audit.body.total >= 1); assert.ok(audit.body.items.some(item => item.resource === 'state'))
})
test('members and integrations round trip', async () => {
  assert.deepEqual((await put('/api/members', { members: [{ id: 'u1', name: 'Li' }] })).body.members, [{ id: 'u1', name: 'Li' }])
  assert.deepEqual((await put('/api/integrations', { integrations: { crm: { enabled: true } } })).body.integrations, { crm: { enabled: true } })
})

test('integration secrets are stored but never returned', async () => {
  const saved = await put('/api/integrations', { integrations: { wechat: { corpId: 'corp', secret: 'private-value' } } })
  assert.deepEqual(saved.body.integrations, { wechat: { corpId: 'corp', secretConfigured: true } })
  const fetched = await json('/api/integrations')
  assert.equal(JSON.stringify(fetched.body).includes('private-value'), false)
  const backup = await json('/api/backup')
  assert.equal(JSON.stringify(backup.body).includes('private-value'), false)
  assert.equal(JSON.stringify(backup.body).includes('password_hash'), false)
  assert.equal(JSON.stringify(backup.body).includes('auth_sessions'), false)
  const updated = await put('/api/integrations', { integrations: { wechat: { corpId: 'corp-2', secretConfigured: true } } })
  assert.equal(updated.body.integrations.wechat.secretConfigured, true)
})
test('role checks reject manager-only APIs', async () => {
  const audit = await json('/api/audit', { headers: { cookie: salesCookie } })
  assert.equal(audit.status, 403); assert.equal(audit.body.error.code, 'FORBIDDEN')
  const backup = await json('/api/backup', { headers: { cookie: salesCookie } })
  assert.equal(backup.status, 403)
  assert.equal((await json('/api/state', { headers: { cookie: salesCookie } })).status, 200)
})
test('logout revokes the session', async () => {
  const login = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'manager', password: 'manager-password-1' }), cookie: false })
  const sessionCookie = login.headers.get('set-cookie').split(';')[0]
  const logout = await json('/api/auth/logout', { method: 'POST', headers: { cookie: sessionCookie } })
  assert.equal(logout.status, 204); assert.match(logout.headers.get('set-cookie'), /Max-Age=0/)
  const expired = await json('/api/auth/me', { headers: { cookie: sessionCookie } })
  assert.equal(expired.status, 401)
})
test('cross-site unsafe requests are rejected', async () => {
  const response = await json('/api/state', { method: 'PUT', body: JSON.stringify({ unsafe: true }), headers: { 'sec-fetch-site': 'cross-site' } })
  assert.equal(response.status, 403); assert.equal(response.body.error.code, 'ORIGIN_FORBIDDEN')
})
test('backup can restore prior data', async () => {
  const backup = (await json('/api/backup')).body
  await put('/api/state', { changed: true })
  const restored = await json('/api/restore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(backup) })
  assert.equal(restored.status, 200); assert.deepEqual((await json('/api/state')).body.value, { pipeline: ['new'] })
})
test('returns structured validation and size errors', async () => {
  const duplicate = await put('/api/members', [{ id: 'x' }, { id: 'x' }]); assert.equal(duplicate.status, 400); assert.equal(duplicate.body.error.code, 'VALIDATION_ERROR')
  const large = await put('/api/state', { text: 'x'.repeat(300) }); assert.equal(large.status, 413); assert.equal(large.body.error.code, 'PAYLOAD_TOO_LARGE')
  assert.equal((await json('/missing')).body.error.code, 'NOT_FOUND')
})
