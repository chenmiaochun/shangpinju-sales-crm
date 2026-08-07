import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { salesApi, type RemoteAuditEvent } from '../api/salesApi'
import { customers as seedCustomers, followUps as seedFollowUps } from '../data'
import { productCatalog } from '../productCatalog'
import type { AfterSalesTicket, Customer, DeliveryTask, DesignTask, FollowUp, InventoryDocument, InventoryMovement, OrderItem, PaymentRecord, ProductCatalogItem, ReplenishmentRequest, SalesOrder, SupplyDemand, Warehouse, WarehouseStock } from '../types'
import { applyInventoryDocument, defaultWarehouses, initializeWarehouseStocks } from '../features/inventory/inventory-operations'

const STORAGE_KEY = 'shangpinju.customer-followup.v1'
const REMOVED_DEMO_EMPLOYEES = new Set(['周然', '林晓', '何静'])
const updateMainWarehouseStock = (stocks: WarehouseStock[], products: ProductCatalogItem[], productId: string, delta: number) => {
  const initialized = initializeWarehouseStocks(products, stocks)
  const found = initialized.find((item) => item.warehouseId === 'warehouse-main' && item.productId === productId)
  return found ? initialized.map((item) => item === found ? { ...item, quantity:Math.max(0,item.quantity+delta) } : item) : [...initialized,{warehouseId:'warehouse-main',productId,quantity:Math.max(0,delta),reservedQuantity:0}]
}

export interface SalesState {
  customers: Customer[]
  followUps: FollowUp[]
  designTasks: DesignTask[]
  orders: SalesOrder[]
  deliveryTasks: DeliveryTask[]
  afterSalesTickets: AfterSalesTicket[]
  supplyDemands: SupplyDemand[]
  products: ProductCatalogItem[]
  inventoryMovements: InventoryMovement[]
  warehouses: Warehouse[]
  warehouseStocks: WarehouseStock[]
  inventoryDocuments: InventoryDocument[]
  replenishmentRequests: ReplenishmentRequest[]
}

export function removeFormerDemoEmployees(state: Partial<SalesState> & Pick<SalesState, 'customers' | 'followUps' | 'designTasks' | 'orders' | 'deliveryTasks' | 'afterSalesTickets' | 'supplyDemands'>): SalesState {
  const customers = state.customers.filter((customer) => !REMOVED_DEMO_EMPLOYEES.has(customer.salesperson)).map((customer) => (customer.stage as string) === '到店/量房' ? { ...customer, stage: '到店' as const } : customer)
  const customerIds = new Set(customers.map((customer) => customer.id))
  return {
    customers,
    followUps: state.followUps.filter((item) => customerIds.has(item.customerId) && !REMOVED_DEMO_EMPLOYEES.has(item.salesperson)).map((item) => (item.channel as string) === '量房' ? { ...item, channel: '量尺' as const } : item),
    designTasks: state.designTasks.filter((item) => customerIds.has(item.customerId) && !REMOVED_DEMO_EMPLOYEES.has(item.salesperson)),
    orders: (state.orders ?? []).filter((item) => customerIds.has(item.customerId)),
    deliveryTasks: (state.deliveryTasks ?? []).filter((item) => customerIds.has(item.customerId)),
    afterSalesTickets: (state.afterSalesTickets ?? []).filter((item) => customerIds.has(item.customerId)),
    supplyDemands: (state.supplyDemands ?? []).filter((item) => customerIds.has(item.customerId)),
    products: state.products ?? productCatalog,
    inventoryMovements: state.inventoryMovements ?? [],
    warehouses: state.warehouses?.length ? state.warehouses : defaultWarehouses,
    warehouseStocks: initializeWarehouseStocks(state.products ?? productCatalog, state.warehouseStocks ?? []),
    inventoryDocuments: state.inventoryDocuments ?? [],
    replenishmentRequests: state.replenishmentRequests ?? [],
  }
}
interface SalesDataValue extends SalesState {
  designers: { id: string; name: string }[]
  salespeople: { id: string; name: string }[]
  deliveryStaff: { id: string; name: string }[]
  addCustomers: (items: Customer[]) => void
  addFollowUp: (item: FollowUp) => void
  addDesignTask: (item: DesignTask) => void
  updateDesignTask: (id: string, changes: Partial<DesignTask>) => void
  addOrder: (item: SalesOrder) => void
  registerDeal: (input: { customer: Customer; items: OrderItem[]; contractAmount: number; deposit: number; signedAt: string; expectedDeliveryAt?: string; expectedDeliveryMonth?: string; deliveryReminderAt?: string; recordedBy: string; deliveryOwnerId?: string; deliveryOwner?: string; marketingStatus?: Customer['marketingStatus']; marketingNextAt?: string; marketingNote?: string }) => void
  updateOrder: (id: string, changes: Partial<SalesOrder>) => void
  addPayment: (orderId: string, payment: PaymentRecord) => void
  addDeliveryTask: (item: DeliveryTask) => void
  updateDeliveryTask: (id: string, changes: Partial<DeliveryTask>) => void
  addAfterSalesTicket: (item: AfterSalesTicket) => void
  updateAfterSalesTicket: (id: string, changes: Partial<AfterSalesTicket>) => void
  updateSupplyDemand: (id: string, changes: Partial<SupplyDemand>) => void
  updateProduct: (id: string, changes: Partial<ProductCatalogItem>) => void
  addProduct: (item: ProductCatalogItem) => void
  adjustInventory: (productId: string, quantity: number, type: InventoryMovement['type'], operator: string, note?: string) => void
  addInventoryDocument: (document: InventoryDocument) => { ok: boolean; error?: string }
  addReplenishmentRequest: (request: ReplenishmentRequest) => void
  reviewReplenishmentRequest: (id: string, status: '已批准' | '已驳回' | '已转采购', reviewer: string, reviewNote?: string) => void
  replaceState: (state: Partial<SalesState> & Pick<SalesState, 'customers' | 'followUps' | 'designTasks' | 'orders' | 'deliveryTasks' | 'afterSalesTickets' | 'supplyDemands'>) => void
  updateCustomer: (id: string, changes: Partial<Customer>) => void
  serverStatus: 'connecting' | 'connected' | 'offline'
  auditEvents: RemoteAuditEvent[]
  integrationSettings: Record<string, Record<string, unknown>>
  refreshAdminData: () => Promise<void>
  saveIntegrations: (settings: Record<string, Record<string, unknown>>) => Promise<void>
}

const SalesDataContext = createContext<SalesDataValue | null>(null)

function loadState(): SalesState {
  if (typeof window === 'undefined') return { customers: seedCustomers, followUps: seedFollowUps, designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [], supplyDemands: [], products:productCatalog, inventoryMovements:[], warehouses:defaultWarehouses, warehouseStocks:initializeWarehouseStocks(productCatalog, []), inventoryDocuments:[], replenishmentRequests:[] }
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (value) {
      const state = JSON.parse(value) as SalesState
      if (Array.isArray(state.customers) && Array.isArray(state.followUps)) return removeFormerDemoEmployees({
        ...state,
        designTasks: Array.isArray(state.designTasks) ? state.designTasks : [],
        orders: Array.isArray(state.orders) ? state.orders : [],
        deliveryTasks: Array.isArray(state.deliveryTasks) ? state.deliveryTasks : [],
        afterSalesTickets: Array.isArray(state.afterSalesTickets) ? state.afterSalesTickets : [],
        supplyDemands: Array.isArray(state.supplyDemands) ? state.supplyDemands : [],
        products: Array.isArray(state.products) ? state.products : productCatalog,
        inventoryMovements: Array.isArray(state.inventoryMovements) ? state.inventoryMovements : [],
        warehouses: Array.isArray(state.warehouses) ? state.warehouses : defaultWarehouses,
        warehouseStocks: Array.isArray(state.warehouseStocks) ? state.warehouseStocks : [],
        inventoryDocuments: Array.isArray(state.inventoryDocuments) ? state.inventoryDocuments : [],
        replenishmentRequests: Array.isArray(state.replenishmentRequests) ? state.replenishmentRequests : [],
      })
    }
  } catch { /* Fall back to bundled sample data. */ }
  return { customers: seedCustomers, followUps: seedFollowUps, designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [], supplyDemands: [], products:productCatalog, inventoryMovements:[], warehouses:defaultWarehouses, warehouseStocks:initializeWarehouseStocks(productCatalog, []), inventoryDocuments:[], replenishmentRequests:[] }
}

function uniqueDirectoryMembers(items: { id: string; name: string }[]) {
  const names = new Set<string>()
  return items.reduce<{ id: string; name: string }[]>((members, item) => {
    const name = item.name.trim()
    const key = name.toLocaleLowerCase('zh-CN')
    if (!name || names.has(key)) return members
    names.add(key)
    members.push({ id:item.id, name })
    return members
  }, [])
}

export function SalesDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SalesState>(loadState)
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [auditEvents, setAuditEvents] = useState<RemoteAuditEvent[]>([])
  const [integrationSettings, setIntegrationSettings] = useState<Record<string, Record<string, unknown>>>({})
  const [designers, setDesigners] = useState<{ id: string; name: string }[]>([])
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([])
  const [deliveryStaff, setDeliveryStaff] = useState<{ id: string; name: string }[]>([])
  const hydrated = useRef(false)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* Server remains the source of truth when browser storage is full. */ }
  }, [state])

  const refreshAdminData = useCallback(async () => {
    const [audit, integrations] = await Promise.all([salesApi.getAudit(), salesApi.getIntegrations()])
    setAuditEvents(audit.items)
    setIntegrationSettings(integrations.integrations)
  }, [])

  const refreshEmployeeDirectories = useCallback(async () => {
    const [designerResult, salesResult, deliveryResult] = await Promise.all([
      salesApi.getDesigners(), salesApi.getSalespeople(), salesApi.getDeliveryStaff(),
    ])
    setDesigners(uniqueDirectoryMembers(designerResult.designers))
    setSalespeople(uniqueDirectoryMembers(salesResult.salespeople))
    setDeliveryStaff(uniqueDirectoryMembers(deliveryResult.deliveryStaff))
  }, [])

  useEffect(() => {
    const refresh = () => { void refreshEmployeeDirectories().catch(() => undefined) }
    refresh()
    window.addEventListener('sales-crm:accounts-changed', refresh)
    return () => window.removeEventListener('sales-crm:accounts-changed', refresh)
  }, [refreshEmployeeDirectories])

  useEffect(() => {
    let active = true
    async function hydrate() {
      try {
        const remote = await salesApi.getState()
        if (!active) return
        if (Array.isArray(remote.value.customers) && Array.isArray(remote.value.followUps)) {
          setState(removeFormerDemoEmployees({
            customers: remote.value.customers,
            followUps: remote.value.followUps,
            designTasks: Array.isArray(remote.value.designTasks) ? remote.value.designTasks : [],
            orders: Array.isArray(remote.value.orders) ? remote.value.orders : [],
            deliveryTasks: Array.isArray(remote.value.deliveryTasks) ? remote.value.deliveryTasks : [],
            afterSalesTickets: Array.isArray(remote.value.afterSalesTickets) ? remote.value.afterSalesTickets : [],
            supplyDemands: Array.isArray(remote.value.supplyDemands) ? remote.value.supplyDemands : [],
            products: Array.isArray(remote.value.products) ? remote.value.products : productCatalog,
            inventoryMovements: Array.isArray(remote.value.inventoryMovements) ? remote.value.inventoryMovements : [],
            warehouses: Array.isArray(remote.value.warehouses) ? remote.value.warehouses : defaultWarehouses,
            warehouseStocks: Array.isArray(remote.value.warehouseStocks) ? remote.value.warehouseStocks : [],
            inventoryDocuments: Array.isArray(remote.value.inventoryDocuments) ? remote.value.inventoryDocuments : [],
            replenishmentRequests: Array.isArray(remote.value.replenishmentRequests) ? remote.value.replenishmentRequests : [],
          }))
        } else {
          await salesApi.putState(state)
        }
        try { await refreshAdminData() } catch { /* Admin-only data is unavailable to employee roles. */ }
        if (active) setServerStatus('connected')
      } catch {
        if (active) setServerStatus('offline')
      } finally {
        hydrated.current = true
      }
    }
    void hydrate()
    return () => { active = false }
  }, [refreshAdminData, refreshEmployeeDirectories])

  useEffect(() => {
    if (!hydrated.current || serverStatus !== 'connected') return
    const timer = window.setTimeout(() => {
      void salesApi.putState(state).then(refreshAdminData).catch(() => setServerStatus('offline'))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [refreshAdminData, serverStatus, state])

  const addCustomers = useCallback((items: Customer[]) => {
    setState((current) => ({ ...current, customers: [...items, ...current.customers] }))
  }, [])

  const addFollowUp = useCallback((item: FollowUp) => {
    setState((current) => ({
      ...current,
      followUps: [item, ...current.followUps],
      customers: current.customers.map((customer) => customer.id === item.customerId ? {
        ...customer,
        lastContactAt: item.at,
        nextFollowUpAt: item.nextAt || undefined,
      } : customer),
    }))
  }, [])

  const updateCustomer = useCallback((id: string, changes: Partial<Customer>) => {
    setState((current) => ({ ...current, customers: current.customers.map((item) => item.id === id ? { ...item, ...changes } : item) }))
  }, [])

  const addDesignTask = useCallback((item: DesignTask) => setState((current) => ({ ...current, designTasks: [item, ...current.designTasks] })), [])
  const updateDesignTask = useCallback((id: string, changes: Partial<DesignTask>) => setState((current) => ({ ...current, designTasks: current.designTasks.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })), [])
  const addOrder = useCallback((item: SalesOrder) => setState((current) => ({
    ...current,
    orders: [item, ...current.orders],
    customers: current.customers.map((customer) => customer.id === item.customerId ? { ...customer, stage: '已定金', dealAmount: item.contractAmount, dealDate: item.signedAt, dealProducts: item.products } : customer),
  })), [])
  const registerDeal = useCallback((input: { customer: Customer; items: OrderItem[]; contractAmount: number; deposit: number; signedAt: string; expectedDeliveryAt?: string; expectedDeliveryMonth?: string; deliveryReminderAt?: string; recordedBy: string; deliveryOwnerId?: string; deliveryOwner?: string; marketingStatus?: Customer['marketingStatus']; marketingNextAt?: string; marketingNote?: string }) => setState((current) => {
    const now = new Date().toISOString()
    const suffix = `${Date.now()}`
    const orderId = `order-${suffix}`
    const orderNo = `SPJ${suffix.slice(-8)}`
    const payments: PaymentRecord[] = input.deposit > 0 ? [{ id: `payment-${suffix}`, orderId, type: '定金', amount: input.deposit, paidAt: now, method: '微信', recordedBy: input.recordedBy }] : []
    const order: SalesOrder = { id: orderId, orderNo, customerId: input.customer.id, customerName: input.customer.name, salesperson: input.customer.salesperson, salespersonId: input.customer.salespersonId, collaborators: input.customer.designer ? [input.customer.designer] : [], products: input.items.map((item) => item.productName), items: input.items, contractAmount: input.contractAmount, signedAt: input.signedAt, expectedDeliveryAt: input.expectedDeliveryAt, expectedDeliveryMonth: input.expectedDeliveryMonth, deliveryReminderAt: input.deliveryReminderAt, status: '已签约', payments, performanceRate: 100, createdAt: now, updatedAt: now }
    const demandMap = { '现货': ['库存锁定', '已锁定'], '展厅样品': ['样品锁定', '已锁定'], '外采产品': ['采购需求', '待处理'], '定制生产': ['生产需求', '待处理'] } as const
    const demands: SupplyDemand[] = input.items.map((item, index) => { const product=current.products.find((entry)=>entry.id===item.productId); const free=(product?.availableStock??0)-(product?.reservedStock??0); const canLock=!['现货','展厅样品'].includes(item.supplyType)||free>=item.quantity; return { id: `supply-${suffix}-${index}`, orderId, orderNo, customerId: input.customer.id, customerName: input.customer.name, orderItemId: item.id, productName: item.productName, specification: item.specification, quantity: item.quantity, supplyType: item.supplyType, demandType: demandMap[item.supplyType][0], status: canLock ? demandMap[item.supplyType][1] : '待处理', expectedAt: input.expectedDeliveryAt, woodMaterial:product?.woodMaterial, color:[product?.color,product?.finish].filter(Boolean).join(' / ')||undefined, dimensions:product?.dimensions??item.specification, productionProgress:item.supplyType==='定制生产'?'资料待确认':undefined, createdAt: now, updatedAt: now } })
    const reservedByProduct=new Map<string,number>(); input.items.filter((item)=>['现货','展厅样品'].includes(item.supplyType)).forEach((item)=>{ if(item.productId) reservedByProduct.set(item.productId,(reservedByProduct.get(item.productId)??0)+item.quantity) })
    const products=current.products.map((product)=>reservedByProduct.has(product.id)?{...product,reservedStock:Math.min(product.availableStock,(product.reservedStock??0)+(reservedByProduct.get(product.id)??0))}:product)
    return { ...current, products, orders: [order, ...current.orders], supplyDemands: [...demands, ...(current.supplyDemands ?? [])], customers: current.customers.map((customer) => customer.id === input.customer.id ? { ...customer, stage: '已定金', dealAmount: input.contractAmount, paidAmount: input.deposit, dealDate: input.signedAt, deliveryDate: input.expectedDeliveryAt, dealProducts: order.products, nextFollowUpAt: input.deliveryReminderAt ? new Date(`${input.deliveryReminderAt}T09:00:00`).toISOString() : undefined, marketingStatus: input.marketingStatus, marketingNextAt: input.marketingNextAt, marketingNote: input.marketingNote } : customer) }
  }), [])
  const updateOrder = useCallback((id: string, changes: Partial<SalesOrder>) => setState((current) => ({ ...current, orders: current.orders.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })), [])
  const addPayment = useCallback((orderId: string, payment: PaymentRecord) => setState((current) => {
    const orders = current.orders.map((order) => order.id === orderId ? { ...order, payments: [payment, ...order.payments], updatedAt: new Date().toISOString() } : order)
    const order = orders.find((item) => item.id === orderId)
    const paidAmount = order?.payments.reduce((sum, item) => sum + (item.type === '退款' ? -item.amount : item.amount), 0) ?? 0
    return { ...current, orders, customers: current.customers.map((customer) => customer.id === order?.customerId ? { ...customer, paidAmount } : customer) }
  }), [])
  const addDeliveryTask = useCallback((item: DeliveryTask) => setState((current) => ({ ...current, deliveryTasks: [item, ...current.deliveryTasks] })), [])
  const updateDeliveryTask = useCallback((id: string, changes: Partial<DeliveryTask>) => setState((current) => {
    const task = current.deliveryTasks.find((item) => item.id === id)
    const completing = task?.status !== '已完成' && changes.status === '已完成'
    if (!completing || !task) return { ...current, deliveryTasks: current.deliveryTasks.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) }
    const now = new Date().toISOString()
    const order = current.orders.find((item) => item.id === task.orderId)
    const handover = changes.handoverItems ?? task.handoverItems
    const delivered = new Map<string, number>()
    const damaged = new Map<string, number>()
    const releaseReserved = new Map<string, number>()
    if (handover?.length) handover.forEach((item) => { if (!item.productId) return; if (item.result === '客户留下') delivered.set(item.productId, (delivered.get(item.productId) ?? 0) + item.quantity); if (item.result === '破损异常') damaged.set(item.productId, (damaged.get(item.productId) ?? 0) + item.quantity); if (item.source === '原订单' && item.result !== '客户留样') releaseReserved.set(item.productId, (releaseReserved.get(item.productId) ?? 0) + item.quantity) })
    else (order?.items ?? []).filter((item) => item.productId && ['现货', '展厅样品'].includes(item.supplyType)).forEach((item) => { delivered.set(item.productId!, item.quantity); releaseReserved.set(item.productId!, item.quantity) })
    const movements: InventoryMovement[] = []
    const products = current.products.map((product) => { const saleQty=delivered.get(product.id)??0; const lossQty=damaged.get(product.id)??0; const total=saleQty+lossQty; const afterStock=Math.max(0,product.availableStock-total); if(saleQty) movements.push({id:`movement-${Date.now()}-${product.id}-sale`,productId:product.id,sku:product.sku,productName:product.name,type:'销售出库',quantity:-saleQty,beforeStock:product.availableStock,afterStock:Math.max(0,product.availableStock-saleQty),note:`${order?.orderNo ?? task.orderId} · ${task.customerName} · 配送交接`,operator:task.owner,createdAt:now}); if(lossQty) movements.push({id:`movement-${Date.now()}-${product.id}-loss`,productId:product.id,sku:product.sku,productName:product.name,type:'报损出库',quantity:-lossQty,beforeStock:Math.max(0,product.availableStock-saleQty),afterStock,note:`${order?.orderNo ?? task.orderId} · 配送异常`,operator:task.owner,createdAt:now}); return total||releaseReserved.has(product.id)?{...product,availableStock:afterStock,reservedStock:Math.max(0,(product.reservedStock??0)-(releaseReserved.get(product.id)??0))}:product })
    const warehouseStocks=movements.reduce((stocks,movement)=>updateMainWarehouseStock(stocks,current.products,movement.productId,movement.quantity),current.warehouseStocks)
    return { ...current, products, warehouseStocks, inventoryMovements:[...movements,...current.inventoryMovements], deliveryTasks: current.deliveryTasks.map((item) => item.id === id ? { ...item, ...changes, completedAt:now, updatedAt:now } : item) }
  }), [])
  const addAfterSalesTicket = useCallback((item: AfterSalesTicket) => setState((current) => ({ ...current, afterSalesTickets: [item, ...current.afterSalesTickets] })), [])
  const updateAfterSalesTicket = useCallback((id: string, changes: Partial<AfterSalesTicket>) => setState((current) => ({ ...current, afterSalesTickets: current.afterSalesTickets.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })), [])
  const updateSupplyDemand = useCallback((id: string, changes: Partial<SupplyDemand>) => setState((current) => {
    const demand=current.supplyDemands.find((item)=>item.id===id); const now=new Date().toISOString(); const receiving=Boolean(demand&&['部分到货','已到货'].includes(String(changes.status))&&['外采产品','定制生产'].includes(demand.supplyType)); const acceptedTotal=changes.receivedQuantity??demand?.receivedQuantity??0; const receivedDelta=Math.max(0,acceptedTotal-(demand?.receivedQuantity??0))
    const nextDemands=current.supplyDemands.map((item)=>item.id===id?{...item,...changes,updatedAt:now}:item)
    const orderDemands=demand?nextDemands.filter((item)=>item.orderId===demand.orderId):[]; const ready=orderDemands.length>0&&orderDemands.every((item)=>['已锁定','已到货'].includes(item.status)); const partlyReady=orderDemands.some((item)=>['已锁定','部分到货','已到货'].includes(item.status)); const nextOrderStatus:SalesOrder['status']=ready?'已齐货':partlyReady?'部分齐货':'备货中'; const orders=demand?current.orders.map((item)=>item.id===demand.orderId?{...item,status:nextOrderStatus,updatedAt:now}:item):current.orders
    if(!receiving||!demand||receivedDelta<=0) return {...current,orders,supplyDemands:nextDemands}
    const order=current.orders.find((item)=>item.id===demand.orderId); const orderItem=order?.items?.find((item)=>item.id===demand.orderItemId); const product=current.products.find((item)=>item.id===orderItem?.productId)
    if(!product) return {...current,orders,supplyDemands:nextDemands}
    const afterStock=product.availableStock+receivedDelta; const movement:InventoryMovement={id:`movement-${Date.now()}-${product.id}`,productId:product.id,sku:product.sku,productName:product.name,type:'采购入库',quantity:receivedDelta,beforeStock:product.availableStock,afterStock,note:`${demand.orderNo} · ${demand.customerName} · 验收合格 ${receivedDelta}`,operator:changes.supplier||demand.supplier||'到货验收',createdAt:now}
    return {...current,orders,products:current.products.map((item)=>item.id===product.id?{...item,availableStock:afterStock,reservedStock:(item.reservedStock??0)+receivedDelta}:item),warehouseStocks:updateMainWarehouseStock(current.warehouseStocks,current.products,product.id,receivedDelta),inventoryMovements:[movement,...current.inventoryMovements],supplyDemands:nextDemands}
  }), [])
  const updateProduct = useCallback((id: string, changes: Partial<ProductCatalogItem>) => setState((current) => ({ ...current, products: current.products.map((item) => item.id === id ? { ...item, ...changes } : item) })), [])
  const addProduct = useCallback((item: ProductCatalogItem) => setState((current) => ({ ...current, products: [item, ...current.products], warehouseStocks:item.availableStock>0?[...current.warehouseStocks,{warehouseId:'warehouse-main',productId:item.id,quantity:item.availableStock,reservedQuantity:0}]:current.warehouseStocks })), [])
  const adjustInventory = useCallback((productId: string, quantity: number, type: InventoryMovement['type'], operator: string, note?: string) => setState((current) => { const product=current.products.find((item)=>item.id===productId); if(!product) return current; const beforeStock=product.availableStock; const afterStock=Math.max(0,beforeStock+quantity); const actualDelta=afterStock-beforeStock; const movement:InventoryMovement={id:`movement-${Date.now()}`,productId,sku:product.sku,productName:product.name,type,quantity:actualDelta,beforeStock,afterStock,note,operator,createdAt:new Date().toISOString()}; return {...current,products:current.products.map((item)=>item.id===productId?{...item,availableStock:afterStock}:item),warehouseStocks:updateMainWarehouseStock(current.warehouseStocks,current.products,productId,actualDelta),inventoryMovements:[movement,...current.inventoryMovements]} }),[])

  const addInventoryDocument = useCallback((document: InventoryDocument) => {
    try {
      const current = stateRef.current
      const previous = current.inventoryDocuments.find((item) => item.id === document.id)
      const result = applyInventoryDocument(current.products, current.warehouseStocks, document, previous)
      const inventoryDocuments = previous
        ? current.inventoryDocuments.map((item) => item.id === document.id ? result.document : item)
        : [result.document, ...current.inventoryDocuments]
      const next = { ...current, products:result.products, warehouseStocks:result.warehouseStocks, inventoryMovements:[...result.movements, ...current.inventoryMovements], inventoryDocuments }
      stateRef.current = next
      setState(next)
      return { ok:true }
    } catch (cause) { return { ok:false, error:cause instanceof Error ? cause.message : '库存单据处理失败' } }
  }, [])
  const addReplenishmentRequest = useCallback((request: ReplenishmentRequest) => setState((current) => ({ ...current, replenishmentRequests:[request, ...current.replenishmentRequests] })), [])
  const reviewReplenishmentRequest = useCallback((id: string, status: '已批准' | '已驳回' | '已转采购', reviewer: string, reviewNote?: string) => setState((current) => ({ ...current, replenishmentRequests:current.replenishmentRequests.map((item) => item.id === id ? { ...item, status, reviewer, reviewNote, updatedAt:new Date().toISOString() } : item) })), [])

  const replaceState = useCallback((next: Partial<SalesState> & Pick<SalesState, 'customers' | 'followUps' | 'designTasks' | 'orders' | 'deliveryTasks' | 'afterSalesTickets' | 'supplyDemands'>) => setState((current) => ({ ...current, ...next, products:next.products ?? current.products, inventoryMovements:next.inventoryMovements ?? current.inventoryMovements, warehouses:next.warehouses ?? current.warehouses, warehouseStocks:next.warehouseStocks ?? current.warehouseStocks, inventoryDocuments:next.inventoryDocuments ?? current.inventoryDocuments, replenishmentRequests:next.replenishmentRequests ?? current.replenishmentRequests })), [])
  const saveIntegrations = useCallback(async (settings: Record<string, Record<string, unknown>>) => {
    const result = await salesApi.putIntegrations(settings)
    setIntegrationSettings(result.integrations)
    await refreshAdminData()
  }, [refreshAdminData])
  const value = useMemo(() => ({ ...state, designers, salespeople, deliveryStaff, addCustomers, addFollowUp, addDesignTask, updateDesignTask, addOrder, registerDeal, updateOrder, addPayment, addDeliveryTask, updateDeliveryTask, addAfterSalesTicket, updateAfterSalesTicket, updateSupplyDemand, updateProduct, addProduct, adjustInventory, addInventoryDocument, addReplenishmentRequest, reviewReplenishmentRequest, replaceState, updateCustomer, serverStatus, auditEvents, integrationSettings, refreshAdminData, saveIntegrations }), [addAfterSalesTicket, addCustomers, addDeliveryTask, addDesignTask, addFollowUp, addInventoryDocument, addOrder, addProduct, addReplenishmentRequest, registerDeal, addPayment, adjustInventory, auditEvents, deliveryStaff, designers, integrationSettings, refreshAdminData, replaceState, reviewReplenishmentRequest, salespeople, saveIntegrations, serverStatus, state, updateAfterSalesTicket, updateCustomer, updateDeliveryTask, updateDesignTask, updateOrder, updateProduct, updateSupplyDemand])

  return <SalesDataContext.Provider value={value}>{children}</SalesDataContext.Provider>
}

export function useSalesData() {
  const value = useContext(SalesDataContext)
  if (!value) throw new Error('useSalesData must be used inside SalesDataProvider')
  return value
}
