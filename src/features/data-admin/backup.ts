import type { AfterSalesTicket, Customer, DeliveryTask, FollowUp, InventoryDocument, InventoryMovement, ProductCatalogItem, ReplenishmentRequest, SalesOrder, SupplyDemand, Warehouse, WarehouseStock } from '../../types'

export interface SalesBackup {
  version: 1
  exportedAt: string
  customers: Customer[]
  followUps: FollowUp[]
  orders?: SalesOrder[]
  deliveryTasks?: DeliveryTask[]
  afterSalesTickets?: AfterSalesTicket[]
  supplyDemands?: SupplyDemand[]
  products?: ProductCatalogItem[]
  inventoryMovements?: InventoryMovement[]
  warehouses?: Warehouse[]
  warehouseStocks?: WarehouseStock[]
  inventoryDocuments?: InventoryDocument[]
  replenishmentRequests?: ReplenishmentRequest[]
}

export type BackupValidation =
  | { valid: true; data: SalesBackup }
  | { valid: false; errors: string[] }

const stages = new Set(['新线索', '已初聊', '需求确认', '到店', '量尺', '到店/量房', '方案设计', '已报价', '方案调整', '已定金', '生产交付', '已成交', '已流失'])
const intents = new Set(['高', '中', '低'])
const channels = new Set(['微信', '电话', '到店', '量尺', '量房'])

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
  const customers = (value.customers as Customer[]).map((customer) => (customer.stage as string) === '到店/量房' ? { ...customer, stage: '到店' as const } : customer)
  const followUps = (value.followUps as FollowUp[]).map((item) => (item.channel as string) === '量房' ? { ...item, channel: '量尺' as const } : item)
  return { valid: true, data: { ...(value as unknown as SalesBackup), customers, followUps, orders: Array.isArray(value.orders) ? value.orders as SalesOrder[] : [], deliveryTasks: Array.isArray(value.deliveryTasks) ? value.deliveryTasks as DeliveryTask[] : [], afterSalesTickets: Array.isArray(value.afterSalesTickets) ? value.afterSalesTickets as AfterSalesTicket[] : [], supplyDemands: Array.isArray(value.supplyDemands) ? value.supplyDemands as SupplyDemand[] : [], products: Array.isArray(value.products) ? value.products as ProductCatalogItem[] : undefined, inventoryMovements: Array.isArray(value.inventoryMovements) ? value.inventoryMovements as InventoryMovement[] : undefined, warehouses:Array.isArray(value.warehouses)?value.warehouses as Warehouse[]:undefined, warehouseStocks:Array.isArray(value.warehouseStocks)?value.warehouseStocks as WarehouseStock[]:undefined, inventoryDocuments:Array.isArray(value.inventoryDocuments)?value.inventoryDocuments as InventoryDocument[]:undefined, replenishmentRequests:Array.isArray(value.replenishmentRequests)?value.replenishmentRequests as ReplenishmentRequest[]:undefined } }
}

export function createBackup(customers: Customer[], followUps: FollowUp[], now = new Date(), lifecycle?: { orders: SalesOrder[]; deliveryTasks: DeliveryTask[]; afterSalesTickets: AfterSalesTicket[]; supplyDemands?: SupplyDemand[]; products?: ProductCatalogItem[]; inventoryMovements?: InventoryMovement[]; warehouses?:Warehouse[];warehouseStocks?:WarehouseStock[];inventoryDocuments?:InventoryDocument[];replenishmentRequests?:ReplenishmentRequest[] }): SalesBackup {
  return { version: 1, exportedAt: now.toISOString(), customers, followUps, orders: lifecycle?.orders ?? [], deliveryTasks: lifecycle?.deliveryTasks ?? [], afterSalesTickets: lifecycle?.afterSalesTickets ?? [], supplyDemands: lifecycle?.supplyDemands ?? [], products: lifecycle?.products, inventoryMovements: lifecycle?.inventoryMovements, warehouses:lifecycle?.warehouses,warehouseStocks:lifecycle?.warehouseStocks,inventoryDocuments:lifecycle?.inventoryDocuments,replenishmentRequests:lifecycle?.replenishmentRequests }
}
