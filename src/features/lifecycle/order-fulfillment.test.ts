import { describe, expect, it } from 'vitest'
import type { OrderItem, ProductCatalogItem, SalesOrder } from '../../types'
import { hasArrivalReminder, summarizeOrderFulfillment } from './order-fulfillment'

const products: ProductCatalogItem[] = [
  { id: 'stock', sku: 'S1', name: '现货椅', specifications: [], unitPrice: 1000, supplyType: '现货', availableStock: 5 },
  { id: 'order', sku: 'S2', name: '订货桌', specifications: [], unitPrice: 5000, supplyType: '定制生产', availableStock: 0 },
]
const item = (changes: Partial<OrderItem>): OrderItem => ({ id: 'i', productId: 'stock', productName: '现货椅', quantity: 1, unitPrice: 1000, supplyType: '现货', ...changes })
const order = (items: OrderItem[]): SalesOrder => ({ id: 'o', orderNo: 'NO.1', customerId: 'c', customerName: '客户', salesperson: '销售', collaborators: [], products: items.map(entry => entry.productName), items, contractAmount: 10000, signedAt: '2026-08-24', status: '备货中', payments: [], performanceRate: 100, createdAt: '2026-08-24', updatedAt: '2026-08-24' })

describe('订单库存履约状态', () => {
  it('全部库存充足时可立即发货', () => expect(summarizeOrderFulfillment(order([item({ quantity: 2 })]), products)).toMatchObject({ label: '可立即发货', readyQuantity: 2, waitingQuantity: 0 }))
  it('一半现货一半订货时显示数量和最早到货日', () => { const result = summarizeOrderFulfillment(order([item({ id: 'a', quantity: 2 }), item({ id: 'b', productId: 'order', productName: '订货桌', quantity: 1, expectedArrivalAt: '2026-09-10' })]), products); expect(result).toMatchObject({ label: '部分现货，待订货到货', readyQuantity: 2, waitingQuantity: 1, earliestArrival: '2026-09-10' }); expect(result.detail).toContain('9月10日') })
  it('全部订货时显示最早和最晚日期', () => { const result = summarizeOrderFulfillment(order([item({ id: 'a', productId: 'order', expectedArrivalAt: '2026-09-10' }), item({ id: 'b', productId: 'order', expectedArrivalAt: '2026-09-18' })]), products); expect(result).toMatchObject({ label: '全部待订货', earliestArrival: '2026-09-10', latestArrival: '2026-09-18' }); expect(result.detail).toContain('9月18日') })
  it('预计到货前三天开始提醒', () => expect(hasArrivalReminder(order([item({ productId: 'order', expectedArrivalAt: '2026-08-27' })]), products, new Date('2026-08-24T12:00:00'))).toBe(true))
})
