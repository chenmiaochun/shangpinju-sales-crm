import type { Customer } from '../../types'

export const CSV_HEADERS = [
  '线索编号', '活动批次', '内容编号', '广告组/素材组', '转化来源', '预约到店时间', '预约/到店状态', '需求产品线',
  '姓名', '电话', '所在城市', '负责人',
  '车牌号码', '车辆品牌', '车辆系列',
  '小区名称', '楼栋/房号', '户型', '建筑面积', '房产参考价值',
  '预算范围', '意向产品', '客户来源', '客户状态', '装修进度', '下次跟进',
  '初步报价金额', '报价说明', '优惠类型', '优惠详情', '备注',
] as const

// Continue accepting spreadsheets exported by older versions of the system.
export const OPTIONAL_CSV_HEADERS = [
  '客户编号', '微信名', '城市', '到店日期', '来源', '意向', '预计金额',
  '产品', '风格', '预算', '关注点',
] as const
const REQUIRED_CSV_HEADERS = ['姓名', '负责人'] as const

export type CsvRecord = Record<(typeof CSV_HEADERS)[number], string> & Partial<Record<(typeof OPTIONAL_CSV_HEADERS)[number], string>>
export interface CsvPreviewRow { line: number; values: CsvRecord; errors: string[] }

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = '' }
    else if (char !== '\r') field += char
  }
  row.push(field)
  if (row.some((value) => value !== '') || rows.length === 0) rows.push(row)
  return rows
}

function escapeField(value: unknown): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function serializeCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => row.map(escapeField).join(',')).join('\r\n')}`
}

export function previewCustomerCsv(text: string): { rows: CsvPreviewRow[]; fileErrors: string[] } {
  const parsed = parseCsv(text)
  const headers = parsed[0]?.map((value) => value.trim()) ?? []
  const missing = REQUIRED_CSV_HEADERS.filter((header) => !headers.includes(header))
  if (missing.length) return { rows: [], fileErrors: [`缺少字段：${missing.join('、')}`] }

  const allHeaders = [...CSV_HEADERS, ...OPTIONAL_CSV_HEADERS]
  const rows = parsed.slice(1).filter((row) => row.some((value) => value.trim())).map((row, index) => {
    const values = Object.fromEntries(allHeaders.map((header) => [header, headers.includes(header) ? row[headers.indexOf(header)]?.trim() ?? '' : ''])) as CsvRecord
    const errors: string[] = []
    if (!values.姓名) errors.push('姓名必填')
    if (values.电话 && !/^[+\d][\d\s-]{5,19}$/.test(values.电话)) errors.push(`电话“${values.电话}”格式不正确，请填写 6-20 位数字，可包含 +、空格或短横线`)
    if (!values.负责人) errors.push('负责人必填')
    if (values.意向 && !['高', '中', '低'].includes(values.意向)) errors.push(`意向“${values.意向}”无效，请改为高、中或低`)
    const amountText = preferred(values.初步报价金额, values.预计金额)
    const amount = parseAmount(amountText)
    if (amountText !== '' && (!Number.isFinite(amount) || amount < 0)) errors.push(`初步报价金额“${amountText}”无效，请填写大于或等于 0 的数字`)
    if (values.建筑面积 && (!Number.isFinite(Number(values.建筑面积)) || Number(values.建筑面积) <= 0)) errors.push(`建筑面积“${values.建筑面积}”无效，请填写大于 0 的数字`)
    if (values.下次跟进 && Number.isNaN(Date.parse(values.下次跟进))) errors.push(`下次跟进“${values.下次跟进}”日期无效，请按 2026-08-10 格式填写`)
    return { line: index + 2, values, errors }
  })
  return { rows, fileErrors: rows.length ? [] : ['文件中没有客户数据'] }
}

export function csvRowToCustomer(row: CsvPreviewRow, now = new Date()): Customer {
  const values = row.values
  const importedDate = values.到店日期?.replace(/\//g, '-')
  const importedAt = importedDate && !Number.isNaN(Date.parse(importedDate)) ? new Date(`${importedDate}T12:00:00`) : now
  const statusStage: Partial<Record<string, Customer['stage']>> = { 已成交: '已成交', 已流失: '已流失', 持续跟进: '需求确认', 首次到店: '到店' }
  const customerStatus = values.客户状态 || ''
  const quote = parseAmount(preferred(values.初步报价金额, values.预计金额)) || 0
  const supplemental = [values.客户编号 && `客户编号：${values.客户编号}`, values.微信名 && `微信名：${values.微信名}`, values.备注].filter(Boolean).join('；')
  return {
    id: `lead-${now.getTime()}-${row.line}-${Math.random().toString(36).slice(2, 7)}`,
    leadId: values.线索编号 || undefined,
    campaignId: values.活动批次 || undefined,
    contentId: values.内容编号 || undefined,
    adGroup: values['广告组/素材组'] || undefined,
    conversionSource: values.转化来源 || undefined,
    appointmentAt: values.预约到店时间 ? new Date(values.预约到店时间).toISOString() : undefined,
    arrivalStatus: (values['预约/到店状态'] || '未预约') as Customer['arrivalStatus'],
    productLines: splitList(values.需求产品线) as Customer['productLines'],
    name: values.姓名,
    phone: values.电话,
    source: preferred(values.客户来源, values.来源),
    salesperson: values.负责人,
    stage: statusStage[customerStatus] ?? '新线索',
    intent: (values.意向 || (customerStatus === '已成交' ? '高' : '中')) as Customer['intent'],
    expectedAmount: quote,
    products: splitList(preferred(values.意向产品, values.产品)),
    style: values.风格 || '',
    budget: preferred(values.预算范围, values.预算),
    renovationProgress: values.装修进度,
    concerns: splitList(values.关注点 || ''),
    cityArea: preferred(values.所在城市, values.城市),
    communityName: values.小区名称 || undefined,
    buildingRoom: values['楼栋/房号'] || undefined,
    houseLayout: values.户型 || undefined,
    houseArea: Number(values.建筑面积) || undefined,
    houseValueRange: values.房产参考价值 || undefined,
    vehicleBrand: values.车辆品牌 || undefined,
    vehicleSeries: values.车辆系列 || undefined,
    licensePlate: values.车牌号码?.toUpperCase() || undefined,
    notes: supplemental || undefined,
    initialQuote: quote || undefined,
    quoteDescription: values.报价说明 || undefined,
    discountType: values.优惠类型 || undefined,
    discountDetails: values.优惠详情 || undefined,
    lastContactAt: importedAt.toISOString(),
    nextFollowUpAt: values.下次跟进 ? new Date(values.下次跟进).toISOString() : undefined,
    createdAt: importedAt.toISOString().slice(0, 10),
    updatedAt: importedAt.toISOString(),
  }
}

function preferred(primary: string | undefined, legacy: string | undefined): string { return primary || legacy || '' }
function splitList(value: string): string[] { return value.split(/[|,，、；;]/).map((item) => item.trim()).filter(Boolean) }
function parseAmount(value: string): number { return Number(value.replace(/[¥￥,，\s]/g, '')) }

export function customerCsv(customers: Customer[]): string {
  return serializeCsv([
    [...CSV_HEADERS],
    ...customers.map((item) => [
      item.leadId, item.campaignId, item.contentId, item.adGroup, item.conversionSource, item.appointmentAt, item.arrivalStatus, item.productLines?.join('|'),
      item.name, item.phone, item.cityArea, item.salesperson,
      item.licensePlate, item.vehicleBrand, item.vehicleSeries,
      item.communityName, item.buildingRoom, item.houseLayout, item.houseArea, item.houseValueRange,
      item.budget, item.products.join('|'), item.source,
      stageToStatus(item.stage), item.renovationProgress, item.nextFollowUpAt ?? '',
      item.initialQuote ?? item.expectedAmount, item.quoteDescription, item.discountType, item.discountDetails, item.notes,
    ]),
  ])
}

export function templateRows(): unknown[][] {
  return [
    [...CSV_HEADERS],
    ['L-20260828-001', 'SPJ-2026-09', 'CT-20260828-01', '抖音测试A组', '抖音', '2026-08-28T15:30', '已预约', '原创家具|雅兰睡眠', '张女士', '13800138000', '揭阳', '陈婉珊', '粤V12345', '宝马', 'X5', '保利锦城', '8栋 1202', '三房两厅', 108, '约 124-146 万元', '8-15 万', '沙发|餐边柜', '小红书', '首次到店', '硬装收尾', '2026-08-10', 80000, '客厅家具组合', '节日活动', '整单 95 折', '周末方便联系'],
  ]
}

export function templateCsv(): string { return serializeCsv(templateRows()) }

function stageToStatus(stage: Customer['stage']): string {
  if (stage === '已成交') return '已成交'
  if (stage === '已流失') return '已流失'
  if (stage === '到店') return '首次到店'
  return '持续跟进'
}
