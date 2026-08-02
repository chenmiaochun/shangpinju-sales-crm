import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { salesApi, type RemoteAuditEvent } from '../api/salesApi'
import { customers as seedCustomers, followUps as seedFollowUps } from '../data'
import type { AfterSalesTicket, Customer, DeliveryTask, DesignTask, FollowUp, OrderItem, PaymentRecord, SalesOrder, SupplyDemand } from '../types'

const STORAGE_KEY = 'shangpinju.customer-followup.v1'
const REMOVED_DEMO_EMPLOYEES = new Set(['周然', '林晓', '何静'])

export interface SalesState {
  customers: Customer[]
  followUps: FollowUp[]
  designTasks: DesignTask[]
  orders: SalesOrder[]
  deliveryTasks: DeliveryTask[]
  afterSalesTickets: AfterSalesTicket[]
  supplyDemands: SupplyDemand[]
}

export function removeFormerDemoEmployees(state: SalesState): SalesState {
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
  replaceState: (state: SalesState) => void
  updateCustomer: (id: string, changes: Partial<Customer>) => void
  serverStatus: 'connecting' | 'connected' | 'offline'
  auditEvents: RemoteAuditEvent[]
  integrationSettings: Record<string, Record<string, unknown>>
  refreshAdminData: () => Promise<void>
  saveIntegrations: (settings: Record<string, Record<string, unknown>>) => Promise<void>
}

const SalesDataContext = createContext<SalesDataValue | null>(null)

function loadState(): SalesState {
  if (typeof window === 'undefined') return { customers: seedCustomers, followUps: seedFollowUps, designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [], supplyDemands: [] }
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
      })
    }
  } catch { /* Fall back to bundled sample data. */ }
  return { customers: seedCustomers, followUps: seedFollowUps, designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [], supplyDemands: [] }
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
    const demands: SupplyDemand[] = input.items.map((item, index) => ({ id: `supply-${suffix}-${index}`, orderId, orderNo, customerId: input.customer.id, customerName: input.customer.name, orderItemId: item.id, productName: item.productName, specification: item.specification, quantity: item.quantity, supplyType: item.supplyType, demandType: demandMap[item.supplyType][0], status: demandMap[item.supplyType][1], expectedAt: input.expectedDeliveryAt, createdAt: now, updatedAt: now }))
    const deliveryTask: DeliveryTask = { id: `delivery-${suffix}`, orderId, customerId: input.customer.id, customerName: input.customer.name, address: input.customer.cityArea ?? '', contactPhone: input.customer.phone, scheduledAt: input.expectedDeliveryAt, expectedDeliveryMonth: input.expectedDeliveryMonth, remindAt: input.deliveryReminderAt, status: input.expectedDeliveryAt ? '已排期' : '待排期', owner: input.deliveryOwner ?? '待指派', ownerId: input.deliveryOwnerId, createdAt: now, updatedAt: now }
    return { ...current, orders: [order, ...current.orders], supplyDemands: [...demands, ...(current.supplyDemands ?? [])], deliveryTasks: [deliveryTask, ...current.deliveryTasks], customers: current.customers.map((customer) => customer.id === input.customer.id ? { ...customer, stage: '已定金', dealAmount: input.contractAmount, paidAmount: input.deposit, dealDate: input.signedAt, deliveryDate: input.expectedDeliveryAt, dealProducts: order.products, nextFollowUpAt: input.deliveryReminderAt ? new Date(`${input.deliveryReminderAt}T09:00:00`).toISOString() : undefined, marketingStatus: input.marketingStatus, marketingNextAt: input.marketingNextAt, marketingNote: input.marketingNote } : customer) }
  }), [])
  const updateOrder = useCallback((id: string, changes: Partial<SalesOrder>) => setState((current) => ({ ...current, orders: current.orders.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })), [])
  const addPayment = useCallback((orderId: string, payment: PaymentRecord) => setState((current) => {
    const orders = current.orders.map((order) => order.id === orderId ? { ...order, payments: [payment, ...order.payments], updatedAt: new Date().toISOString() } : order)
    const order = orders.find((item) => item.id === orderId)
    const paidAmount = order?.payments.reduce((sum, item) => sum + (item.type === '退款' ? -item.amount : item.amount), 0) ?? 0
    return { ...current, orders, customers: current.customers.map((customer) => customer.id === order?.customerId ? { ...customer, paidAmount } : customer) }
  }), [])
  const addDeliveryTask = useCallback((item: DeliveryTask) => setState((current) => ({ ...current, deliveryTasks: [item, ...current.deliveryTasks] })), [])
  const updateDeliveryTask = useCallback((id: string, changes: Partial<DeliveryTask>) => setState((current) => ({ ...current, deliveryTasks: current.deliveryTasks.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })), [])
  const addAfterSalesTicket = useCallback((item: AfterSalesTicket) => setState((current) => ({ ...current, afterSalesTickets: [item, ...current.afterSalesTickets] })), [])
  const updateAfterSalesTicket = useCallback((id: string, changes: Partial<AfterSalesTicket>) => setState((current) => ({ ...current, afterSalesTickets: current.afterSalesTickets.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) })), [])

  const replaceState = useCallback((next: SalesState) => setState(next), [])
  const saveIntegrations = useCallback(async (settings: Record<string, Record<string, unknown>>) => {
    const result = await salesApi.putIntegrations(settings)
    setIntegrationSettings(result.integrations)
    await refreshAdminData()
  }, [refreshAdminData])
  const value = useMemo(() => ({ ...state, designers, salespeople, deliveryStaff, addCustomers, addFollowUp, addDesignTask, updateDesignTask, addOrder, registerDeal, updateOrder, addPayment, addDeliveryTask, updateDeliveryTask, addAfterSalesTicket, updateAfterSalesTicket, replaceState, updateCustomer, serverStatus, auditEvents, integrationSettings, refreshAdminData, saveIntegrations }), [addAfterSalesTicket, addCustomers, addDeliveryTask, addDesignTask, addFollowUp, addOrder, registerDeal, addPayment, auditEvents, deliveryStaff, designers, integrationSettings, refreshAdminData, replaceState, salespeople, saveIntegrations, serverStatus, state, updateAfterSalesTicket, updateCustomer, updateDeliveryTask, updateDesignTask, updateOrder])

  return <SalesDataContext.Provider value={value}>{children}</SalesDataContext.Provider>
}

export function useSalesData() {
  const value = useContext(SalesDataContext)
  if (!value) throw new Error('useSalesData must be used inside SalesDataProvider')
  return value
}
