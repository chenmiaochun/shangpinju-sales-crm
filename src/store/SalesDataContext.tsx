import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { salesApi, type RemoteAuditEvent } from '../api/salesApi'
import { customers as seedCustomers, followUps as seedFollowUps } from '../data'
import type { AfterSalesTicket, Customer, DeliveryTask, DesignTask, FollowUp, PaymentRecord, SalesOrder } from '../types'

const STORAGE_KEY = 'shangpinju.customer-followup.v1'
const REMOVED_DEMO_EMPLOYEES = new Set(['周然', '林晓', '何静'])

export interface SalesState {
  customers: Customer[]
  followUps: FollowUp[]
  designTasks: DesignTask[]
  orders: SalesOrder[]
  deliveryTasks: DeliveryTask[]
  afterSalesTickets: AfterSalesTicket[]
}

export function removeFormerDemoEmployees(state: SalesState): SalesState {
  const customers = state.customers.filter((customer) => !REMOVED_DEMO_EMPLOYEES.has(customer.salesperson))
  const customerIds = new Set(customers.map((customer) => customer.id))
  return {
    customers,
    followUps: state.followUps.filter((item) => customerIds.has(item.customerId) && !REMOVED_DEMO_EMPLOYEES.has(item.salesperson)),
    designTasks: state.designTasks.filter((item) => customerIds.has(item.customerId) && !REMOVED_DEMO_EMPLOYEES.has(item.salesperson)),
    orders: (state.orders ?? []).filter((item) => customerIds.has(item.customerId)),
    deliveryTasks: (state.deliveryTasks ?? []).filter((item) => customerIds.has(item.customerId)),
    afterSalesTickets: (state.afterSalesTickets ?? []).filter((item) => customerIds.has(item.customerId)),
  }
}
interface SalesDataValue extends SalesState {
  designers: { id: string; name: string }[]
  salespeople: { id: string; name: string }[]
  addCustomers: (items: Customer[]) => void
  addFollowUp: (item: FollowUp) => void
  addDesignTask: (item: DesignTask) => void
  updateDesignTask: (id: string, changes: Partial<DesignTask>) => void
  addOrder: (item: SalesOrder) => void
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
  if (typeof window === 'undefined') return { customers: seedCustomers, followUps: seedFollowUps, designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [] }
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
      })
    }
  } catch { /* Fall back to bundled sample data. */ }
  return { customers: seedCustomers, followUps: seedFollowUps, designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [] }
}

export function SalesDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SalesState>(loadState)
  const [serverStatus, setServerStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [auditEvents, setAuditEvents] = useState<RemoteAuditEvent[]>([])
  const [integrationSettings, setIntegrationSettings] = useState<Record<string, Record<string, unknown>>>({})
  const [designers, setDesigners] = useState<{ id: string; name: string }[]>([])
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([])
  const hydrated = useRef(false)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const refreshAdminData = useCallback(async () => {
    const [audit, integrations] = await Promise.all([salesApi.getAudit(), salesApi.getIntegrations()])
    setAuditEvents(audit.items)
    setIntegrationSettings(integrations.integrations)
  }, [])

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
          }))
        } else {
          await salesApi.putState(state)
        }
        try { const result = await salesApi.getDesigners(); if (result.designers.length) setDesigners(result.designers.map((item) => ({ id: item.id, name: item.name }))) } catch { /* Keep local fallback when designer directory is unavailable. */ }
        try { const result = await salesApi.getSalespeople(); if (result.salespeople.length) setSalespeople(result.salespeople.map((item) => ({ id: item.id, name: item.name }))) } catch { /* Keep local fallback when salesperson directory is unavailable. */ }
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
  }, [refreshAdminData])

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
  const value = useMemo(() => ({ ...state, designers, salespeople, addCustomers, addFollowUp, addDesignTask, updateDesignTask, addOrder, updateOrder, addPayment, addDeliveryTask, updateDeliveryTask, addAfterSalesTicket, updateAfterSalesTicket, replaceState, updateCustomer, serverStatus, auditEvents, integrationSettings, refreshAdminData, saveIntegrations }), [addAfterSalesTicket, addCustomers, addDeliveryTask, addDesignTask, addFollowUp, addOrder, addPayment, auditEvents, designers, integrationSettings, refreshAdminData, replaceState, salespeople, saveIntegrations, serverStatus, state, updateAfterSalesTicket, updateCustomer, updateDeliveryTask, updateDesignTask, updateOrder])

  return <SalesDataContext.Provider value={value}>{children}</SalesDataContext.Provider>
}

export function useSalesData() {
  const value = useContext(SalesDataContext)
  if (!value) throw new Error('useSalesData must be used inside SalesDataProvider')
  return value
}
