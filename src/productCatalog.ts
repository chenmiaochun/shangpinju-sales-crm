import type { ProductCatalogItem } from './types'

// Phase-one catalog seed. 飞书产品主数据导入后，老 demo 商品已下线；
// 本文件保留空数组供 ERP 适配器复用入口，未启用时不预置任何商品。
// 增删 seed 请走「产品主数据 → Excel 导入」流程，避免与飞书产品库双轨。
export const productCatalog: ProductCatalogItem[] = []
