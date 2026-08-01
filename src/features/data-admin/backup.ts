import type { AfterSalesTicket, Customer, DeliveryTask, FollowUp, SalesOrder } from '../../types'

export interface SalesBackup {
  version: 1
  exportedAt: string
  customers: Customer[]
  followUps: FollowUp[]
  orders?: SalesOrder[]
  deliveryTasks?: DeliveryTask[]
  afterSalesTickets?: AfterSalesTicket[]
}

export type BackupValidation =
  | { valid: true; data: SalesBackup }
  | { valid: false; errors: string[] }

const stages = new Set(['新线索', '已初聊', '需求确认', '到店/量房', '方案设计', '已报价', '方案调整', '已定金', '生产交付', '已成交', '已流失'])
const intents = new Set(['高', '中', '低'])
const channels = new Set(['微信', '电话', '到店', '量房'])

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown) => typeof value === 'string'
const isOptionalString = (value: unknown) => value === undefined || isString(value)
const isStringArray = (value: unknown) => Array.isArray(value) && value.every(isString)

function validateCustomer(value: unknown, index: number): string[] {
  const label = `customers[${index}]`
  if (!isRecord(value)) return [`${label} 必须是对象`]
  const errors: string[] = []
  for (const key of ['id', 'name', 'phone', 'source', 'salesperson', 'style', 'budget', 'renovationProgress', 'lastContactAt', 'createdAt']) {
    if (!isString(value[key])) errors.push(`${label}.${key} 必须是字符串`)
  }
  if (!stages.has(String(value.stage))) errors.push(`${label}.stage 无效`)
  if (!intents.has(String(value.intent))) errors.push(`${label}.intent 无效`)
  if (typeof value.expectedAmount !== 'number' || !Number.isFinite(value.expectedAmount)) errors.push(`${label}.expectedAmount 必须是有限数字`)
  if (!isStringArray(value.products)) errors.push(`${label}.products 必须是字符串数组`)
  if (!isStringArray(value.concerns)) errors.push(`${label}.concerns 必须是字符串数组`)
  for (const key of ['nextFollowUpAt', 'lostReason']) if (!isOptionalString(value[key])) errors.push(`${label}.${key} 必须是字符串`)
  return errors
}

function validateFollowUp(value: unknown, index: number): string[] {
  const label = `followUps[${index}]`
  if (!isRecord(value)) return [`${label} 必须是对象`]
  const errors: string[] = []
  for (const key of ['id', 'customerId', 'at', 'content', 'result', 'salesperson']) {
    if (!isString(value[key])) errors.push(`${label}.${key} 必须是字符串`)
  }
  if (!channels.has(String(value.channel))) errors.push(`${label}.channel 无效`)
  for (const key of ['nextAction', 'nextAt']) if (!isOptionalString(value[key])) errors.push(`${label}.${key} 必须是字符串`)
  return errors
}

export function validateBackup(value: unknown): BackupValidation {
  if (!isRecord(value)) return { valid: false, errors: ['备份根节点必须是对象'] }
  const errors: string[] = []
  if (value.version !== 1) errors.push('仅支持版本 1 的备份')
  if (!isString(value.exportedAt)) errors.push('exportedAt 必须是字符串')
  if (!Array.isArray(value.customers)) errors.push('customers 必须是数组')
  else value.customers.forEach((item, index) => errors.push(...validateCustomer(item, index)))
  if (!Array.isArray(value.followUps)) errors.push('followUps 必须是数组')
  else value.followUps.forEach((item, index) => errors.push(...validateFollowUp(item, index)))
  if (errors.length) return { valid: false, errors }
  return { valid: true, data: { ...(value as unknown as SalesBackup), orders: Array.isArray(value.orders) ? value.orders as SalesOrder[] : [], deliveryTasks: Array.isArray(value.deliveryTasks) ? value.deliveryTasks as DeliveryTask[] : [], afterSalesTickets: Array.isArray(value.afterSalesTickets) ? value.afterSalesTickets as AfterSalesTicket[] : [] } }
}

export function createBackup(customers: Customer[], followUps: FollowUp[], now = new Date(), lifecycle?: { orders: SalesOrder[]; deliveryTasks: DeliveryTask[]; afterSalesTickets: AfterSalesTicket[] }): SalesBackup {
  return { version: 1, exportedAt: now.toISOString(), customers, followUps, orders: lifecycle?.orders ?? [], deliveryTasks: lifecycle?.deliveryTasks ?? [], afterSalesTickets: lifecycle?.afterSalesTickets ?? [] }
}
