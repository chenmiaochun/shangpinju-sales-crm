import type { OrderItem, ProductCatalogItem, SalesOrder } from '../../types'

export type FulfillmentTone = 'green' | 'orange' | 'red'

export interface ResolvedItemFulfillment {
  status: '现货' | '需订货' | '已到货待发货'
  availableStock: number
  expectedArrivalAt?: string
}

export interface OrderFulfillmentSummary {
  label: '可立即发货' | '部分现货，待订货到货' | '全部待订货' | '全部到货，可发货'
  detail: string
  tone: FulfillmentTone
  readyQuantity: number
  waitingQuantity: number
  earliestArrival?: string
  latestArrival?: string
}

const dateLabel = (value?: string) => {
  if (!value) return ''
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return year && month && day ? `${month}月${day}日` : value
}

export function availableStockFor(item: OrderItem, products: ProductCatalogItem[]) {
  const product = products.find(candidate => candidate.id === item.productId || (!!item.sku && candidate.sku === item.sku))
  if (!product) return Math.max(0, item.availableStock ?? 0)
  return Math.max(0, product.availableStock - (product.reservedStock ?? 0))
}

export function resolveItemFulfillment(item: OrderItem, products: ProductCatalogItem[]): ResolvedItemFulfillment {
  const availableStock = availableStockFor(item, products)
  if (item.arrivedAt || item.fulfillmentStatus === '已到货待发货') {
    return { status: '已到货待发货', availableStock, expectedArrivalAt: item.expectedArrivalAt }
  }
  const status = item.fulfillmentManual && item.fulfillmentStatus
    ? item.fulfillmentStatus
    : availableStock >= item.quantity ? '现货' : '需订货'
  return { status, availableStock, expectedArrivalAt: item.expectedArrivalAt }
}

export function summarizeOrderFulfillment(order: SalesOrder, products: ProductCatalogItem[]): OrderFulfillmentSummary {
  const items = order.items ?? []
  if (!items.length) return { label: '全部待订货', detail: '订单暂无商品明细', tone: 'red', readyQuantity: 0, waitingQuantity: 0 }
  const resolved = items.map(item => ({ item, result: resolveItemFulfillment(item, products) }))
  const waiting = resolved.filter(entry => entry.result.status === '需订货')
  const readyQuantity = resolved.filter(entry => entry.result.status !== '需订货').reduce((sum, entry) => sum + entry.item.quantity, 0)
  const waitingQuantity = waiting.reduce((sum, entry) => sum + entry.item.quantity, 0)
  const dates = waiting.map(entry => entry.result.expectedArrivalAt).filter((date): date is string => !!date).sort()
  const earliestArrival = dates[0]
  const latestArrival = dates.at(-1)
  if (!waiting.length) {
    const allArrived = resolved.every(entry => entry.result.status === '已到货待发货')
    return { label: allArrived ? '全部到货，可发货' : '可立即发货', detail: `共 ${readyQuantity} 件可发货`, tone: 'green', readyQuantity, waitingQuantity }
  }
  if (!readyQuantity) {
    const dateDetail = earliestArrival
      ? `最早到货日期：${dateLabel(earliestArrival)}，最晚到货日期：${dateLabel(latestArrival)}`
      : '尚未填写预计到货日期'
    return { label: '全部待订货', detail: dateDetail, tone: 'red', readyQuantity, waitingQuantity, earliestArrival, latestArrival }
  }
  const arrivalDetail = earliestArrival ? `，最早到货日期：${dateLabel(earliestArrival)}` : '，尚未填写预计到货日期'
  return { label: '部分现货，待订货到货', detail: `${readyQuantity}件现货，${waitingQuantity}件待到货${arrivalDetail}`, tone: 'orange', readyQuantity, waitingQuantity, earliestArrival, latestArrival }
}

export function hasArrivalReminder(order: SalesOrder, products: ProductCatalogItem[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return (order.items ?? []).some(item => {
    const result = resolveItemFulfillment(item, products)
    if (result.status !== '需订货' || !result.expectedArrivalAt) return false
    const due = new Date(`${result.expectedArrivalAt.slice(0, 10)}T00:00:00`).getTime()
    const days = Math.ceil((due - today) / 86_400_000)
    return days <= 3
  })
}
