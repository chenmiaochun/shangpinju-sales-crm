import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { lanOrigins } from './lan.mjs'

const JSON_TYPE = { 'content-type': 'application/json; charset=utf-8' }
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const SESSION_COOKIE = 'sales_session'

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=')
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))]
  }))
}

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details }
}

function validateMembers(value) {
  const items = Array.isArray(value) ? value : value?.members
  if (!Array.isArray(items)) throw new ApiError(400, 'VALIDATION_ERROR', 'members must be an array')
  const ids = new Set()
  for (const [index, item] of items.entries()) {
    if (!isObject(item) || typeof item.id !== 'string' || !item.id.trim()) throw new ApiError(400, 'VALIDATION_ERROR', `members[${index}].id must be a non-empty string`)
    if (ids.has(item.id)) throw new ApiError(400, 'VALIDATION_ERROR', `duplicate member id: ${item.id}`)
    ids.add(item.id)
  }
  return items
}

function validateIntegrations(value) {
  const settings = isObject(value?.integrations) ? value.integrations : value
  if (!isObject(settings)) throw new ApiError(400, 'VALIDATION_ERROR', 'integrations must be an object')
  for (const name of Object.keys(settings)) if (!name.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'integration names must be non-empty')
  return settings
}

function publicIntegrations(settings) {
  return Object.fromEntries(Object.entries(settings).map(([name, value]) => {
    if (!isObject(value) || !Object.prototype.hasOwnProperty.call(value, 'secret')) return [name, value]
    const { secret: _secret, ...publicValue } = value
    return [name, { ...publicValue, secretConfigured: Boolean(_secret) }]
  }))
}

function mergeIntegrationSecrets(current, incoming) {
  return Object.fromEntries(Object.entries(incoming).map(([name, value]) => {
    const previous = current[name]
    if (isObject(value) && isObject(previous) && !Object.prototype.hasOwnProperty.call(value, 'secret') && Object.prototype.hasOwnProperty.call(previous, 'secret')) {
      return [name, { ...value, secret: previous.secret }]
    }
    return [name, value]
  }))
}

function validateBackup(value) {
  if (!isObject(value) || value.version !== 1 || !isObject(value.state) || !isObject(value.integrations)) throw new ApiError(400, 'VALIDATION_ERROR', 'invalid version 1 backup')
  return { version: 1, state: value.state, members: validateMembers(value.members), integrations: validateIntegrations(value.integrations) }
}

const cleanText = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : ''
const cleanList = (value, maxItems = 12, maxLength = 60) => Array.isArray(value) ? value.map(item => cleanText(item, maxLength)).filter(Boolean).slice(0, maxItems) : []
const EXPERIENCE_STATIONS = ['家具与动线体验', '重点空间诊断', '全家睡眠体验']

function validateExperienceIntake(value) {
  if (!isObject(value) || value.consent !== true) throw new ApiError(400, 'VALIDATION_ERROR', 'consent is required')
  const name = cleanText(value.name, 40), phone = cleanText(value.phone, 30)
  if (!name || !/^1\d{10}$/.test(phone)) throw new ApiError(400, 'VALIDATION_ERROR', 'name and a valid mobile phone are required')
  const preferredStations = cleanList(value.preferredStations, 3).filter(item => EXPERIENCE_STATIONS.includes(item))
  return {
    name, phone, preferredStations,
    cityArea: cleanText(value.cityArea, 40), houseLayout: cleanText(value.houseLayout, 60),
    houseArea: Number.isFinite(Number(value.houseArea)) && Number(value.houseArea) > 0 ? Math.min(2000, Number(value.houseArea)) : undefined,
    housingStage: cleanText(value.housingStage, 40) || '其他', familyMembers: cleanList(value.familyMembers),
    focusSpaces: cleanList(value.focusSpaces), painPoints: cleanList(value.painPoints), budget: cleanText(value.budget, 40) || '待确认',
    moveInPlan: cleanText(value.moveInPlan, 60), sleepNeeds: cleanList(value.sleepNeeds),
    source: cleanText(value.source, 40) || '活动扫码测评', contentId: cleanText(value.contentId, 80),
  }
}

function experienceRecommendation(input) {
  const recommended = []
  if (input.preferredStations.includes('家具与动线体验') || input.focusSpaces.some(item => ['客厅', '餐厅', '家具尺寸/摆放'].includes(item))) recommended.push('家具与动线体验')
  if (input.preferredStations.includes('重点空间诊断') || input.focusSpaces.length > 1 || input.painPoints.some(item => ['空间不好用', '收纳不足', '风格不统一'].includes(item))) recommended.push('重点空间诊断')
  if (input.preferredStations.includes('全家睡眠体验') || input.sleepNeeds.length || input.focusSpaces.some(item => ['主卧', '儿童房', '老人房'].includes(item))) recommended.push('全家睡眠体验')
  if (!recommended.length) recommended.push('重点空间诊断')
  return [...new Set(recommended)]
}

async function readJson(req, maxBodyBytes) {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json')
  let size = 0; const chunks = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > maxBodyBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', `request body exceeds ${maxBodyBytes} bytes`)
    chunks.push(chunk)
  }
  if (!size) throw new ApiError(400, 'INVALID_JSON', 'request body is required')
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiError(400, 'INVALID_JSON', 'request body is not valid JSON') }
}

export function createApiServer({ database, uploadDir = resolve('server/data/uploads'), maxBodyBytes = 20 * 1_048_576, corsOrigin = '*', sessionTtlMs = 8 * 60 * 60 * 1000, secureCookies = false, loginLimit = 5, loginWindowMs = 15 * 60 * 1000, publicIntakeLimit = 20, publicIntakeWindowMs = 60 * 60 * 1000 }) {
  mkdirSync(uploadDir, { recursive: true })
  const loginAttempts = new Map()
  const publicIntakeAttempts = new Map()
  return createServer(async (req, res) => {
    const requestOrigin = req.headers.origin
    // 除了显式配置的白名单，额外放行「本机当前所有局域网 IP + 前端端口」，
    // 这样路由器换 IP 后不用改配置、不用重启服务端（结果缓存 5 秒）。
    const configuredOrigins = corsOrigin === '*' ? [] : String(corsOrigin).split(',').map(value => value.trim()).filter(Boolean)
    const allowedOrigins = corsOrigin === '*' ? [] : [...new Set([...configuredOrigins, ...lanOrigins()])]
    const originAllowed = corsOrigin === '*' || Boolean(requestOrigin && allowedOrigins.includes(requestOrigin))
    const allowOrigin = corsOrigin === '*' ? '*' : originAllowed ? requestOrigin : allowedOrigins[0]
    const headers = { ...JSON_TYPE, 'access-control-allow-origin': allowOrigin, 'access-control-allow-methods': 'GET, PUT, POST, PATCH, OPTIONS', 'access-control-allow-headers': 'Content-Type', ...(allowOrigin === '*' ? {} : { 'access-control-allow-credentials': 'true', vary: 'Origin' }) }
    const send = (status, body, extra = {}) => { res.writeHead(status, { ...headers, ...extra }); res.end(body === undefined ? undefined : JSON.stringify(body)) }
    const cookie = (value, maxAge) => `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=${secureCookies ? 'None' : 'Lax'}; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    const crossSite = req.headers['sec-fetch-site'] === 'cross-site'
    if (requestOrigin && !originAllowed) return send(403, { error: { code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not allowed' } })
    if (unsafe && corsOrigin !== '*' && !requestOrigin) return send(403, { error: { code: 'ORIGIN_REQUIRED', message: 'Request origin is required' } })
    if (unsafe && corsOrigin === '*' && crossSite) return send(403, { error: { code: 'ORIGIN_FORBIDDEN', message: 'Request origin is not allowed' } })
    if (req.method === 'OPTIONS') return send(204)
    try {
      const url = new URL(req.url, 'http://localhost')
      if (req.method === 'GET' && url.pathname === '/api/health') return send(200, { ok: true, service: 'sales-data', timestamp: new Date().toISOString() })
      if (req.method === 'POST' && url.pathname === '/api/public/experience-intake') {
        const address = req.socket.remoteAddress || 'unknown', now = Date.now()
        const recent = (publicIntakeAttempts.get(address) || []).filter(at => now - at < publicIntakeWindowMs)
        if (recent.length >= publicIntakeLimit) throw new ApiError(429, 'INTAKE_RATE_LIMITED', 'Too many submissions; try again later')
        const input = validateExperienceIntake(await readJson(req, maxBodyBytes))
        recent.push(now); publicIntakeAttempts.set(address, recent)
        const at = new Date().toISOString(), stamp = at.slice(0, 10).replace(/-/g, ''), suffix = `${now}`.slice(-6)
        const leadId = `L-${stamp}-${suffix}`, assessmentId = `EXP-${stamp}-${suffix}`
        const recommendedStations = experienceRecommendation(input)
        const summary = `家庭成员：${input.familyMembers.join('、') || '待补充'}；重点空间：${input.focusSpaces.join('、') || '待确认'}；主要问题：${input.painPoints.join('、') || '待确认'}；建议体验：${recommendedStations.join('、')}`
        const state = database.getState().value
        const customer = {
          id: `lead-${now}`, leadId, campaignId: 'SPJ-2026-09', contentId: input.contentId || undefined,
          name: input.name, phone: input.phone, source: input.source, salesperson: '待分配', stage: '新线索', intent: '中', expectedAmount: 0,
          productLines: recommendedStations.flatMap(item => item === '家具与动线体验' ? ['原创家具'] : item === '重点空间诊断' ? ['整屋全案'] : ['雅兰睡眠']),
          products: [], style: '', budget: input.budget, renovationProgress: input.housingStage, concerns: input.painPoints,
          cityArea: input.cityArea || undefined, houseLayout: input.houseLayout || undefined, houseArea: input.houseArea,
          notes: '客户通过“尚品居10分钟家庭空间体验诊断”自主提交。', lastContactAt: at, createdAt: at.slice(0, 10), updatedAt: at,
          experienceAssessment: { assessmentId, submittedAt: at, housingStage: input.housingStage, familyMembers: input.familyMembers, focusSpaces: input.focusSpaces, painPoints: input.painPoints, moveInPlan: input.moveInPlan || undefined, sleepNeeds: input.sleepNeeds, preferredStations: input.preferredStations, recommendedStations, summary, status: '待体验' },
        }
        database.setState({ ...state, customers: [customer, ...(Array.isArray(state.customers) ? state.customers : [])] })
        database.record('create', 'public_experience_intake', { leadId, assessmentId })
        return send(201, { ok: true, leadId, assessmentId, recommendedStations, summary })
      }
      if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        const address = req.socket.remoteAddress || 'unknown', now = Date.now()
        const recent = (loginAttempts.get(address) || []).filter(at => now - at < loginWindowMs)
        if (recent.length >= loginLimit) throw new ApiError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts; try again later')
        const body = await readJson(req, maxBodyBytes)
        const account = database.authenticate(body?.username, body?.password)
        if (!account) {
          recent.push(now); loginAttempts.set(address, recent)
          database.record('login_failed', 'auth_session', { address })
          throw new ApiError(401, 'INVALID_CREDENTIALS', 'Username or password is incorrect')
        }
        loginAttempts.delete(address)
        const session = database.createSession(account.id, sessionTtlMs)
        return send(200, { user: account, expiresAt: session.expiresAt }, { 'set-cookie': cookie(session.token, Math.floor(sessionTtlMs / 1000)) })
      }
      const sessionToken = parseCookies(req.headers.cookie)[SESSION_COOKIE]
      const session = database.getSession(sessionToken)
      if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        database.revokeSession(sessionToken)
        return send(204, undefined, { 'set-cookie': cookie('', 0) })
      }
      if (!session) throw new ApiError(401, 'AUTH_REQUIRED', 'Authentication is required')
      const fileReadMatch = url.pathname.match(/^\/api\/files\/([a-zA-Z0-9-]+)$/)
      if (req.method === 'GET' && fileReadMatch) {
        const metadataPath = join(uploadDir, `${fileReadMatch[1]}.json`)
        if (!existsSync(metadataPath)) throw new ApiError(404, 'NOT_FOUND', 'File not found')
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'))
        const filePath = join(uploadDir, metadata.storedName)
        if (!existsSync(filePath)) throw new ApiError(404, 'NOT_FOUND', 'File not found')
        res.writeHead(200, { ...headers, 'content-type': metadata.type || 'application/octet-stream', 'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(metadata.name)}`, 'cache-control': 'private, max-age=3600' })
        return res.end(readFileSync(filePath))
      }
      if (req.method === 'POST' && url.pathname === '/api/files') {
        const body = await readJson(req, maxBodyBytes)
        const name = basename(String(body?.name || '')).slice(0, 180)
        const match = String(body?.dataUrl || '').match(/^data:([^;,]+)?;base64,(.+)$/s)
        if (!name || !match) throw new ApiError(400, 'VALIDATION_ERROR', 'A valid file is required')
        const bytes = Buffer.from(match[2], 'base64')
        if (!bytes.length || bytes.length > maxBodyBytes) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'File is empty or too large')
        const id = randomUUID(), extension = extname(name).replace(/[^.a-zA-Z0-9]/g, '').slice(0, 12)
        const storedName = `${id}${extension}`
        const metadata = { id, name, storedName, type: cleanText(body.type, 120) || match[1] || 'application/octet-stream', size: bytes.length, ownerId: cleanText(body.ownerId, 120), category: cleanText(body.category, 60), uploadedAt: new Date().toISOString() }
        writeFileSync(join(uploadDir, storedName), bytes)
        writeFileSync(join(uploadDir, `${id}.json`), JSON.stringify(metadata))
        database.record('upload', 'design_file', { fileId: id, ownerId: metadata.ownerId, name })
        return send(201, { file: { id, name, type: metadata.type, size: bytes.length, url: `/api/files/${id}`, uploadedAt: metadata.uploadedAt } })
      }
      if (req.method === 'GET' && url.pathname === '/api/auth/me') return send(200, { user: session.account, expiresAt: session.expiresAt })
      const hasRole = (account, role) => (account.roles || [account.role]).includes(role)
      const requireManager = () => { if (!hasRole(session.account, 'manager')) throw new ApiError(403, 'FORBIDDEN', 'Manager permission is required') }
      if (req.method === 'GET' && url.pathname === '/api/accounts') { requireManager(); return send(200, { accounts: database.listAccounts() }) }
      if (req.method === 'GET' && url.pathname === '/api/designers') return send(200, { designers: database.listAccounts().filter(item => hasRole(item, 'designer') && item.active) })
      if (req.method === 'GET' && url.pathname === '/api/salespeople') return send(200, { salespeople: database.listAccounts().filter(item => hasRole(item, 'sales') && item.active) })
      if (req.method === 'GET' && url.pathname === '/api/delivery-staff') return send(200, { deliveryStaff: database.listAccounts().filter(item => hasRole(item, 'aftersales') && item.active) })
      if (req.method === 'POST' && url.pathname === '/api/accounts') {
        requireManager()
        try { return send(201, { account: database.createAccount(await readJson(req, maxBodyBytes)) }) }
        catch (error) { throw new ApiError(String(error?.message).includes('UNIQUE') ? 409 : 400, 'ACCOUNT_INVALID', 'Account details are invalid or already used') }
      }
      const statusMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/status$/)
      if (req.method === 'PATCH' && statusMatch) { requireManager(); const body = await readJson(req, maxBodyBytes); return send(200, { account: database.setAccountActive(decodeURIComponent(statusMatch[1]), Boolean(body.active)) }) }
      const accountMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)$/)
      if (req.method === 'PATCH' && accountMatch) { requireManager(); try { return send(200, { account: database.updateAccount(decodeURIComponent(accountMatch[1]), await readJson(req, maxBodyBytes)) }) } catch (error) { throw new ApiError(String(error?.message).includes('UNIQUE') ? 409 : 400, 'ACCOUNT_INVALID', 'Account details are invalid or already used') } }
      if (req.method === 'DELETE' && accountMatch) { requireManager(); if (decodeURIComponent(accountMatch[1]) === session.account.id) throw new ApiError(400, 'ACCOUNT_INVALID', 'You cannot delete the account currently in use'); try { database.deleteAccount(decodeURIComponent(accountMatch[1])); return send(204) } catch { throw new ApiError(400, 'ACCOUNT_INVALID', 'This account cannot be deleted') } }
      const resetMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/reset-password$/)
      if (req.method === 'POST' && resetMatch) { requireManager(); const body = await readJson(req, maxBodyBytes); database.resetAccountPassword(decodeURIComponent(resetMatch[1]), body.password); return send(200, { ok: true }) }
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, database.getState())
      if (req.method === 'PUT' && url.pathname === '/api/state') { const body = await readJson(req, maxBodyBytes); if (!isObject(body)) throw new ApiError(400, 'VALIDATION_ERROR', 'state must be an object'); return send(200, database.setState(body)) }
      if (req.method === 'GET' && url.pathname === '/api/audit') {
        requireManager()
        const limit = Number(url.searchParams.get('limit') ?? 50), offset = Number(url.searchParams.get('offset') ?? 0)
        if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) throw new ApiError(400, 'VALIDATION_ERROR', 'limit must be 1..200 and offset must be non-negative')
        return send(200, database.getAudit(limit, offset))
      }
      if (req.method === 'GET' && url.pathname === '/api/backup') { requireManager(); const backup = database.backup(); return send(200, { ...backup, integrations: publicIntegrations(backup.integrations) }, { 'content-disposition': 'attachment; filename="sales-backup.json"' }) }
      if (req.method === 'POST' && url.pathname === '/api/restore') { requireManager(); return send(200, database.restore(validateBackup(await readJson(req, maxBodyBytes)))) }
      if (req.method === 'GET' && url.pathname === '/api/members') return send(200, { members: database.getMembers() })
      if (req.method === 'PUT' && url.pathname === '/api/members') { requireManager(); return send(200, { members: database.setMembers(validateMembers(await readJson(req, maxBodyBytes))) }) }
      if (req.method === 'GET' && url.pathname === '/api/integrations') { requireManager(); return send(200, { integrations: publicIntegrations(database.getIntegrations()) }) }
      if (req.method === 'PUT' && url.pathname === '/api/integrations') { requireManager(); const incoming = validateIntegrations(await readJson(req, maxBodyBytes)); const saved = database.setIntegrations(mergeIntegrationSecrets(database.getIntegrations(), incoming)); return send(200, { integrations: publicIntegrations(saved) }) }
      throw new ApiError(404, 'NOT_FOUND', 'API route not found')
    } catch (error) {
      const known = error instanceof ApiError
      if (!known) console.error(error)
      send(known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR', message: known ? error.message : 'Internal server error', ...(known && error.details ? { details: error.details } : {}) } })
    }
  })
}
