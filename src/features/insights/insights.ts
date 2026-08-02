import type { Customer, FollowUp } from '../../types'
import { productCatalog } from '../../productCatalog'

export type InsightPeriod = 7 | 30 | 90

export interface TrendPoint { label: string; leads: number; followUps: number; amount: number }
export interface SourceQuality { source: string; leads: number; highIntent: number; amount: number; highIntentRate: number }
export interface StageRisk { stage: string; customers: number; riskCustomers: number; averageIdleDays: number; amountAtRisk: number }
export interface ActivityQuality { total: number; activeCustomers: number; coverageRate: number; nextActionRate: number; resultRate: number; averagePerActiveCustomer: number }
export interface LostReason { reason: string; count: number; amount: number; share: number }
export interface ProductInsight { product: string; interestedCustomers: number; highIntent: number; highIntentRate: number; amount: number; deals: number; score: number; activityAdvice: string; supplyAdvice: string; supplyType?: string; availableStock?: number }
export interface SalesInsight {
  period: InsightPeriod
  trend: TrendPoint[]
  sources: SourceQuality[]
  stageRisks: StageRisk[]
  activity: ActivityQuality
  lostReasons: LostReason[]
  products: ProductInsight[]
  suggestions: string[]
}

const DAY = 86_400_000
const CLOSED = new Set(['已成交', '已流失'])

const validTime = (value: string) => {
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

const daysBetween = (later: number, earlier: number) => Math.max(0, Math.floor((later - earlier) / DAY))

const PRODUCT_ALIASES: Record<string, string> = { '沙发':'实木沙发', '餐台':'实木餐桌', '餐桌':'实木餐桌', '茶几':'实木茶几', '床垫':'进口床垫' }
const catalogProduct = (name: string) => productCatalog.find((item) => item.name === name || item.name === PRODUCT_ALIASES[name])

export function buildSalesInsights(
  customers: Customer[],
  followUps: FollowUp[],
  period: InsightPeriod,
  now = new Date(),
): SalesInsight {
  const nowTime = now.getTime()
  const startTime = nowTime - period * DAY
  const inPeriod = (value: string) => {
    const time = validTime(value)
    return time >= startTime && time <= nowTime
  }
  const periodCustomers = customers.filter((customer) => inPeriod(customer.createdAt))
  const periodFollowUps = followUps.filter((item) => inPeriod(item.at))
  const bucketDays = period === 7 ? 1 : period === 30 ? 5 : 15
  const bucketCount = Math.ceil(period / bucketDays)
  const trend = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = startTime + index * bucketDays * DAY
    const bucketEnd = Math.min(bucketStart + bucketDays * DAY, nowTime + 1)
    const leads = periodCustomers.filter((item) => {
      const time = validTime(item.createdAt)
      return time >= bucketStart && time < bucketEnd
    })
    return {
      label: new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(bucketStart)),
      leads: leads.length,
      followUps: periodFollowUps.filter((item) => {
        const time = validTime(item.at)
        return time >= bucketStart && time < bucketEnd
      }).length,
      amount: leads.reduce((sum, item) => sum + item.expectedAmount, 0),
    }
  })

  const sourceNames = [...new Set(periodCustomers.map((customer) => customer.source))]
  const sources = sourceNames.map((source) => {
    const leads = periodCustomers.filter((customer) => customer.source === source)
    const highIntent = leads.filter((customer) => customer.intent === '高').length
    return {
      source,
      leads: leads.length,
      highIntent,
      amount: leads.reduce((sum, customer) => sum + customer.expectedAmount, 0),
      highIntentRate: leads.length ? Math.round((highIntent / leads.length) * 100) : 0,
    }
  }).sort((a, b) => b.amount - a.amount || b.leads - a.leads)

  const activeCustomers = customers.filter((customer) => !CLOSED.has(customer.stage))
  const stageRisks = [...new Set(activeCustomers.map((customer) => customer.stage))].map((stage) => {
    const stageCustomers = activeCustomers.filter((customer) => customer.stage === stage)
    const idleDays = stageCustomers.map((customer) => daysBetween(nowTime, validTime(customer.lastContactAt)))
    const risks = stageCustomers.filter((customer, index) => idleDays[index] >= 7)
    return {
      stage,
      customers: stageCustomers.length,
      riskCustomers: risks.length,
      averageIdleDays: stageCustomers.length ? Math.round(idleDays.reduce((sum, days) => sum + days, 0) / stageCustomers.length) : 0,
      amountAtRisk: risks.reduce((sum, customer) => sum + customer.expectedAmount, 0),
    }
  }).sort((a, b) => b.amountAtRisk - a.amountAtRisk || b.averageIdleDays - a.averageIdleDays)

  const followedCustomerIds = new Set(periodFollowUps.map((item) => item.customerId))
  const activity: ActivityQuality = {
    total: periodFollowUps.length,
    activeCustomers: activeCustomers.length,
    coverageRate: activeCustomers.length ? Math.round((activeCustomers.filter((item) => followedCustomerIds.has(item.id)).length / activeCustomers.length) * 100) : 0,
    nextActionRate: periodFollowUps.length ? Math.round((periodFollowUps.filter((item) => item.nextAction && item.nextAt).length / periodFollowUps.length) * 100) : 0,
    resultRate: periodFollowUps.length ? Math.round((periodFollowUps.filter((item) => item.result.trim()).length / periodFollowUps.length) * 100) : 0,
    averagePerActiveCustomer: activeCustomers.length ? Math.round((periodFollowUps.length / activeCustomers.length) * 10) / 10 : 0,
  }

  const lostCustomers = customers.filter((customer) => customer.stage === '已流失')
  const reasons = [...new Set(lostCustomers.map((customer) => customer.lostReason?.trim() || '未记录原因'))]
  const lostReasons = reasons.map((reason) => {
    const items = lostCustomers.filter((customer) => (customer.lostReason?.trim() || '未记录原因') === reason)
    return {
      reason,
      count: items.length,
      amount: items.reduce((sum, item) => sum + item.expectedAmount, 0),
      share: lostCustomers.length ? Math.round((items.length / lostCustomers.length) * 100) : 0,
    }
  }).sort((a, b) => b.count - a.count || b.amount - a.amount)

  const productNames = [...new Set(periodCustomers.flatMap((customer) => customer.products).filter(Boolean))]
  const products = productNames.map((product) => {
    const interested = periodCustomers.filter((customer) => customer.products.includes(product))
    const highIntent = interested.filter((customer) => customer.intent === '高').length
    const deals = interested.filter((customer) => (customer.dealAmount ?? 0) > 0 || customer.stage === '已成交').length
    const catalog = catalogProduct(product)
    const desiredStock = Math.ceil(interested.length * .3 + highIntent * .5)
    const stockGap = catalog && ['现货', '展厅样品'].includes(catalog.supplyType) ? Math.max(0, desiredStock - catalog.availableStock) : 0
    return {
      product,
      interestedCustomers: interested.length,
      highIntent,
      highIntentRate: interested.length ? Math.round(highIntent / interested.length * 100) : 0,
      amount: interested.reduce((sum, customer) => sum + customer.expectedAmount, 0),
      deals,
      score: interested.length * 2 + highIntent * 4 + deals * 6,
      activityAdvice: highIntent >= 3 || (interested.length >= 3 && highIntent / interested.length >= .4) ? '优先策划活动' : interested.length >= 2 ? '适合组合促销' : '持续观察',
      supplyAdvice: !catalog ? '核对产品与供应方式' : catalog.supplyType === '定制生产' ? '按意向提前排产' : catalog.supplyType === '外采产品' ? '提前锁定采购量' : stockGap > 0 ? `建议补货 ${stockGap} 件` : '现有库存可覆盖',
      supplyType: catalog?.supplyType,
      availableStock: catalog?.availableStock,
    }
  }).sort((a, b) => b.score - a.score || b.amount - a.amount).slice(0, 10)

  const suggestions: string[] = []
  const topRisk = stageRisks.find((item) => item.riskCustomers > 0)
  const topSource = sources[0]
  if (topRisk) suggestions.push(`${topRisk.stage}阶段有 ${topRisk.riskCustomers} 个商机超过 7 天未联系，优先复盘 ¥${formatCompactMoney(topRisk.amountAtRisk)} 风险金额。`)
  if (activity.coverageRate < 80 && activeCustomers.length) suggestions.push(`本周期仅覆盖 ${activity.coverageRate}% 在跟客户，先补齐未触达名单再增加跟进频次。`)
  if (activity.nextActionRate < 80 && periodFollowUps.length) suggestions.push(`仅 ${activity.nextActionRate}% 的跟进同时记录下一步与时间，辅导销售用明确动作结束每次沟通。`)
  if (topSource) suggestions.push(`${topSource.source}贡献本周期最高商机金额，建议复盘其高意向率 ${topSource.highIntentRate}% 并优化同类获客。`)
  if (products[0]) suggestions.push(`${products[0].product}是本周期综合热度第一，${products[0].activityAdvice}；备货侧建议：${products[0].supplyAdvice}。`)
  if (!suggestions.length && customers.length) suggestions.push('当前跟进覆盖和动作完整度良好，建议继续复盘高意向客户的阶段推进效率。')

  return { period, trend, sources, stageRisks, activity, lostReasons, products, suggestions }
}

export function formatCompactMoney(amount: number) {
  if (amount >= 10_000) return `${Number((amount / 10_000).toFixed(1))}万`
  return amount.toLocaleString('zh-CN')
}
