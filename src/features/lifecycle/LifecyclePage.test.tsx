import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Customer, SalesOrder } from '../../types'
import { LifecyclePage } from './LifecyclePage'

const customer: Customer = {
  id: 'c1', name: '陈女士', phone: '13800000000', source: '视频号', salesperson: '妙纯', stage: '已报价', intent: '高',
  expectedAmount: 120000, products: ['黑胡桃木沙发'], style: '新中式', budget: '10-15万', renovationProgress: '硬装完成', concerns: [], lastContactAt: '2026-08-01', createdAt: '2026-07-01',
}

const order: SalesOrder = {
  id: 'o1', orderNo: 'SPJ0001', customerId: 'c1', customerName: '陈女士', salesperson: '妙纯', collaborators: [], products: ['黑胡桃木沙发'],
  contractAmount: 120000, signedAt: '2026-08-01', status: '已签约', payments: [], performanceRate: 100, createdAt: '2026-08-01', updatedAt: '2026-08-01',
}

const base = {
  customers: [customer], orders: [order], deliveryTasks: [], afterSalesTickets: [], activeUser: '妙纯',
  onAddOrder: vi.fn(), onUpdateOrder: vi.fn(), onAddPayment: vi.fn(), onAddDelivery: vi.fn(), onUpdateDelivery: vi.fn(), onAddTicket: vi.fn(), onUpdateTicket: vi.fn(),
}

describe('LifecyclePage', () => {
  it('registers a payment against the selected order', () => {
    const onAddPayment = vi.fn()
    render(<LifecyclePage {...base} onAddPayment={onAddPayment}/>)
    fireEvent.click(screen.getByRole('button', { name: '登记收款' }))
    fireEvent.change(screen.getByLabelText('收款金额'), { target: { value: '30000' } })
    fireEvent.click(screen.getByRole('button', { name: '确认登记' }))
    expect(onAddPayment).toHaveBeenCalledWith('o1', expect.objectContaining({ amount: 30000, type: '定金', recordedBy: '妙纯' }))
  })

  it('creates an after-sales ticket from an order', () => {
    const onAddTicket = vi.fn()
    render(<LifecyclePage {...base} onAddTicket={onAddTicket}/>)
    fireEvent.click(screen.getByRole('tab', { name: '售后服务' }))
    fireEvent.click(screen.getByRole('button', { name: '新建售后工单' }))
    fireEvent.change(screen.getByLabelText('问题说明'), { target: { value: '沙发扶手需要安装调整' } })
    fireEvent.click(screen.getByRole('button', { name: '创建工单' }))
    expect(onAddTicket).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o1', customerId: 'c1', description: '沙发扶手需要安装调整', status: '待受理' }))
  })
})

