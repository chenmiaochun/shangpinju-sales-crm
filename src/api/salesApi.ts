import type { AfterSalesTicket, Customer, DeliveryTask, DesignTask, FollowUp, SalesOrder, SupplyDemand } from '../types'
import type { AccessPermission } from '../features/team/access'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '') + '/api'
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true'
const STATIC_ACCOUNTS_KEY = 'shangpinju.static-accounts.v1'
const STATIC_SESSION_KEY = 'shangpinju.static-session.v1'

export interface RemoteSalesState {
  customers: Customer[]
  followUps: FollowUp[]
  designTasks: DesignTask[]
  orders: SalesOrder[]
  deliveryTasks: DeliveryTask[]
  afterSalesTickets: AfterSalesTicket[]
  supplyDemands: SupplyDemand[]
}
export interface RemoteAuditEvent { id: number; action: string; resource: string; details: Record<string, unknown>; createdAt: string }
export type AccountRole = 'manager' | 'sales' | 'designer' | 'operations' | 'aftersales'
export interface RemoteAccount {
  id: string
  username: string
  name: string
  role: AccountRole
  roles?: AccountRole[]
  canDesign?: boolean
  permissions?: AccessPermission[]
  phone?: string
  active: boolean
  mustChangePassword?: boolean
  lastLoginAt?: string | null
  createdAt?: string
}
export interface CreateAccountInput { username: string; name: string; role: AccountRole; roles?: AccountRole[]; canDesign?: boolean; permissions?: AccessPermission[]; password: string; phone?: string }
export interface UpdateAccountInput { username: string; name: string; role: AccountRole; roles?: AccountRole[]; canDesign?: boolean; permissions?: AccessPermission[]; phone?: string }

export const STATIC_TEST_PASSWORD = '123456'
export const STATIC_TEST_ACCOUNTS: RemoteAccount[] = [
  { id: 'static-manager', username: 'manager', name: '访客店长', role: 'manager', active: true, mustChangePassword: false, phone: '', createdAt: new Date().toISOString() },
  { id: 'static-aftersales', username: 'delivery', name: '售后配送组', role: 'aftersales', active: true, mustChangePassword: false, phone: '', createdAt: new Date().toISOString() },
  { id: 'static-spj001', username: 'spj001', name: '陈婉珊', role: 'sales', roles: ['sales'], active: true, mustChangePassword: true, phone: '', createdAt: '2026-08-02T00:00:00.000Z' },
  { id: 'static-spj002', username: 'spj002', name: '林泽鹏', role: 'sales', roles: ['sales', 'designer'], canDesign: true, active: true, mustChangePassword: true, phone: '', createdAt: '2026-08-02T00:00:00.000Z' },
  { id: 'static-spj003', username: 'spj003', name: '郭予旭', role: 'sales', roles: ['sales', 'designer'], canDesign: true, active: true, mustChangePassword: true, phone: '', createdAt: '2026-08-02T00:00:00.000Z' },
  { id: 'static-spj004', username: 'spj004', name: '吴漫东', role: 'sales', roles: ['sales'], active: true, mustChangePassword: true, phone: '', createdAt: '2026-08-02T00:00:00.000Z' },
  { id: 'static-spj005', username: 'spj005', name: '江惠柔', role: 'operations', roles: ['operations'], active: true, mustChangePassword: true, phone: '', createdAt: '2026-08-02T00:00:00.000Z' },
]
type StaticAccount = RemoteAccount & { password?: string }
function loadStaticAccounts() {
  try {
    const value = localStorage.getItem(STATIC_ACCOUNTS_KEY)
    if (value) {
      const saved = (JSON.parse(value) as StaticAccount[]).map((account) => ({ ...account, password: account.password ?? '123456' }))
      const missingDefaults = STATIC_TEST_ACCOUNTS.filter((account) => !saved.some((item) => item.username === account.username)).map((account) => ({ ...account, password: STATIC_TEST_PASSWORD }))
      return [...saved, ...missingDefaults]
    }
  } catch { /* Use demo account. */ }
  return STATIC_TEST_ACCOUNTS.map((account) => ({ ...account, password: STATIC_TEST_PASSWORD }))
}
function saveStaticAccounts(accounts: StaticAccount[]) { localStorage.setItem(STATIC_ACCOUNTS_KEY, JSON.stringify(accounts)); return accounts }
function publicStaticAccount({ password: _password, ...account }: StaticAccount): RemoteAccount { return account }
function staticAccountError(message: string, status = 400): never { throw new ApiError(status, message) }

export class ApiError extends Error {
  constructor(public status: number, message = `API ${status}`) { super(message) }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include' })
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('sales-crm:session-expired'))
    let message = `API ${response.status}`
    try { message = (await response.json() as { error?: string; message?: string }).message ?? message } catch { /* Use status fallback. */ }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const salesApi = {
  isStaticDemo: STATIC_DEMO,
  staticTestPassword: STATIC_TEST_PASSWORD,
  getCurrentUser: <T>() => {
    if (!STATIC_DEMO) return request<{ user: T }>('/auth/me')
    const value = sessionStorage.getItem(STATIC_SESSION_KEY); if (!value) return Promise.reject(new ApiError(401, 'API 401'))
    const session = JSON.parse(value) as RemoteAccount
    const account = loadStaticAccounts().find((item) => item.id === session.id && item.active)
    if (!account) { sessionStorage.removeItem(STATIC_SESSION_KEY); return Promise.reject(new ApiError(401, 'API 401')) }
    const user = publicStaticAccount(account) as T
    sessionStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user))
    return Promise.resolve({ user })
  },
  login: <T>(username: string, password: string) => {
    if (!STATIC_DEMO) return request<{ user: T }>('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
    const account = loadStaticAccounts().find((item) => item.username.toLowerCase() === username.trim().toLowerCase() && item.password === password && item.active)
    if (!account) return Promise.reject(new ApiError(401, '账号或密码错误'))
    const user = publicStaticAccount(account) as T; sessionStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user)); return Promise.resolve({ user })
  },
  logout: () => { if (STATIC_DEMO) { sessionStorage.removeItem(STATIC_SESSION_KEY); return Promise.resolve() } return request<void>('/auth/logout', { method: 'POST' }) },
  health: () => request<{ ok: boolean }>('/health'),
  getState: () => request<{ value: Partial<RemoteSalesState>; updatedAt: string | null }>('/state'),
  putState: (state: RemoteSalesState) => request('/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }),
  getAudit: () => request<{ items: RemoteAuditEvent[] }>('/audit?limit=50&offset=0'),
  getIntegrations: () => request<{ integrations: Record<string, Record<string, unknown>> }>('/integrations'),
  putIntegrations: (integrations: Record<string, Record<string, unknown>>) => request<{ integrations: Record<string, Record<string, unknown>> }>('/integrations', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ integrations }) }),
  getMembers: <T>() => request<{ members: T[] }>('/members'),
  putMembers: <T>(members: T[]) => request<{ members: T[] }>('/members', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ members }) }),
  getAccounts: () => STATIC_DEMO ? Promise.resolve({ accounts: loadStaticAccounts().map(publicStaticAccount) }) : request<{ accounts: RemoteAccount[] }>('/accounts'),
  getDesigners: () => STATIC_DEMO ? Promise.resolve({ designers: loadStaticAccounts().filter((item) => (item.roles?.includes('designer') || item.role === 'designer' || item.canDesign) && item.active).map(publicStaticAccount) }) : request<{ designers: RemoteAccount[] }>('/designers'),
  getSalespeople: () => STATIC_DEMO ? Promise.resolve({ salespeople: loadStaticAccounts().filter((item) => (item.roles?.includes('sales') || item.role === 'sales') && item.active).map(publicStaticAccount) }) : request<{ salespeople: RemoteAccount[] }>('/salespeople'),
  getDeliveryStaff: () => STATIC_DEMO ? Promise.resolve({ deliveryStaff: loadStaticAccounts().filter((item) => (item.roles?.includes('aftersales') || item.role === 'aftersales') && item.active).map(publicStaticAccount) }) : request<{ deliveryStaff: RemoteAccount[] }>('/delivery-staff'),
  createAccount: (input: CreateAccountInput) => {
    if (!STATIC_DEMO) return request<{ account: RemoteAccount }>('/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    const accounts = loadStaticAccounts(); if (accounts.some((item) => item.username.toLowerCase() === input.username.toLowerCase())) staticAccountError('API 409', 409)
    const account: StaticAccount = { ...input, id: `static-${Date.now()}`, active: true, mustChangePassword: true, createdAt: new Date().toISOString() }
    saveStaticAccounts([...accounts, account]); return Promise.resolve({ account: publicStaticAccount(account) })
  },
  updateAccount: (id: string, input: UpdateAccountInput) => {
    if (!STATIC_DEMO) return request<{ account: RemoteAccount }>(`/accounts/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    const accounts = loadStaticAccounts(); const current = accounts.find((item) => item.id === id); if (!current) staticAccountError('API 400')
    const account = { ...current, ...input }; saveStaticAccounts(accounts.map((item) => item.id === id ? account : item)); return Promise.resolve({ account: publicStaticAccount(account) })
  },
  deleteAccount: (id: string) => STATIC_DEMO ? Promise.resolve(saveStaticAccounts(loadStaticAccounts().filter((item) => item.id !== id))).then(() => undefined) : request<void>(`/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  setAccountActive: (id: string, active: boolean) => {
    if (!STATIC_DEMO) return request<{ account: RemoteAccount }>(`/accounts/${encodeURIComponent(id)}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) })
    const accounts = loadStaticAccounts(); const current = accounts.find((item) => item.id === id); if (!current) staticAccountError('API 400')
    const account = { ...current, active }; saveStaticAccounts(accounts.map((item) => item.id === id ? account : item)); return Promise.resolve({ account: publicStaticAccount(account) })
  },
  resetAccountPassword: (id: string, password: string) => {
    if (!STATIC_DEMO) return request<{ ok: boolean }>(`/accounts/${encodeURIComponent(id)}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
    const accounts = loadStaticAccounts(); if (!accounts.some((item) => item.id === id)) staticAccountError('API 400')
    saveStaticAccounts(accounts.map((item) => item.id === id ? { ...item, password, mustChangePassword: true } : item)); return Promise.resolve({ ok: true })
  },
}
