import { randomUUID, timingSafeEqual } from 'node:crypto'

export const WEBSITE_LEAD_PATH = '/api/public/website-lead-intake'
export const WEBSITE_LEAD_SOURCES = ['官网留资', '广告计划']

const cleanText = (value, max = 120) => typeof value === 'string' ? value.trim().slice(0, max) : ''

function cleanCampaignId(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value)).slice(0, 80)
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, 80)
}

function cleanProducts(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[|,，、；;]/) : []
  const items = []
  for (const item of raw) {
    const text = typeof item === 'string' ? item : (item && typeof item === 'object' ? (item.name || item.title || '') : '')
    const cleaned = cleanText(text, 60)
    if (!cleaned) continue
    items.push(cleaned)
    if (items.length >= 12) break
  }
  return items
}

export function canonicalMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (/^1\d{10}$/.test(digits)) return digits
  if (/^861\d{10}$/.test(digits)) return digits.slice(2)
  return ''
}

function tokenMatches(expected, provided) {
  const actual = String(provided ?? '')
  const left = Buffer.from(expected)
  const right = Buffer.from(actual)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function validateWebsiteLead(value, ApiError) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'VALIDATION_ERROR', 'request body must be an object')
  if (value.consent !== true) throw new ApiError(400, 'VALIDATION_ERROR', 'consent is required')
  const name = cleanText(value.name, 40)
  const phone = cleanText(value.phone, 30)
  if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'name is required')
  if (!/^1\d{10}$/.test(phone)) throw new ApiError(400, 'VALIDATION_ERROR', 'a valid mobile phone is required')
  const sourceText = cleanText(value.source, 40)
  const source = sourceText || '官网留资'
  if (!WEBSITE_LEAD_SOURCES.includes(source)) throw new ApiError(400, 'VALIDATION_ERROR', 'source must be 官网留资 or 广告计划')
  return {
    name,
    phone,
    source,
    cityArea: cleanText(value.cityArea, 40),
    budget: cleanText(value.budget, 40) || '待确认',
    products: cleanProducts(value.products),
    renovationProgress: cleanText(value.renovationProgress, 40),
    conversionSource: cleanText(value.conversionSource, 80),
    campaignId: cleanCampaignId(value.campaignId ?? value.projectId ?? value.project_id),
    contentId: cleanText(value.contentId, 80),
    adGroup: cleanText(value.adGroup, 80),
    notes: cleanText(value.notes, 500),
    landingPage: cleanText(value.landingPage, 300),
  }
}

function repeatLine(input, at) {
  const bits = []
  if (input.notes) bits.push(input.notes)
  if (input.cityArea) bits.push(`城市:${input.cityArea}`)
  if (input.budget) bits.push(`预算:${input.budget}`)
  if (input.products.length) bits.push(`产品:${input.products.join('、')}`)
  if (input.renovationProgress) bits.push(`装修进度:${input.renovationProgress}`)
  if (input.campaignId) bits.push(`活动批次:${input.campaignId}`)
  if (input.contentId) bits.push(`内容:${input.contentId}`)
  if (input.adGroup) bits.push(`广告组:${input.adGroup}`)
  if (input.conversionSource) bits.push(`转化来源:${input.conversionSource}`)
  if (input.source) bits.push(`来源:${input.source}`)
  if (input.landingPage) bits.push(`落地页:${input.landingPage}`)
  return `[官网留资 ${at}] ${bits.join('；')}`
}

function appendNote(previous, line, max = 2000) {
  const notes = [previous, line].filter(Boolean).join('\n')
  return notes.length <= max ? notes : notes.slice(notes.length - max)
}

function latestByPhone(customers, phone) {
  const key = canonicalMobile(phone)
  if (!key) return null
  const matches = customers.filter(item => item && canonicalMobile(item.phone) === key)
  matches.sort((a, b) => String(b.updatedAt || b.createdAt || b.lastContactAt || '').localeCompare(String(a.updatedAt || a.createdAt || a.lastContactAt || '')))
  return matches[0] || null
}

function currentState(database) {
  const value = database.getState().value
  const state = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const customers = Array.isArray(state.customers) ? state.customers : []
  return { state, customers }
}

/**
 * 官网 / lead-server 服务端代发的公开留资。
 * 写入路径与 experience-intake 相同：database.setState 合并进 state.customers，不走 PUT /api/state。
 * campaignId（巨量 project_id）原样落库，不改写成 SPJ-*。
 */
export async function intakeWebsiteLead({ req, database, maxBodyBytes, attempts, limit, windowMs, websiteLeadToken, readJson, ApiError }) {
  const address = req.socket.remoteAddress || 'unknown'
  const nowMs = Date.now()
  const recent = (attempts.get(address) || []).filter(at => nowMs - at < windowMs)
  if (recent.length >= limit) throw new ApiError(429, 'INTAKE_RATE_LIMITED', 'Too many submissions; try again later')

  const expectedToken = String(websiteLeadToken || '').trim()
  if (expectedToken) {
    const header = req.headers['x-lead-token']
    const provided = Array.isArray(header) ? header[0] : header
    if (!provided) {
      recent.push(nowMs)
      attempts.set(address, recent)
      throw new ApiError(401, 'LEAD_TOKEN_REQUIRED', 'X-Lead-Token header is required')
    }
    if (!tokenMatches(expectedToken, provided)) {
      recent.push(nowMs)
      attempts.set(address, recent)
      throw new ApiError(401, 'LEAD_TOKEN_INVALID', 'X-Lead-Token is invalid')
    }
  }

  const input = validateWebsiteLead(await readJson(req, maxBodyBytes), ApiError)
  recent.push(nowMs)
  attempts.set(address, recent)

  const at = new Date().toISOString()
  const { state, customers } = currentState(database)
  const existing = latestByPhone(customers, input.phone)
  if (existing) {
    const leadId = existing.leadId || existing.id
    if (existing.id) {
      const updated = {
        ...existing,
        notes: appendNote(existing.notes, repeatLine(input, at)),
        updatedAt: at,
        lastContactAt: at,
      }
      database.setState({ ...state, customers: customers.map(item => item?.id === existing.id ? updated : item) })
    }
    database.record('update', 'public_website_lead_intake', { leadId, customerId: existing.id, already: true, campaignId: input.campaignId || undefined })
    return { status: 200, body: { ok: true, leadId, customerId: existing.id, already: true } }
  }

  const stamp = at.slice(0, 10).replace(/-/g, '')
  const leadId = `L-${stamp}-${String(nowMs).slice(-6)}`
  const customerId = `lead-${nowMs}-${randomUUID().slice(0, 8)}`
  const customer = {
    id: customerId,
    leadId,
    campaignId: input.campaignId || undefined,
    contentId: input.contentId || undefined,
    adGroup: input.adGroup || undefined,
    conversionSource: input.conversionSource || undefined,
    landingPage: input.landingPage || undefined,
    name: input.name,
    phone: input.phone,
    source: input.source,
    salesperson: '待分配',
    stage: '新线索',
    intent: '中',
    expectedAmount: 0,
    products: input.products,
    productLines: [],
    style: '',
    budget: input.budget,
    renovationProgress: input.renovationProgress,
    concerns: [],
    cityArea: input.cityArea || undefined,
    arrivalStatus: '未预约',
    notes: appendNote('客户通过官网留资接口提交。', repeatLine(input, at)),
    lastContactAt: at,
    createdAt: at.slice(0, 10),
    updatedAt: at,
  }
  database.setState({ ...state, customers: [customer, ...customers] })
  database.record('create', 'public_website_lead_intake', { leadId, customerId, already: false, campaignId: input.campaignId || undefined })
  return { status: 201, body: { ok: true, leadId, customerId, already: false } }
}
