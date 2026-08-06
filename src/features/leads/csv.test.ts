import { describe, expect, it } from 'vitest'
import type { Customer } from '../../types'
import { CSV_HEADERS, csvRowToCustomer, customerCsv, parseCsv, previewCustomerCsv, serializeCsv, templateRows } from './csv'

function rowFor(headers: readonly string[], values: Record<string, unknown>) {
  return headers.map((header) => values[header] ?? '')
}

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
    const csv = serializeCsv([[...CSV_HEADERS], rowFor(CSV_HEADERS, { 电话: 'abc', 意向: '很高', 初步报价金额: '-1', 下次跟进: 'not-a-date' })])
    const result = previewCustomerCsv(csv)
    expect(result.rows[0].line).toBe(2)
    expect(result.rows[0].errors).toEqual(expect.arrayContaining(['姓名必填', '负责人必填']))
    expect(result.rows[0].errors.join('；')).toContain('电话“abc”格式不正确')
    expect(result.rows[0].errors.join('；')).toContain('初步报价金额“-1”无效')
    expect(result.rows[0].errors.join('；')).toContain('下次跟进“not-a-date”日期无效')
  })

  it('round-trips exported customer fields', () => {
    const customer: Customer = { id: 'c1', name: '张,女士', phone: '13800138000', source: '老客转介绍', salesperson: '林晓', stage: '新线索', intent: '高', expectedAmount: 88000, products: ['沙发', '餐边柜'], style: '原木', budget: '8万', renovationProgress: '硬装', concerns: ['价格', '交期'], lastContactAt: '2026-07-30', nextFollowUpAt: '2026-08-01T02:00:00.000Z', createdAt: '2026-07-30' }
    const result = previewCustomerCsv(customerCsv([customer]))
    expect(result.fileErrors).toEqual([])
    expect(result.rows[0].errors).toEqual([])
    expect(result.rows[0].values).toMatchObject({ 姓名: '张,女士', 意向产品: '沙发|餐边柜' })
  })

  it('imports Feishu customers without inventing a phone number', () => {
    const legacyHeaders = ['姓名', '电话', '来源', '负责人', '意向', '预计金额', '产品', '风格', '预算', '装修进度', '关注点', '下次跟进', '客户编号', '微信名', '城市', '到店日期', '客户状态', '备注', '车辆品牌']
    const csv = serializeCsv([legacyHeaders, rowFor(legacyHeaders, { 姓名: '蔡晓崇', 来源: '抖音', 负责人: '陈婉珊', 意向: '高', 预计金额: '50000', 产品: '沙发,茶台', 预算: '2-5万', 装修进度: '硬装中', 客户编号: '37407', 微信名: '蔡小W', 城市: '汕头', 到店日期: '2026/07/02', 客户状态: '首次到店', 备注: '已交诚意金', 车辆品牌: '问界' })])
    const preview = previewCustomerCsv(csv)
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({ phone: '', stage: '到店', cityArea: '汕头', vehicleBrand: '问界', products: ['沙发', '茶台'], notes: '客户编号：37407；微信名：蔡小W；已交诚意金', createdAt: '2026-07-02' })
  })

  it('accepts a missing phone header and an empty expected amount', () => {
    const headers = CSV_HEADERS.filter((header) => header !== '电话')
    const csv = serializeCsv([headers, rowFor(headers, { 姓名: '无电话客户', 客户来源: '抖音', 负责人: '陈婉珊', 意向产品: '沙发', 装修进度: '硬装中' })])
    const preview = previewCustomerCsv(csv)
    expect(preview.fileErrors).toEqual([])
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({ name: '无电话客户', phone: '', expectedAmount: 0 })
  })

  it('accepts Excel-formatted amounts and defaults a blank intent to medium', () => {
    const legacyHeaders = ['姓名', '电话', '来源', '负责人', '意向', '预计金额', '产品']
    const csv = serializeCsv([legacyHeaders, rowFor(legacyHeaders, { 姓名: '林女士', 来源: '门店', 负责人: '陈婉珊', 预计金额: '35,000', 产品: '沙发' })])
    const preview = previewCustomerCsv(csv)
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({ intent: '中', expectedAmount: 35000 })
  })

  it('identifies the invalid value and tells the user how to correct it', () => {
    const headers = ['姓名', '负责人', '意向']
    const result = previewCustomerCsv(serializeCsv([headers, ['傅记', '陈婉珊', '中高']]))
    expect(result.rows[0]).toMatchObject({ line: 2 })
    expect(result.rows[0].errors).toEqual(['意向“中高”无效，请改为高、中或低'])
  })

  it('keeps the template aligned with every field available for bulk entry', () => {
    expect(templateRows()[0]).toEqual([...CSV_HEADERS])
    expect(CSV_HEADERS).toEqual(expect.arrayContaining(['车牌号码', '车辆系列', '小区名称', '楼栋/房号', '户型', '建筑面积', '意向产品', '客户状态', '初步报价金额', '优惠详情', '备注']))
    expect(CSV_HEADERS).not.toEqual(expect.arrayContaining(['风格', '关注点']))
  })

  it('imports all current intake fields from the new template', () => {
    const csv = serializeCsv([templateRows()[0], templateRows()[1]])
    const preview = previewCustomerCsv(csv)
    expect(preview.rows[0].errors).toEqual([])
    expect(csvRowToCustomer(preview.rows[0])).toMatchObject({
      name: '张女士', phone: '13800138000', cityArea: '揭阳', licensePlate: '粤V12345',
      vehicleBrand: '宝马', vehicleSeries: 'X5', communityName: '保利锦城', buildingRoom: '8栋 1202',
      houseLayout: '三房两厅', houseArea: 108, products: ['沙发', '餐边柜'], initialQuote: 80000,
      quoteDescription: '客厅家具组合', discountType: '节日活动', discountDetails: '整单 95 折', notes: '周末方便联系',
    })
  })
})
