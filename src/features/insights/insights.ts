import type {
  ConfigProduct,
  Customer,
  FollowUp,
  OrderItem,
  ProductCatalogItem,
  ProductCategory,
  ProductPackage,
  SalesOrder,
  SkuUnit,
} from '../../types'
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

// ---------------------------------------------------------------------------
// 4.6 经营分析：商品销售分析 / 品类分析 / 毛利分析（cost.view 门控）
// 基于真实订单，按单品(configProductId)/套餐(packageId)/老商品(productId) 三路归一。
// 成本仅在 canViewCost 为真时按 skuUnitId → SkuUnit.costPrice 实时核算，快照不落地。
// ---------------------------------------------------------------------------

export type ProductSalesKind = 'single' | 'package' | 'legacy'

export interface ProductSalesRow {
  key: string
  name: string
  kind: ProductSalesKind
  categoryName: string
  quantity: number
  amount: number
  cost: number
  margin: number
  marginRate: number // -1 表示无成本数据
  hasCostData: boolean
}

export interface CategorySalesRow {
  category: string
  amount: number
  share: number // 0~1
}

export interface ProductAnalytics {
  period: InsightPeriod
  productSales: ProductSalesRow[]
  categorySales: CategorySalesRow[]
  totalAmount: number
  totalCost: number
  totalMargin: number
  marginRate: number // -1 表示无可用成本数据
  costAvailable: boolean
}

export function buildProductAnalytics(
  orders: SalesOrder[],
  configProducts: ConfigProduct[],
  productPackages: ProductPackage[],
  skuUnits: SkuUnit[],
  categories: ProductCategory[],
  legacyProducts: ProductCatalogItem[],
  canViewCost: boolean,
  period: InsightPeriod = 30,
  now = new Date(),
): ProductAnalytics {
  const nowTime = now.getTime()
  const startTime = nowTime - period * DAY
  const inPeriod = (value: string) => {
    const time = validTime(value)
    return time >= startTime && time <= nowTime
  }
  const configById = new Map(configProducts.map((item) => [item.id, item]))
  const pkgById = new Map(productPackages.map((item) => [item.id, item]))
  const legacyById = new Map(legacyProducts.map((item) => [item.id, item]))
  const skuById = new Map(skuUnits.map((item) => [item.id, item]))
  const categoryNameById = new Map(categories.map((item) => [item.id, item.name]))

  const resolveItem = (
    item: OrderItem,
  ): { key: string; name: string; kind: ProductSalesKind; categoryName: string } | null => {
    if (item.packageId && pkgById.has(item.packageId)) {
      const pkg = pkgById.get(item.packageId)!
      const firstProduct = pkg.items[0] ? configById.get(pkg.items[0].productId) : undefined
      return {
        key: item.packageId,
        name: pkg.name,
        kind: 'package',
        categoryName: (firstProduct && categoryNameById.get(firstProduct.categoryId)) || '未分类',
      }
    }
    if (item.configProductId && configById.has(item.configProductId)) {
      const cp = configById.get(item.configProductId)!
      return {
        key: item.configProductId,
        name: cp.name,
        kind: 'single',
        categoryName: categoryNameById.get(cp.categoryId) || '未分类',
      }
    }
    if (item.productId && legacyById.has(item.productId)) {
      const lp = legacyById.get(item.productId)!
      return { key: item.productId, name: lp.name, kind: 'legacy', categoryName: lp.category || '未分类' }
    }
    if (item.productName) return { key: item.productName, name: item.productName, kind: 'legacy', categoryName: '未分类' }
    return null
  }

  const computeCost = (item: OrderItem, quantity: number): { cost: number; hasCost: boolean } => {
    if (!canViewCost) return { cost: 0, hasCost: false }
    if (item.skuLines && item.skuLines.length) {
      let cost = 0
      let hasCost = true
      for (const line of item.skuLines) {
        const unit = skuById.get(line.skuUnitId)
        if (!unit || unit.costPrice == null || Number.isNaN(unit.costPrice)) {
          hasCost = false
          continue
        }
        cost += unit.costPrice * line.quantity * quantity
      }
      return { cost, hasCost }
    }
    if (item.productId) {
      const lp = legacyById.get(item.productId)
      if (lp && lp.costPrice != null && !Number.isNaN(lp.costPrice)) {
        return { cost: lp.costPrice * quantity, hasCost: true }
      }
    }
    return { cost: 0, hasCost: false }
  }

  const map = new Map<
    string,
    { name: string; kind: ProductSalesKind; categoryName: string; quantity: number; amount: number; cost: number; hasCostData: boolean }
  >()
  for (const order of orders) {
    if (!inPeriod(order.createdAt)) continue
    for (const item of order.items ?? []) {
      const resolved = resolveItem(item)
      if (!resolved) continue
      const lineQuantity = item.quantity || 0
      const lineAmount = (item.unitPrice || 0) * lineQuantity
      const { cost, hasCost } = computeCost(item, lineQuantity)
      const entry =
        map.get(resolved.key) ??
        { name: resolved.name, kind: resolved.kind, categoryName: resolved.categoryName, quantity: 0, amount: 0, cost: 0, hasCostData: true }
      entry.quantity += lineQuantity
      entry.amount += lineAmount
      entry.cost += hasCost ? cost : 0
      entry.hasCostData = entry.hasCostData && hasCost
      map.set(resolved.key, entry)
    }
  }

  const productSales: ProductSalesRow[] = [...map.entries()].map(([key, entry]) => ({
    key,
    name: entry.name,
    kind: entry.kind,
    categoryName: entry.categoryName,
    quantity: entry.quantity,
    amount: entry.amount,
    cost: entry.hasCostData ? entry.cost : 0,
    margin: entry.hasCostData ? entry.amount - entry.cost : 0,
    marginRate: entry.hasCostData && entry.amount > 0 ? (entry.amount - entry.cost) / entry.amount : -1,
    hasCostData: entry.hasCostData,
  })).sort((a, b) => b.amount - a.amount)

  const catMap = new Map<string, number>()
  for (const row of productSales) catMap.set(row.categoryName, (catMap.get(row.categoryName) ?? 0) + row.amount)
  const totalAmount = productSales.reduce((sum, row) => sum + row.amount, 0)
  const categorySales: CategorySalesRow[] = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount, share: totalAmount > 0 ? amount / totalAmount : 0 }))
    .sort((a, b) => b.amount - a.amount)

  const someCostData = productSales.some((row) => row.hasCostData)
  const totalCost = productSales.reduce((sum, row) => sum + (row.hasCostData ? row.cost : 0), 0)
  const totalMargin = totalAmount - totalCost
  const marginRate = someCostData && totalAmount > 0 ? totalMargin / totalAmount : -1

  return {
    period,
    productSales,
    categorySales,
    totalAmount,
    totalCost,
    totalMargin,
    marginRate,
    costAvailable: someCostData && canViewCost,
  }
}
