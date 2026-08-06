import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Customer, DeliveryTask, SalesOrder } from '../../types'
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
  customers: [customer], orders: [order], deliveryTasks: [], products: [], afterSalesTickets: [], activeUser: '妙纯',
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
    expect(onAddTicket).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'o1', customerId: 'c1', source: '系统订单', contactPhone: '13800000000', productInfo: '黑胡桃木沙发', description: '沙发扶手需要安装调整', status: '待受理' }))
  })

  it('creates a detailed ticket for a historical customer without a system order', () => {
    const onAddTicket = vi.fn()
    render(<LifecyclePage {...base} onAddTicket={onAddTicket}/>)
    fireEvent.click(screen.getByRole('tab', { name: '售后服务' }))
    fireEvent.click(screen.getByRole('button', { name: '新建售后工单' }))
    fireEvent.click(screen.getByRole('button', { name: '历史老顾客' }))
    fireEvent.change(screen.getByLabelText('客户姓名 *'), { target: { value: '黄女士' } })
    fireEvent.change(screen.getByLabelText('联系电话 *'), { target: { value: '13900001111' } })
    fireEvent.change(screen.getByLabelText('详细地址 *'), { target: { value: '揭阳市榕城区' } })
    fireEvent.change(screen.getByLabelText('原购产品 *'), { target: { value: '黑胡桃餐桌 1.8 米' } })
    fireEvent.change(screen.getByLabelText('大致购买时间'), { target: { value: '2021-05-01' } })
    fireEvent.change(screen.getByLabelText('问题说明'), { target: { value: '桌脚松动，需要上门检修' } })
    fireEvent.click(screen.getByRole('button', { name: '创建工单' }))
    expect(onAddTicket).toHaveBeenCalledWith(expect.objectContaining({ source: '历史客户', customerName: '黄女士', contactPhone: '13900001111', address: '揭阳市榕城区', productInfo: '黑胡桃餐桌 1.8 米', purchaseAt: '2021-05-01', description: '桌脚松动，需要上门检修' }))
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
