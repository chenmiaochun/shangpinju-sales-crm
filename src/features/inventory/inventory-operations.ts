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

export function applyInventoryDocument(products: ProductCatalogItem[], stocks: WarehouseStock[], document: InventoryDocument) {
  const product = products.find((item) => item.id === document.productId)
  if (!product) throw new Error('商品不存在')
  if (!Number.isFinite(document.quantity) || document.quantity <= 0) throw new Error('数量必须大于0')
  const now = new Date().toISOString()
  const currentStocks = initializeWarehouseStocks(products, stocks)
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
  if (document.type === '仓库调拨') {
    if (!document.fromWarehouseId || !document.toWarehouseId || document.fromWarehouseId === document.toWarehouseId) throw new Error('请选择不同的调出仓和调入仓')
    if (quantityAt(document.fromWarehouseId) < document.quantity) throw new Error('调出仓库存不足')
    nextStocks = updateStock(document.fromWarehouseId, -document.quantity)
    const target = nextStocks.find((item) => item.warehouseId === document.toWarehouseId && item.productId === document.productId)
    nextStocks = target ? nextStocks.map((item) => item === target ? { ...item, quantity: item.quantity + document.quantity } : item) : [...nextStocks, { warehouseId: document.toWarehouseId, productId: document.productId, quantity: document.quantity, reservedQuantity: 0 }]
    movements = [movement('调拨出库', -document.quantity, product.availableStock, product.availableStock, '-out'), movement('调拨入库', document.quantity, product.availableStock, product.availableStock, '-in')]
  } else {
    const inbound = document.type === '到货入库' || document.type === '客户退货'
    stockDelta = inbound ? document.quantity : -document.quantity
    const warehouseId = inbound ? document.toWarehouseId : document.fromWarehouseId
    if (!warehouseId) throw new Error(inbound ? '请选择入库仓库' : '请选择出库仓库')
    if (!inbound && quantityAt(warehouseId) < document.quantity) throw new Error('仓库可用库存不足')
    nextStocks = updateStock(warehouseId, stockDelta)
    const movementType: InventoryMovement['type'] = document.type === '到货入库' ? '采购入库' : document.type === '客户退货' ? '退货入库' : document.type === '销售出库' ? '销售出库' : document.type === '破损报废' ? '报损出库' : '库存调整'
    movements = [movement(movementType, stockDelta, product.availableStock, Math.max(0, product.availableStock + stockDelta))]
  }
  const nextProducts = stockDelta === 0 ? products : products.map((item) => item.id === product.id ? { ...item, availableStock: Math.max(0, item.availableStock + stockDelta) } : item)
  return { products: nextProducts, warehouseStocks: nextStocks, movements, document: { ...document, status: '已完成' as const, completedAt: now } }
}
