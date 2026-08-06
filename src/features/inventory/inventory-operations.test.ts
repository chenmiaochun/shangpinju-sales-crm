import { describe, expect, it } from 'vitest'
import type { InventoryDocument, ProductCatalogItem } from '../../types'
import { applyInventoryDocument, initializeWarehouseStocks } from './inventory-operations'

const product: ProductCatalogItem = { id:'p1', sku:'P-1', name:'餐桌', specifications:['标准'], unitPrice:100, supplyType:'现货', availableStock:10, reservedStock:0 }
const doc = (changes: Partial<InventoryDocument>): InventoryDocument => ({ id:'d1', documentNo:'RK001', type:'到货入库', status:'待执行', productId:'p1', sku:'P-1', productName:'餐桌', quantity:2, toWarehouseId:'warehouse-main', operator:'仓管', createdAt:'2026-08-06', ...changes })

describe('inventory operations', () => {
  it('receives goods into total and warehouse stock', () => {
    const result = applyInventoryDocument([product], initializeWarehouseStocks([product], []), doc({}))
    expect(result.products[0].availableStock).toBe(12)
    expect(result.warehouseStocks[0].quantity).toBe(12)
    expect(result.movements[0]).toMatchObject({ type:'采购入库', quantity:2 })
  })

  it('transfers between warehouses without changing total stock', () => {
    const result = applyInventoryDocument([product], initializeWarehouseStocks([product], []), doc({ type:'仓库调拨', fromWarehouseId:'warehouse-main', toWarehouseId:'warehouse-showroom' }))
    expect(result.products[0].availableStock).toBe(10)
    expect(result.warehouseStocks.find((item) => item.warehouseId === 'warehouse-main')?.quantity).toBe(8)
    expect(result.warehouseStocks.find((item) => item.warehouseId === 'warehouse-showroom')?.quantity).toBe(2)
  })

  it('rejects an outbound document when warehouse stock is insufficient', () => {
    expect(() => applyInventoryDocument([product], [], doc({ type:'销售出库', quantity:11, fromWarehouseId:'warehouse-main', toWarehouseId:undefined }))).toThrow('库存不足')
  })
})
