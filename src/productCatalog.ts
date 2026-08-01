import type { ProductCatalogItem } from './types'

// Phase-one catalog. The ERP adapter can replace this source without changing the deal form.
export const productCatalog: ProductCatalogItem[] = [
  { id: 'spj-living-set-01', sku: 'KT-TZ-001', name: '客厅套系', specifications: ['白蜡木 / 原木色', '白蜡木 / 胡桃色', '黑胡桃木 / 木蜡油'], unitPrice: 46800, supplyType: '定制生产', availableStock: 0 },
  { id: 'spj-sofa-01', sku: 'SF-001', name: '实木沙发', specifications: ['三人位 / 原木色', '三人位 / 胡桃色', '转角位 / 原木色'], unitPrice: 19800, supplyType: '定制生产', availableStock: 0 },
  { id: 'spj-sideboard-01', sku: 'CBG-001', name: '餐边柜', specifications: ['1600mm / 白蜡木', '1800mm / 白蜡木', '2000mm / 黑胡桃木'], unitPrice: 12800, supplyType: '定制生产', availableStock: 0 },
  { id: 'spj-dining-table-01', sku: 'CZ-001', name: '实木餐桌', specifications: ['1.6m / 白蜡木', '1.8m / 白蜡木', '1.8m / 黑胡桃木'], unitPrice: 9800, supplyType: '现货', availableStock: 3 },
  { id: 'spj-coffee-table-01', sku: 'CJ-001', name: '实木茶几', specifications: ['1.2m / 原木色', '1.4m / 胡桃色'], unitPrice: 6800, supplyType: '展厅样品', availableStock: 1 },
  { id: 'spj-mattress-01', sku: 'CD-001', name: '进口床垫', specifications: ['1.5m', '1.8m'], unitPrice: 7600, supplyType: '外采产品', availableStock: 0 },
]
