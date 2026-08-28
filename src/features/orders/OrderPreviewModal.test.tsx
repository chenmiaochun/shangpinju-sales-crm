import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SalesOrder } from '../../types'
import { OrderPreviewModal } from './OrderPreviewModal'

const baseOrder: SalesOrder = {
  id: 'o1',
  orderNo: 'SPJ-QUOTE1',
  customerId: 'c1',
  customerName: '陈女士',
  salesperson: '小林',
  collaborators: [],
  products: [],
  items: [{ id: 'i1', productName: '1.8m 黑胡桃圆餐桌', specification: '1.8m', quantity: 1, unit: '套', material: '黑胡桃', unitPrice: 6800, supplyType: '现货' }],
  contractAmount: 6800,
  signedAt: '2026-08-08',
  status: '草稿',
  payments: [],
  performanceRate: 100,
  createdAt: '2026-08-08',
  updatedAt: '2026-08-08',
}

describe('OrderPreviewModal 4.3 报价单/销售单打印切换', () => {
  it('草稿订单默认进入报价单样式：展示有效期、报价条款、无签名区/定金', () => {
    render(<OrderPreviewModal order={baseOrder} onClose={vi.fn()} onUpdate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '尚品居产品报价单' })).toBeTruthy()
    expect(screen.getByText(/有效期至：/)).toBeTruthy()
    expect(screen.getByText(/本报价单有效期至/)).toBeTruthy()
    expect(screen.queryByLabelText('客户电子签名板')).toBeNull()
    expect(screen.queryByText('已收订金')).toBeNull()
  })

  it('切到销售单样式后标题、签名板、定金信息出现', () => {
    render(<OrderPreviewModal order={baseOrder} onClose={vi.fn()} onUpdate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '销售单样式' }))
    expect(screen.getByRole('heading', { name: '尚品居产品销售单' })).toBeTruthy()
    expect(screen.getByLabelText('客户电子签名板')).toBeTruthy()
    expect(screen.getByText(/已收订金/)).toBeTruthy()
  })

  it('编辑有效期调用 onUpdate 写入 quoteValidUntil', () => {
    const onUpdate = vi.fn()
    render(<OrderPreviewModal order={baseOrder} onClose={vi.fn()} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByLabelText('有效期至'), { target: { value: '2026-09-30' } })
    expect(onUpdate).toHaveBeenCalledWith('o1', { quoteValidUntil: '2026-09-30' })
  })

  it('非草稿订单默认进入销售单样式', () => {
    const salesOrder = { ...baseOrder, status: '已生效' as const }
    render(<OrderPreviewModal order={salesOrder} onClose={vi.fn()} onUpdate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: '尚品居产品销售单' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: '尚品居产品报价单' })).toBeNull()
  })
})
