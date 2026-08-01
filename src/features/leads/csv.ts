import type { Customer } from '../../types'

export const CSV_HEADERS = ['姓名', '电话', '来源', '负责人', '意向', '预计金额', '产品', '风格', '预算', '装修进度', '关注点', '下次跟进'] as const
export const OPTIONAL_CSV_HEADERS = ['客户编号', '微信名', '城市', '到店日期', '客户状态', '备注', '车辆品牌'] as const
const REQUIRED_CSV_HEADERS = CSV_HEADERS.filter((header) => header !== '电话')

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

  const rows = parsed.slice(1).filter((row) => row.some((value) => value.trim())).map((row, index) => {
    const values = Object.fromEntries([...CSV_HEADERS, ...OPTIONAL_CSV_HEADERS].map((header) => [header, headers.includes(header) ? row[headers.indexOf(header)]?.trim() ?? '' : ''])) as CsvRecord
    const errors: string[] = []
    if (!values.姓名) errors.push('姓名必填')
    if (values.电话 && !/^[+\d][\d\s-]{5,19}$/.test(values.电话)) errors.push('电话格式不正确')
    if (!values.负责人) errors.push('负责人必填')
    if (values.意向 && !['高', '中', '低'].includes(values.意向)) errors.push('意向须为高、中或低')
    const amount = parseAmount(values.预计金额)
    if (values.预计金额 !== '' && (!Number.isFinite(amount) || amount < 0)) errors.push('预计金额须为非负数字')
    if (values.下次跟进 && Number.isNaN(Date.parse(values.下次跟进))) errors.push('下次跟进日期无效')
    return { line: index + 2, values, errors }
  })
  return { rows, fileErrors: rows.length ? [] : ['文件中没有客户数据'] }
}

export function csvRowToCustomer(row: CsvPreviewRow, now = new Date()): Customer {
  const values = row.values
  const importedDate = values.到店日期?.replace(/\//g, '-')
  const importedAt = importedDate && !Number.isNaN(Date.parse(importedDate)) ? new Date(`${importedDate}T12:00:00`) : now
  const statusStage: Partial<Record<string, Customer['stage']>> = { 已成交: '已成交', 已流失: '已流失', 持续跟进: '需求确认', 首次到店: '到店' }
  const supplemental = [values.客户编号 && `客户编号：${values.客户编号}`, values.微信名 && `微信名：${values.微信名}`, values.备注].filter(Boolean).join('；')
  return {
    id: `lead-${now.getTime()}-${row.line}-${Math.random().toString(36).slice(2, 7)}`,
    name: values.姓名,
    phone: values.电话,
    source: values.来源,
    salesperson: values.负责人,
    stage: statusStage[values.客户状态 ?? ''] ?? '新线索',
    intent: (values.意向 || '中') as Customer['intent'],
    expectedAmount: parseAmount(values.预计金额) || 0,
    products: splitList(values.产品),
    style: values.风格,
    budget: values.预算,
    renovationProgress: values.装修进度,
    concerns: splitList(values.关注点),
    cityArea: values.城市,
    vehicleBrand: values.车辆品牌,
    notes: supplemental || undefined,
    lastContactAt: importedAt.toISOString(),
    nextFollowUpAt: values.下次跟进 ? new Date(values.下次跟进).toISOString() : undefined,
    createdAt: importedAt.toISOString().slice(0, 10),
  }
}

function splitList(value: string): string[] { return value.split(/[|,，、；;]/).map((item) => item.trim()).filter(Boolean) }
function parseAmount(value: string): number { return Number(value.replace(/[¥￥,，\s]/g, '')) }

export function customerCsv(customers: Customer[]): string {
  return serializeCsv([
    [...CSV_HEADERS],
    ...customers.map((item) => [item.name, item.phone, item.source, item.salesperson, item.intent, item.expectedAmount, item.products.join('|'), item.style, item.budget, item.renovationProgress, item.concerns.join('|'), item.nextFollowUpAt ?? '']),
  ])
}

export function templateCsv(): string {
  return serializeCsv([[...CSV_HEADERS], ['张女士', '13800138000', '小红书', '林晓', '高', '80000', '沙发|餐边柜', '现代原木', '8-10万', '硬装收尾', '价格|交期', '2026-08-01 10:00']])
}
