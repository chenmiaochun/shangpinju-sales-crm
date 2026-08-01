import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { previewCustomerCsv } from './csv'
import { customerImportFileToCsv } from './import-file'

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
})
