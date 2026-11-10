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

test('manager can register frontline and back-office employees', async () => {
  for (const role of ['operations', 'aftersales', 'purchasing', 'warehouse', 'finance', 'cashier']) {
    const permissions = role === 'warehouse' ? ['inventory.manage', 'inventory.receive', 'inventory.issue'] : undefined
    const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: `${role}-user`, password: `${role}-password-123`, name: role, role, permissions }) })
    assert.equal(created.status, 201); assert.equal(created.body.account.role, role)
    if (permissions) assert.deepEqual(created.body.account.permissions, permissions)
  }
})

test('employees can list active delivery staff', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'delivery-directory', password: 'delivery-pass-123', name: '配送专员', role: 'aftersales' }) })
  const listed = await json('/api/delivery-staff', { headers: { cookie: salesCookie } })
  assert.equal(listed.status, 200)
  assert.ok(listed.body.deliveryStaff.some(item => item.id === created.body.account.id && item.name === '配送专员'))
})

test('health and CORS', async () => { const r = await json('/api/health'); assert.equal(r.status, 200); assert.equal(r.body.ok, true); assert.equal(r.headers.get('access-control-allow-origin'), '*') })
test('public experience intake creates a CRM lead without exposing state', async () => {
  const submitted = await json('/api/public/experience-intake', { method:'POST', cookie:false, body:JSON.stringify({ name:'林女士', phone:'13800138000', housingStage:'已入住焕新', familyMembers:['夫妻'], focusSpaces:['客厅'], painPoints:['空间不好用'], sleepNeeds:[], preferredStations:['家具与动线体验'], consent:true }) })
  assert.equal(submitted.status, 201); assert.match(submitted.body.leadId, /^L-/); assert.deepEqual(submitted.body.recommendedStations, ['家具与动线体验', '重点空间诊断'])
  const state = (await json('/api/state')).body.value
  const customer = state.customers.find(item => item.leadId === submitted.body.leadId)
  assert.equal(customer.phone, '13800138000'); assert.equal(customer.salesperson, '待分配'); assert.equal(customer.experienceAssessment.status, '待体验')
})
test('public experience intake validates consent and mobile phone', async () => {
  const rejected = await json('/api/public/experience-intake', { method:'POST', cookie:false, body:JSON.stringify({ name:'测试', phone:'123', consent:false }) })
  assert.equal(rejected.status, 400); assert.equal(rejected.body.error.code, 'VALIDATION_ERROR')
})
test('state round trip and audit', async () => {
  assert.deepEqual((await put('/api/state', { pipeline: ['new'] })).body.value, { pipeline: ['new'] })
  assert.deepEqual((await json('/api/state')).body.value, { pipeline: ['new'] })
  const audit = await json('/api/audit?limit=20&offset=0'); assert.ok(audit.body.total >= 1); assert.ok(audit.body.items.some(item => item.resource === 'state'))
})
test('preserves concurrently added activity customers during full-state saves', async () => {
  await put('/api/state', { customers: [{ id: 'c-a', name: '客户A', createdAt: '2026-08-15T09:00:00.000Z', updatedAt: '2026-08-15T09:00:00.000Z' }], followUps: [] })
  const saved = await put('/api/state', { customers: [{ id: 'c-b', name: '客户B', createdAt: '2026-08-15T09:01:00.000Z', updatedAt: '2026-08-15T09:01:00.000Z' }], followUps: [] })
  assert.deepEqual(saved.body.value.customers.map(item => item.id).sort(), ['c-a', 'c-b'])
  await put('/api/state', { pipeline: ['new'] })
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
test('employees change their own password only after proving the current one', async () => {
  const created = await json('/api/accounts', { method: 'POST', body: JSON.stringify({ username: 'pwd-user', password: 'old-pass-1234', name: '改密测试', role: 'sales', mustChangePassword: false }) })
  assert.equal(created.status, 201)
  const login = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'pwd-user', password: 'old-pass-1234' }), cookie: false })
  const userCookie = login.headers.get('set-cookie').split(';')[0]
  // 匿名不能改密
  const anon = await json('/api/auth/change-password', { method: 'POST', cookie: false, body: JSON.stringify({ oldPassword: 'x123456', newPassword: 'y123456' }) })
  assert.equal(anon.status, 401)
  // 当前密码错误 → 拒绝
  const wrong = await json('/api/auth/change-password', { method: 'POST', headers: { cookie: userCookie }, body: JSON.stringify({ oldPassword: 'wrong-123456', newPassword: 'new-pass-5678' }) })
  assert.equal(wrong.status, 400)
  // 弱密码 → 拒绝
  const weak = await json('/api/auth/change-password', { method: 'POST', headers: { cookie: userCookie }, body: JSON.stringify({ oldPassword: 'old-pass-1234', newPassword: '123' }) })
  assert.equal(weak.status, 400)
  // 与原密码相同 → 拒绝
  const same = await json('/api/auth/change-password', { method: 'POST', headers: { cookie: userCookie }, body: JSON.stringify({ oldPassword: 'old-pass-1234', newPassword: 'old-pass-1234' }) })
  assert.equal(same.status, 400)
  // 正常修改
  const ok = await json('/api/auth/change-password', { method: 'POST', headers: { cookie: userCookie }, body: JSON.stringify({ oldPassword: 'old-pass-1234', newPassword: 'new-pass-5678' }) })
  assert.equal(ok.status, 200)
  // 新密码可登录，旧密码失效
  const relogin = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'pwd-user', password: 'new-pass-5678' }), cookie: false })
  assert.equal(relogin.status, 200)
  const stale = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'pwd-user', password: 'old-pass-1234' }), cookie: false })
  assert.equal(stale.status, 401)
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
test('any employee can upload cases; edit/delete limited to owner or manager', async () => {
  // 匿名不能访问
  const anonymous = await json('/api/cases', { cookie: false }); assert.equal(anonymous.status, 401)
  // 销售上传案例（带图片与关联产品；测试服务 maxBodyBytes=256，body 保持精简）
  const created = await json('/api/cases', { method: 'POST', headers: { cookie: salesCookie }, body: JSON.stringify({ title: '客厅全案案例', category: '成交案例', productNames: ['沙发'], images: [{ id: 'f1', name: 'a.png', type: 'image/png', url: '/api/files/f1', size: 10 }], note: '实拍' }) })
  assert.equal(created.status, 201); assert.equal(created.body.case.title, '客厅全案案例'); assert.equal(created.body.case.author, 'sales'); assert.equal(created.body.case.status, '已发布')
  // 所有人都能看
  const listed = await json('/api/cases', { headers: { cookie: salesCookie } })
  assert.equal(listed.status, 200); assert.ok(listed.body.cases.some(item => item.id === created.body.case.id))
  // 标题必填
  const invalid = await json('/api/cases', { method: 'POST', headers: { cookie: salesCookie }, body: JSON.stringify({ title: '' }) })
  assert.equal(invalid.status, 400); assert.equal(invalid.body.error.code, 'VALIDATION_ERROR')
  // 另一个销售不能改别人案例：建第二个销售账号
  database.createAccount({ username: 'sales2', password: 'sales-password-22', name: '销售二', role: 'sales', mustChangePassword: false })
  const otherLogin = await json('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'sales2', password: 'sales-password-22' }), cookie: false })
  const otherCookie = otherLogin.headers.get('set-cookie').split(';')[0]
  const forbidden = await json(`/api/cases/${created.body.case.id}`, { method: 'PATCH', headers: { cookie: otherCookie }, body: JSON.stringify({ title: '篡改' }) })
  assert.equal(forbidden.status, 403)
  // 作者本人可以改
  const patched = await json(`/api/cases/${created.body.case.id}`, { method: 'PATCH', headers: { cookie: salesCookie }, body: JSON.stringify({ status: '已隐藏' }) })
  assert.equal(patched.status, 200); assert.equal(patched.body.case.status, '已隐藏')
  // 店长可以删
  const removed = await json(`/api/cases/${created.body.case.id}`, { method: 'DELETE' })
  assert.equal(removed.status, 204)
  assert.equal((await json('/api/cases')).body.cases.some(item => item.id === created.body.case.id), false)
})


function leadBody(overrides = {}) {
  return {
    name: '林女士', phone: '13911112222', consent: true, cityArea: '揭阳', budget: '8-15万',
    products: ['沙发', '餐桌'], renovationProgress: '硬装收尾', source: '广告计划',
    conversionSource: '巨量广告-信息流', campaignId: '7234567890123456789', contentId: 'creative-88',
    adGroup: '素材组A', notes: '周末方便联系', landingPage: 'https://www.example.com/sofa',
    ...overrides,
  }
}

async function withLeadServer(options, run) {
  const db = new SalesDatabase(':memory:')
  let srv
  try {
    srv = createApiServer({ database: db, maxBodyBytes: 16 * 1024, websiteLeadToken: '', ...options })
    await new Promise(resolve => srv.listen(0, '127.0.0.1', resolve))
    const root = `http://127.0.0.1:${srv.address().port}`
    const call = (body, headers = {}) => fetch(root + '/api/public/website-lead-intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }).then(async response => ({ status: response.status, body: await response.json() }))
    return await run({ db, call, root })
  } finally {
    if (srv) await new Promise(resolve => srv.close(resolve))
    db.close()
  }
}

test('public website lead intake creates a CRM lead without login', async () => {
  await withLeadServer({}, async ({ db, call }) => {
    const created = await call(leadBody())
    assert.equal(created.status, 201)
    assert.equal(created.body.ok, true)
    assert.equal(created.body.already, false)
    assert.match(created.body.leadId, /^L-/)
    assert.ok(created.body.customerId)
    const customer = db.getState().value.customers.find(item => item.id === created.body.customerId)
    assert.equal(customer.phone, '13911112222')
    assert.equal(customer.campaignId, '7234567890123456789')
    assert.equal(customer.campaignId.startsWith('SPJ-'), false)
    assert.equal(customer.salesperson, '待分配')
    assert.equal(customer.stage, '新线索')
    assert.equal(customer.source, '广告计划')
    assert.equal(customer.conversionSource, '巨量广告-信息流')
    assert.equal(customer.contentId, 'creative-88')
    assert.equal(customer.adGroup, '素材组A')
    assert.equal(customer.landingPage, 'https://www.example.com/sofa')
    assert.deepEqual(customer.products, ['沙发', '餐桌'])
    assert.equal(customer.cityArea, '揭阳')
    const audit = db.getAudit(30, 0)
    assert.ok(audit.items.some(item => item.resource === 'public_website_lead_intake' && item.action === 'create' && item.details.leadId === created.body.leadId))

    const aliased = await call({ name: '王先生', phone: '13911118888', consent: true, project_id: 'project-raw-001' })
    assert.equal(aliased.status, 201)
    const aliasedCustomer = db.getState().value.customers.find(item => item.id === aliased.body.customerId)
    assert.equal(aliasedCustomer.campaignId, 'project-raw-001')
    assert.equal(aliasedCustomer.source, '官网留资')

    const preferred = await call(leadBody({ phone: '13911118889', campaignId: 'from-campaign', project_id: 'from-project' }))
    assert.equal(preferred.status, 201)
    assert.equal(db.getState().value.customers.find(item => item.phone === '13911118889').campaignId, 'from-campaign')
  })
})

test('public website lead intake returns the existing lead for the same phone', async () => {
  await withLeadServer({}, async ({ db, call }) => {
    const first = await call(leadBody({ phone: '13911117777' }))
    const second = await call(leadBody({ phone: '13911117777', notes: '再次咨询', campaignId: '999888777' }))
    assert.equal(second.status, 200)
    assert.equal(second.body.ok, true)
    assert.equal(second.body.already, true)
    assert.equal(second.body.leadId, first.body.leadId)
    assert.equal(second.body.customerId, first.body.customerId)
    const rows = db.getState().value.customers.filter(item => item.phone === '13911117777')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].campaignId, '7234567890123456789')
    assert.match(rows[0].notes, /再次咨询/)
    assert.match(rows[0].notes, /999888777/)

    db.setState({
      customers: [{
        id: 'cust-existing', leadId: 'L-EXISTING-1', name: '旧客户', phone: '+86 139-0000-2222', source: '抖音',
        salesperson: '陈婉珊', stage: '到店', intent: '中', expectedAmount: 0, products: [], style: '', budget: '待确认',
        renovationProgress: '', concerns: [], campaignId: 'SPJ-KEEP', notes: '原备注',
        lastContactAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01', updatedAt: '2026-08-01T00:00:00.000Z',
      }],
    })
    const again = await call(leadBody({ phone: '13900002222', name: '新名字', campaignId: '888777666555', notes: '第二次留资', source: '官网留资' }))
    assert.equal(again.status, 200)
    assert.equal(again.body.already, true)
    assert.equal(again.body.leadId, 'L-EXISTING-1')
    assert.equal(again.body.customerId, 'cust-existing')
    const matched = db.getState().value.customers.filter(item => String(item.phone || '').replace(/\D/g, '').endsWith('13900002222'))
    assert.equal(matched.length, 1)
    assert.equal(matched[0].campaignId, 'SPJ-KEEP')
    assert.equal(matched[0].name, '旧客户')
    assert.equal(matched[0].salesperson, '陈婉珊')
    assert.equal(matched[0].stage, '到店')
    assert.match(matched[0].notes, /原备注/)
    assert.match(matched[0].notes, /888777666555/)
    assert.match(matched[0].notes, /第二次留资/)
    const audit = db.getAudit(40, 0)
    assert.ok(audit.items.some(item => item.resource === 'public_website_lead_intake' && item.details.already === true && item.details.leadId === 'L-EXISTING-1'))
  })
})

test('public website lead intake rejects missing consent and invalid phones', async () => {
  await withLeadServer({}, async ({ db, call }) => {
    const noConsent = await call(leadBody({ consent: false, phone: '13911113333' }))
    assert.equal(noConsent.status, 400)
    assert.equal(noConsent.body.error.code, 'VALIDATION_ERROR')
    assert.match(noConsent.body.error.message, /consent/)
    const { consent: _consent, ...missingConsent } = leadBody({ phone: '13911113334' })
    const omitted = await call(missingConsent)
    assert.equal(omitted.status, 400)
    assert.equal(omitted.body.error.code, 'VALIDATION_ERROR')
    const badPhone = await call(leadBody({ phone: '12345', consent: true }))
    assert.equal(badPhone.status, 400)
    assert.match(badPhone.body.error.message, /phone/)
    const noName = await call(leadBody({ name: '   ', phone: '13911114444' }))
    assert.equal(noName.status, 400)
    assert.match(noName.body.error.message, /name/)
    const badSource = await call(leadBody({ source: '未知渠道', phone: '13911115555' }))
    assert.equal(badSource.status, 400)
    assert.match(badSource.body.error.message, /source/)
    assert.equal(db.getState().value.customers?.length || 0, 0)
  })
})

test('public website lead intake rate limits by IP', async () => {
  await withLeadServer({ publicIntakeLimit: 2, publicIntakeWindowMs: 60_000 }, async ({ db, call }) => {
    const invalid = await call(leadBody({ phone: '12', consent: true }))
    assert.equal(invalid.status, 400)
    const first = await call(leadBody({ phone: '13911110001' }))
    const second = await call(leadBody({ phone: '13911110002' }))
    const third = await call(leadBody({ phone: '13911110003' }))
    assert.equal(first.status, 201)
    assert.equal(second.status, 201)
    assert.equal(third.status, 429)
    assert.equal(third.body.error.code, 'INTAKE_RATE_LIMITED')
    const phones = (db.getState().value.customers || []).map(item => item.phone)
    assert.deepEqual(phones.filter(phone => String(phone).startsWith('1391111000')).sort(), ['13911110001', '13911110002'])
  })
})

test('website lead intake checks X-Lead-Token only when configured', async () => {
  await withLeadServer({ websiteLeadToken: 'secret-token' }, async ({ call }) => {
    const missing = await call(leadBody({ phone: '13911110011' }))
    assert.equal(missing.status, 401)
    assert.equal(missing.body.error.code, 'LEAD_TOKEN_REQUIRED')
    const wrong = await call(leadBody({ phone: '13911110012' }), { 'x-lead-token': 'nope' })
    assert.equal(wrong.status, 401)
    assert.equal(wrong.body.error.code, 'LEAD_TOKEN_INVALID')
    const ok = await call(leadBody({ phone: '13911110013' }), { 'x-lead-token': 'secret-token' })
    assert.equal(ok.status, 201)
    assert.equal(ok.body.already, false)
  })
})

test('website lead intake accepts server-side posts without an Origin header', async () => {
  await withLeadServer({ corsOrigin: 'http://localhost:5173' }, async ({ call, root }) => {
    const created = await call(leadBody({ phone: '13911110021', source: '官网留资' }))
    assert.equal(created.status, 201)
    assert.equal(created.body.ok, true)
    const denied = await fetch(root + '/api/public/website-lead-intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.example' },
      body: JSON.stringify(leadBody({ phone: '13911110022' })),
    })
    assert.equal(denied.status, 403)
    const body = await denied.json()
    assert.equal(body.error.code, 'ORIGIN_FORBIDDEN')
  })
})
