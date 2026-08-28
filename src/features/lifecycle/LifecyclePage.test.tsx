import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Customer, DeliveryTask, SalesOrder } from '../../types'
import { LifecyclePage } from './LifecyclePage'

const customer: Customer = {
  id: 'c1', name: '陈女士', phone: '13800000000', source: '视频号', salesperson: '妙纯', stage: '已报价', intent: '高',
  expectedAmount: 120000, products: ['黑胡桃木沙发'], style: '新中式', budget: '10-15万', renovationProgress: '硬装完成', concerns: [], lastContactAt: '2026-08-01', createdAt: '2026-07-01',
}

const order: SalesOrder = {
  id: 'o1', orderNo: 'SPJ0001', customerId: 'c1', customerName: '陈女士', salesperson: '妙纯', collaborators: [], products: ['黑胡桃木沙发'],
  contractAmount: 120000, signedAt: '2026-08-01', status: '已齐货', payments: [], performanceRate: 100, createdAt: '2026-08-01', updatedAt: '2026-08-01',
}

const base = {
  customers: [customer], orders: [order], deliveryTasks: [], products: [], afterSalesTickets: [], activeUser: '妙纯',
  onUpdateOrder: vi.fn(), onAddPayment: vi.fn(), onAddDelivery: vi.fn(), onUpdateDelivery: vi.fn(),
}

describe('LifecyclePage', () => {
  it('keeps after-sales out of the order lifecycle tabs', () => {
    render(<LifecyclePage {...base}/>)
    expect(screen.queryByRole('tab', { name: '售后服务' })).toBeNull()
    expect(screen.queryByRole('button', { name: '新建售后工单' })).toBeNull()
  })

  it('starts delivery from the matching customer order instead of a global action', () => {
    const onAddDelivery = vi.fn()
    render(<LifecyclePage {...base} onAddDelivery={onAddDelivery}/>)
    fireEvent.click(screen.getByRole('tab', { name: '交付安装' }))
    expect(screen.queryByRole('button', { name:'新增交付任务' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name:'安排交付' }))
    expect(screen.getByRole('dialog', { name:'安排发货 · 陈女士' })).toBeTruthy()
  })
  it('allows a partial order to deliver only ready products', () => {
    const partialOrder: SalesOrder = { ...order, id:'o-partial', orderNo:'SPJ-PART', status:'部分齐货', products:['餐桌','餐椅'], items:[{id:'ready-item',productName:'餐桌',quantity:1,unitPrice:9800,supplyType:'现货'},{id:'waiting-item',productName:'餐椅',quantity:4,unitPrice:1600,supplyType:'外采产品'}] }
    const demands = [{id:'d-ready',orderId:'o-partial',orderNo:'SPJ-PART',customerId:'c1',customerName:'陈女士',orderItemId:'ready-item',productName:'餐桌',quantity:1,supplyType:'现货',demandType:'库存锁定',status:'已锁定',createdAt:'2026-08-08',updatedAt:'2026-08-08'},{id:'d-wait',orderId:'o-partial',orderNo:'SPJ-PART',customerId:'c1',customerName:'陈女士',orderItemId:'waiting-item',productName:'餐椅',quantity:4,supplyType:'外采产品',demandType:'采购需求',status:'采购中',createdAt:'2026-08-08',updatedAt:'2026-08-08'}] as const
    render(<LifecyclePage {...base} orders={[partialOrder]} supplyDemands={[...demands]}/>)
    fireEvent.click(screen.getByRole('tab', { name: '交付安装' }))
    fireEvent.click(screen.getByRole('button', { name:'安排分批交付' }))
    const dialog=screen.getByRole('dialog',{name:'安排发货 · 陈女士'})
    expect(within(dialog).getByText(/餐桌/)).toBeTruthy()
    expect(within(dialog).queryByText(/餐椅/)).toBeNull()
  })
  it('registers a payment against the selected order', () => {
    const onAddPayment = vi.fn()
    render(<LifecyclePage {...base} onAddPayment={onAddPayment}/>)
    fireEvent.click(screen.getByRole('button', { name: '登记收款' }))
    fireEvent.change(screen.getByLabelText('收款金额'), { target: { value: '30000' } })
    fireEvent.click(screen.getByRole('button', { name: '确认登记' }))
    expect(onAddPayment).toHaveBeenCalledWith('o1', expect.objectContaining({ amount: 30000, type: '定金', recordedBy: '妙纯' }))
  })

  it('shows the delivery customer list by expected month', () => {
    const deliveries: DeliveryTask[] = [
      { id: 'd-aug', orderId: 'o1', customerId: 'c1', customerName: '陈女士', address: '揭阳', contactPhone: '13800000000', expectedDeliveryMonth: '2026-08', status: '待排期', owner: '孙售后', createdAt: '2026-08-01', updatedAt: '2026-08-01' },
      { id: 'd-sep', orderId: 'o2', customerId: 'c2', customerName: '林先生', address: '汕头', contactPhone: '13900000000', expectedDeliveryMonth: '2026-09', status: '已排期', owner: '黄师傅', createdAt: '2026-08-01', updatedAt: '2026-08-01' },
    ]
    render(<LifecyclePage {...base} deliveryTasks={deliveries}/>)
    fireEvent.click(screen.getByRole('tab', { name: '交付安装' }))
    expect(screen.getByRole('heading', { name: '2026 年 08 月送货客户清单' })).toBeTruthy()
    expect(screen.getAllByText('陈女士')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name:/2026 年 09 月/ }))
    expect(screen.getByRole('heading', { name: '2026 年 09 月送货客户清单' })).toBeTruthy()
    expect(screen.getAllByText('林先生')).toHaveLength(2)
    expect(screen.getAllByText('陈女士')).toHaveLength(1)
  })

  it('records every loaded product result before completing delivery handover', () => {
    const onUpdateDelivery = vi.fn()
    const delivery: DeliveryTask = { id: 'd1', orderId: 'o1', customerId: 'c1', customerName: '陈女士', address: '揭阳', contactPhone: '13800000000', expectedDeliveryMonth: '2026-08', status: '已排期', owner: '孙售后', createdAt: '2026-08-01', updatedAt: '2026-08-01' }
    render(<LifecyclePage {...base} deliveryTasks={[delivery]} onUpdateDelivery={onUpdateDelivery}/>)
    fireEvent.click(screen.getByRole('tab', { name: '交付安装' }))
    fireEvent.click(screen.getByRole('button', { name: '开始交接' }))
    expect((screen.getByRole('button', { name: '还有 1 项未确认' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('黑胡桃木沙发现场结果'), { target: { value: '客户留下' } })
    fireEvent.click(screen.getByRole('button', { name: '完成交接' }))
    expect(onUpdateDelivery).toHaveBeenCalledWith('d1', expect.objectContaining({ status: '已完成', settlementStatus: '无需结算', handoverItems: [expect.objectContaining({ productName: '黑胡桃木沙发', result: '客户留下' })] }))
  })
})
