import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { productTemplateXlsx, readProductFile } from './product-import'

describe('product import', () => {
  it('reads valid products and reports row-level category and SKU errors', async () => {
    const sheet = XLSX.utils.json_to_sheet([
      { 商品名称:'实木餐桌', SKU:'CZ-NEW', 一级分类:'成品家具', 二级分类:'桌几', 三级分类:'餐桌', 规格:'1.6米|1.8米', 供货方式:'现货', '供应商/工厂':'仓库', 销售价:9800, 成本价:5600, 初始库存:2, 安全库存:1 },
      { 商品名称:'错误商品', SKU:'OLD', 一级分类:'客厅', 二级分类:'桌几', 三级分类:'餐桌', 规格:'1.8米', 供货方式:'未知', 销售价:1, 成本价:1, 初始库存:0, 安全库存:0 },
    ])
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, '商品')
    const bytes = XLSX.write(workbook, { bookType:'xlsx', type:'array' })
    const result = await readProductFile(new File([bytes], '商品.xlsx'), ['OLD'])
    expect(result.products).toHaveLength(1)
    expect(result.products[0]).toMatchObject({ sku:'CZ-NEW', categoryLevel1:'成品家具', categoryLevel2:'桌几', categoryLevel3:'餐桌' })
    expect(result.errors[0]).toMatchObject({ row:3 })
    expect(result.errors[0].messages.join('')).toContain('重复')
    expect(result.errors[0].messages.join('')).toContain('不在系统选项中')
  })

  it('creates a usable Excel template', () => {
    const workbook = XLSX.read(productTemplateXlsx(), { type:'array' })
    expect(workbook.SheetNames).toContain('商品导入模板')
    expect(workbook.SheetNames).toContain('分类选项参考')
  })

  it('normalizes common furniture category names used by employees', async () => {
    const rows = [
      ['沙发', 'SF-1', '成品家具', '沙发', '三人位'],
      ['床垫', 'CD-1', '成品家具', '床垫', '乳胶床垫'],
      ['餐桌', 'CT-1', '成品家具', '台', '餐台'],
      ['餐椅', 'CY-1', '成品家具', '椅', '餐椅'],
      ['电视柜', 'DSG-1', '成品家具', '柜', '电视柜'],
      ['大床', 'C-1', '成品家具', '床', '1.8米大床'],
      ['衣帽架', 'YJ-1', '成品家具', '架子', '衣架子'],
      ['书架', 'SJ-1', '成品家具', '架子', '书架'],
    ].map(([商品名称, SKU, 一级分类, 二级分类, 三级分类]) => ({ 商品名称, SKU, 一级分类, 二级分类, 三级分类, 规格:'标准', 供货方式:'现货', 销售价:1, 成本价:1, 初始库存:0, 安全库存:0 }))
    const sheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, '商品')
    const bytes = XLSX.write(workbook, { bookType:'xlsx', type:'array' })
    const result = await readProductFile(new File([bytes], '商品.xlsx'))
    expect(result.errors).toEqual([])
    expect(result.products).toHaveLength(8)
    expect(result.products[0]).toMatchObject({ categoryLevel2:'沙发', categoryLevel3:'三人沙发' })
    expect(result.products[1]).toMatchObject({ categoryLevel1:'睡眠用品', categoryLevel2:'床垫' })
    expect(result.products[6]).toMatchObject({ categoryLevel2:'架类', categoryLevel3:'衣帽架' })
  })
})
