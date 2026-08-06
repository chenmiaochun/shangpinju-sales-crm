import type { InventoryDocument, InventoryMovement, ProductCatalogItem, Warehouse, WarehouseStock } from '../../types'

export const defaultWarehouses: Warehouse[] = [
  { id: 'warehouse-main', name: '尚品居总仓', type: '总仓', active: true },
  { id: 'warehouse-showroom', name: '展厅样品仓', type: '展厅仓', active: true },
  { id: 'warehouse-transit', name: '送货车临时仓', type: '临时仓', active: true },
]

export function initializeWarehouseStocks(products: ProductCatalogItem[], stocks: WarehouseStock[]) {
  if (stocks.length) return stocks
  return products.filter((item) => item.availableStock > 0).map((item) => ({ warehouseId: 'warehouse-main', productId: item.id, quantity: item.availableStock, reservedQuantity: item.reservedStock ?? 0 }))
}

const isPosted = (status: InventoryDocument['status']) => status === '已过账' || status === '已完成'

export function applyInventoryDocument(products: ProductCatalogItem[], stocks: WarehouseStock[], document: InventoryDocument, previous?: InventoryDocument) {
  if (previous && isPosted(previous.status) && document.status !== '已取消') throw new Error('已过账单据不可修改，请先冲销')
  if (previous?.status === '已取消') throw new Error('已取消单据不可再次处理')
  if (!isPosted(document.status) && document.status !== '已取消') {
    return { products, warehouseStocks: initializeWarehouseStocks(products, stocks), movements: [] as InventoryMovement[], document: { ...document, documentVersion: document.documentVersion ?? 1 } }
  }
  const cancelling = document.status === '已取消'
  if (cancelling && (!previous || !isPosted(previous.status))) throw new Error('只有已过账单据可以冲销')
  const source = cancelling ? previous : document
  if (!source) throw new Error('库存单据不存在')
  const product = products.find((item) => item.id === document.productId)
  if (!product) throw new Error('商品不存在')
  if (!Number.isFinite(document.quantity) || document.quantity <= 0) throw new Error('数量必须大于0')
  const now = new Date().toISOString()
  const currentStocks = initializeWarehouseStocks(products, stocks).map((item) => ({ ...item }))
  const quantityAt = (warehouseId?: string) => currentStocks.find((item) => item.warehouseId === warehouseId && item.productId === document.productId)?.quantity ?? 0
  const updateStock = (warehouseId: string, delta: number) => {
    const found = currentStocks.find((item) => item.warehouseId === warehouseId && item.productId === document.productId)
    if (found) return currentStocks.map((item) => item === found ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item)
    return [...currentStocks, { warehouseId, productId: document.productId, quantity: Math.max(0, delta), reservedQuantity: 0 }]
  }
  const movement = (type: InventoryMovement['type'], quantity: number, beforeStock: number, afterStock: number, suffix = ''): InventoryMovement => ({ id: `movement-${Date.now()}-${document.id}${suffix}`, productId: product.id, sku: product.sku, productName: product.name, type, quantity, beforeStock, afterStock, note: `${document.documentNo}${document.note ? ` · ${document.note}` : ''}`, operator: document.operator, createdAt: now })

  let nextStocks = currentStocks
  let stockDelta = 0
  let movements: InventoryMovement[] = []
  const effectiveQuantity = source.type === '到货入库' ? (source.acceptedQuantity ?? source.quantity) : source.quantity
  if (source.type === '到货入库' && effectiveQuantity + (source.rejectedQuantity ?? 0) > source.quantity) throw new Error('合格与不合格数量不能超过到货数量')
  if (source.type === '到货入库' && effectiveQuantity <= 0) throw new Error('没有验收合格数量，不能过账入库')
  const direction = cancelling ? -1 : 1
  if (source.type === '仓库调拨') {
    if (!source.fromWarehouseId || !source.toWarehouseId || source.fromWarehouseId === source.toWarehouseId) throw new Error('请选择不同的调出仓和调入仓')
    const outboundWarehouse = cancelling ? source.toWarehouseId : source.fromWarehouseId
    const inboundWarehouse = cancelling ? source.fromWarehouseId : source.toWarehouseId
    if (quantityAt(outboundWarehouse) < effectiveQuantity) throw new Error(cancelling ? '调入仓库存不足，无法冲销' : '调出仓库存不足')
    nextStocks = updateStock(outboundWarehouse, -effectiveQuantity)
    const target = nextStocks.find((item) => item.warehouseId === inboundWarehouse && item.productId === source.productId)
    nextStocks = target ? nextStocks.map((item) => item === target ? { ...item, quantity: item.quantity + effectiveQuantity } : item) : [...nextStocks, { warehouseId: inboundWarehouse, productId: source.productId, quantity: effectiveQuantity, reservedQuantity: 0 }]
    movements = [movement('调拨出库', -effectiveQuantity, product.availableStock, product.availableStock, '-out'), movement('调拨入库', effectiveQuantity, product.availableStock, product.availableStock, '-in')]
  } else {
    const inbound = source.type === '到货入库' || source.type === '客户退货'
    stockDelta = (inbound ? effectiveQuantity : -effectiveQuantity) * direction
    const warehouseId = inbound ? source.toWarehouseId : source.fromWarehouseId
    if (!warehouseId) throw new Error(inbound ? '请选择入库仓库' : '请选择出库仓库')
    if (stockDelta < 0 && quantityAt(warehouseId) < Math.abs(stockDelta)) throw new Error(cancelling ? '当前库存不足，无法冲销' : '仓库可用库存不足')
    nextStocks = updateStock(warehouseId, stockDelta)
    const movementType: InventoryMovement['type'] = source.type === '到货入库' ? '采购入库' : source.type === '客户退货' ? '退货入库' : source.type === '销售出库' ? '销售出库' : source.type === '破损报废' ? '报损出库' : '库存调整'
    movements = [movement(movementType, stockDelta, product.availableStock, Math.max(0, product.availableStock + stockDelta))]
  }
  const nextProducts = stockDelta === 0 ? products : products.map((item) => item.id === product.id ? { ...item, availableStock: Math.max(0, item.availableStock + stockDelta) } : item)
  return { products: nextProducts, warehouseStocks: nextStocks, movements, document: cancelling
    ? { ...previous!, status:'已取消' as const, cancelledBy:document.cancelledBy ?? document.operator, cancelledAt:now, cancellationReason:document.cancellationReason, documentVersion:(previous!.documentVersion ?? 1) + 1 }
    : { ...document, status:'已过账' as const, submittedBy:document.submittedBy ?? document.operator, postedBy:document.postedBy ?? document.operator, postingAt:document.postingAt ?? now, completedAt:now, documentVersion:document.documentVersion ?? 1 } }
}
