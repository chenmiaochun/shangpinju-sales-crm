import * as XLSX from 'xlsx'
import type { ProductCatalogItem, SupplyType } from '../../types'
import { furnitureTaxonomy, isValidCategoryPath, normalizeCategoryPath } from './taxonomy'

export const PRODUCT_IMPORT_HEADERS = ['商品名称', 'SKU', '一级分类', '二级分类', '三级分类', '规格', '供货方式', '供应商/工厂', '销售价', '成本价', '初始库存', '安全库存'] as const
type ProductRow = Record<(typeof PRODUCT_IMPORT_HEADERS)[number], unknown>
export type ProductImportError = { row: number; messages: string[] }

const supplyTypes = new Set<SupplyType>(['现货', '展厅样品', '外采产品', '定制生产'])
const text = (value: unknown) => String(value ?? '').trim()
const number = (value: unknown) => Number(value ?? 0)

export function productTemplateXlsx() {
  const rows = [[...PRODUCT_IMPORT_HEADERS], ['实木餐桌', 'CZ-001', '成品家具', '桌几', '餐桌', '1.6米|1.8米', '现货', '尚品居仓库', 9800, 5600, 3, 1], ['乳胶床垫', 'CD-001', '睡眠用品', '床垫', '乳胶床垫', '1.5米|1.8米', '外采产品', '床垫供应商', 7600, 4200, 0, 1]]
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = PRODUCT_IMPORT_HEADERS.map((header) => ({ wch: Math.max(12, header.length + 4) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, '商品导入模板')
  const categoryRows = [['一级分类', '二级分类', '三级分类']]
  Object.entries(furnitureTaxonomy).forEach(([level1, level2Groups]) => Object.entries(level2Groups).forEach(([level2, level3Items]) => (level3Items as readonly string[]).forEach((level3: string) => categoryRows.push([level1, level2, level3]))))
  const categorySheet = XLSX.utils.aoa_to_sheet(categoryRows)
  categorySheet['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 20 }]
  XLSX.utils.book_append_sheet(workbook, categorySheet, '分类选项参考')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export async function readProductFile(file: File, existingSkus: string[] = []): Promise<{ products: ProductCatalogItem[]; errors: ProductImportError[] }> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(extension ?? '')) throw new Error('仅支持 Excel 或 CSV 文件')
  const workbook = extension === 'csv' ? XLSX.read(await file.text(), { type: 'string' }) : XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) throw new Error('文件中没有可读取的工作表')
  const rows = XLSX.utils.sheet_to_json<ProductRow>(sheet, { defval: '' })
  const existing = new Set(existingSkus.map((item) => item.trim().toLowerCase()))
  const products: ProductCatalogItem[] = []
  const errors: ProductImportError[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 2
    const name = text(row['商品名称']); const sku = text(row.SKU); const category = normalizeCategoryPath(text(row['一级分类']), text(row['二级分类']), text(row['三级分类'])); const { level1, level2, level3 } = category; const supplyType = text(row['供货方式']) as SupplyType
    const messages: string[] = []
    if (!name) messages.push('商品名称不能为空')
    if (!sku) messages.push('SKU不能为空')
    else if (existing.has(sku.toLowerCase())) messages.push(`SKU“${sku}”重复`)
    if (!isValidCategoryPath(level1, level2, level3)) messages.push(`分类“${level1}/${level2}/${level3}”不在系统选项中`)
    if (!supplyTypes.has(supplyType)) messages.push('供货方式必须是现货、展厅样品、外采产品或定制生产')
    for (const [label, value] of [['销售价', row['销售价']], ['成本价', row['成本价']], ['初始库存', row['初始库存']], ['安全库存', row['安全库存']]] as const) if (!Number.isFinite(number(value)) || number(value) < 0) messages.push(`${label}必须是大于等于0的数字`)
    const specifications = text(row['规格']).split(/[|｜,，]/).map((item) => item.trim()).filter(Boolean)
    if (!specifications.length) messages.push('至少填写一个规格')
    if (messages.length) { errors.push({ row: rowNumber, messages }); return }
    existing.add(sku.toLowerCase())
    products.push({ id: `product-import-${Date.now()}-${index}`, name, sku, category: level3, categoryLevel1: level1, categoryLevel2: level2, categoryLevel3: level3, specifications, supplyType, supplier: text(row['供应商/工厂']), unitPrice: number(row['销售价']), costPrice: number(row['成本价']), availableStock: supplyType === '定制生产' ? 0 : number(row['初始库存']), reservedStock: 0, safetyStock: supplyType === '定制生产' ? 0 : number(row['安全库存']) })
  })
  return { products, errors }
}
