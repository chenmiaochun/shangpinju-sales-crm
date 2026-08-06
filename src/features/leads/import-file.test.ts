import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { previewCustomerCsv } from './csv'
import { customerImportFileToCsv, customerTemplateXlsx } from './import-file'

describe('customer import files', () => {
  it('reads the first worksheet from an Excel file', async () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['姓名', '来源', '负责人', '意向', '预计金额', '产品', '风格', '预算', '装修进度', '关注点', '下次跟进'],
      ['无电话客户', '抖音', '陈婉珊', '中', '', '沙发', '', '', '硬装中', '', ''],
    ]), '导入数据')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const file = new File([bytes], '客户.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const result = previewCustomerCsv(await customerImportFileToCsv(file))
    expect(result.fileErrors).toEqual([])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].errors).toEqual([])
  })

  it('creates an Excel template with the current intake columns and text phone values', async () => {
    const bytes = customerTemplateXlsx()
    const workbook = XLSX.read(bytes, { type: 'array' })
    const sheet = workbook.Sheets['客户导入模板']
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false })
    expect(rows[0]).toEqual(expect.arrayContaining(['所在城市', '车牌号码', '小区名称', '意向产品', '初步报价金额', '优惠详情']))
    expect(rows[1][1]).toBe('13800138000')
    expect(previewCustomerCsv(XLSX.utils.sheet_to_csv(sheet)).rows[0].errors).toEqual([])
  })
})
