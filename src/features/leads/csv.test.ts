import { describe, expect, it } from 'vitest'
import type { Customer } from '../../types'
import { CSV_HEADERS, OPTIONAL_CSV_HEADERS, csvRowToCustomer, customerCsv, parseCsv, previewCustomerCsv, serializeCsv } from './csv'

describe('CSV utilities', () => {
  it('parses BOM, quoted commas, escaped quotes and line breaks', () => {
    const rows = parseCsv('\uFEFF姓名,关注点\r\n张女士,"价格,交期"\r\n王先生,"他说""可以""\n再联系"')
    expect(rows).toEqual([['姓名', '关注点'], ['张女士', '价格,交期'], ['王先生', '他说"可以"\n再联系']])
  })

  it('serializes Chinese data with BOM and RFC-style quoting', () => {
    const text = serializeCsv([['姓名', '备注'], ['张女士', '价格,"较高"\n待确认']])
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text).toContain('张女士,"价格,""较高""\n待确认"')
    expect(parseCsv(text)[1]).toEqual(['张女士', '价格,"较高"\n待确认'])
  })

  it('validates missing headers and reports source line errors', () => {
    expect(previewCustomerCsv('姓名,电话\n张三,13800138000').fileErrors[0]).toContain('缺少字段')
    const csv = serializeCsv([[...CSV_HEADERS], ['', 'abc', '', '', '很高', '-1', '', '', '', '', '', 'not-a-date']])
    const result = previewCustomerCsv(csv)
    expect(result.rows[0].line).toBe(2)
    expect(result.rows[0].errors).toEqual(expect.arrayContaining(['姓名必填', '电话格式不正确', '负责人必填', '意向须为高、中或低', '预计金额须为非负数字', '下次跟进日期无效']))
  })

  it('round-trips exported customer fields', () => {
    const customer: Customer = { id: 'c1', name: '张,女士', phone: '13800138000', source: '老客转介绍', salesperson: '林晓', stage: '新线索', intent: '高', expectedAmount: 88000, products: ['沙发', '餐边柜'], style: '原木', budget: '8万', renovationProgress: '硬装', concerns: ['价格', '交期'], lastContactAt: '2026-07-30', nextFollowUpAt: '2026-08-01T02:00:00.000Z', createdAt: '2026-07-30' }
    const result = previewCustomerCsv(customerCsv([customer]))
    expect(result.fileErrors).toEqual([])
    expect(result.rows[0].errors).toEqual([])
    expect(result.rows[0].values).toMatchObject({ 姓名: '张,女士', 产品: '沙发|餐边柜', 关注点: '价格|交期' })
  })

  it('imports Feishu customers without inventing a phone number', () => {
    const csv = serializeCsv([[...CSV_HEADERS, ...OPTIONAL_CSV_HEADERS], ['蔡晓崇', '', '抖音', '陈婉珊', '高', '50000', '沙发,茶台', '', '2-5万', '硬装中', '', '', '37407', '蔡小W', '汕头', '2026/07/02', '首次到店', '已交诚意金', '问界']])
    const preview = previewCustomerCsv(csv)
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({ phone: '', stage: '到店/量房', cityArea: '汕头', vehicleBrand: '问界', products: ['沙发', '茶台'], notes: '客户编号：37407；微信名：蔡小W；已交诚意金', createdAt: '2026-07-02' })
  })

  it('accepts a missing phone header and an empty expected amount', () => {
    const headers = CSV_HEADERS.filter((header) => header !== '电话')
    const csv = serializeCsv([headers, ['无电话客户', '抖音', '陈婉珊', '中', '', '沙发', '', '', '硬装中', '', '']])
    const preview = previewCustomerCsv(csv)
    expect(preview.fileErrors).toEqual([])
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({ name: '无电话客户', phone: '', expectedAmount: 0 })
  })

  it('accepts Excel-formatted amounts and defaults a blank intent to medium', () => {
    const csv = serializeCsv([[...CSV_HEADERS], ['林女士', '', '门店', '陈婉珊', '', '35,000', '沙发', '', '', '', '', '']])
    const preview = previewCustomerCsv(csv)
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({ intent: '中', expectedAmount: 35000 })
  })
})
