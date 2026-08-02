import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Lightbulb,
  Target,
  TrendingUp,
  Users,
  UserPlus,
  Store,
} from 'lucide-react'
import { useState } from 'react'
import { customers as defaultCustomers, followUps as defaultFollowUps } from '../../data'
import type { Customer, CustomerStage, FollowUp } from '../../types'
import './ManagerDashboard.css'

const STAGES: CustomerStage[] = [
  '新线索', '已初聊', '需求确认', '到店', '量尺', '方案设计', '已报价',
  '方案调整', '已定金', '生产交付', '已成交', '已流失',
]
const CLOSED_STAGES: CustomerStage[] = ['已成交', '已流失']
const WON_STAGES: CustomerStage[] = ['已定金', '生产交付', '已成交']
const DAY = 86_400_000
type PeriodUnit = 'month' | 'quarter' | 'year'

export interface DashboardPeriod { start: Date; end: Date; label: string }
export interface PeriodSummary { newLeads: number; newVisits: number; deals: number; dealAmount: number }

function atLocalStart(value: string) {
  return new Date(value.length <= 10 ? `${value}T00:00:00` : value)
}

export function getDashboardPeriod(unit: PeriodUnit, anchor: Date): DashboardPeriod {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  if (unit === 'year') return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), label: `${year}年` }
  if (unit === 'quarter') {
    const quarter = Math.floor(month / 3)
    return { start: new Date(year, quarter * 3, 1), end: new Date(year, quarter * 3 + 3, 1), label: `${year}年第${quarter + 1}季度` }
  }
  return { start: new Date(year, month, 1), end: new Date(year, month + 1, 1), label: `${year}年${month + 1}月` }
}

function previousPeriod(unit: PeriodUnit, current: DashboardPeriod) {
  const anchor = new Date(current.start)
  if (unit === 'year') anchor.setFullYear(anchor.getFullYear() - 1)
  else anchor.setMonth(anchor.getMonth() - (unit === 'quarter' ? 3 : 1))
  return getDashboardPeriod(unit, anchor)
}

export function getPeriodSummary(items: Customer[], followUps: FollowUp[], period: DashboardPeriod): PeriodSummary {
  const inPeriod = (value?: string) => {
    if (!value) return false
    const time = atLocalStart(value).getTime()
    return time >= period.start.getTime() && time < period.end.getTime()
  }
  const newCustomers = items.filter((customer) => inPeriod(customer.createdAt))
  const visitIds = new Set(followUps.filter((item) => item.channel === '到店' && inPeriod(item.at)).map((item) => item.customerId))
  newCustomers.forEach((customer) => {
    if (STAGES.indexOf(customer.stage) >= STAGES.indexOf('到店') && customer.stage !== '已流失') visitIds.add(customer.id)
  })
  const completed = items.filter((customer) => inPeriod(customer.dealDate))
  return {
    newLeads: newCustomers.length,
    newVisits: visitIds.size,
    deals: completed.length,
    dealAmount: completed.reduce((sum, customer) => sum + (customer.dealAmount ?? customer.expectedAmount), 0),
  }
}

function comparison(current: number, previous: number) {
  if (!previous) return current ? { text: `新增 ${current}`, tone: 'up' } : { text: '持平', tone: 'flat' }
  const change = Math.round(((current - previous) / previous) * 100)
  return { text: change === 0 ? '持平' : `${change > 0 ? '增长' : '下降'} ${Math.abs(change)}%`, tone: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' }
}

export interface ManagerDashboardProps {
  customers?: Customer[]
  followUps?: FollowUp[]
  now?: Date
}

export interface DashboardSummary {
  activeCustomers: number
  completedCustomers: number
  lostCustomers: number
  pendingCustomers: number
  pipelineAmount: number
  highIntentCustomers: number
  conversionRate: number
  revenueAmount: number
  paidAmount: number
  receivableAmount: number
  averageOrderValue: number
  marketingCustomers: Customer[]
  overdueCustomers: Customer[]
  staleCustomers: Customer[]
}

export function getDashboardSummary(items: Customer[], now = new Date()): DashboardSummary {
  const active = items.filter((customer) => !CLOSED_STAGES.includes(customer.stage))
  const overdueCustomers = active.filter(
    (customer) => customer.nextFollowUpAt && new Date(customer.nextFollowUpAt).getTime() < now.getTime(),
  )
  const staleCustomers = active.filter(
    (customer) => !customer.nextFollowUpAt && now.getTime() - new Date(customer.lastContactAt).getTime() >= 3 * DAY,
  )
  const won = items.filter((customer) => WON_STAGES.includes(customer.stage)).length
  const completed = items.filter((customer) => (customer.dealAmount ?? 0) > 0 || customer.stage === '已成交')
  const revenueAmount = completed.reduce((sum, customer) => sum + (customer.dealAmount ?? customer.expectedAmount), 0)
  const paidAmount = completed.reduce((sum, customer) => sum + (customer.paidAmount ?? 0), 0)
  const marketingCustomers = completed.filter((customer) => customer.marketingStatus !== '暂不营销')

  return {
    activeCustomers: active.length,
    completedCustomers: completed.length,
    lostCustomers: items.filter((customer) => customer.stage === '已流失').length,
    pendingCustomers: active.filter((customer) => Boolean(customer.nextFollowUpAt)).length,
    pipelineAmount: active.reduce((sum, customer) => sum + customer.expectedAmount, 0),
    highIntentCustomers: active.filter((customer) => customer.intent === '高').length,
    conversionRate: items.length ? Math.round((won / items.length) * 100) : 0,
    revenueAmount,
    paidAmount,
    receivableAmount: Math.max(0, revenueAmount - paidAmount),
    averageOrderValue: completed.length ? Math.round(revenueAmount / completed.length) : 0,
    marketingCustomers,
    overdueCustomers,
    staleCustomers,
  }
}

const formatMoney = (amount: number) =>
  amount >= 10_000 ? `${(amount / 10_000).toFixed(amount % 10_000 ? 1 : 0)}万` : amount.toLocaleString('zh-CN')

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(value))

const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`

function customerUrl(params: Record<string, string | undefined>) {
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])))
  return `#/customers?${query.toString()}`
}

export function ManagerDashboard({
  customers = defaultCustomers,
  followUps = defaultFollowUps,
  now = new Date(),
}: ManagerDashboardProps) {
  const [periodUnit, setPeriodUnit] = useState<PeriodUnit>('month')
  const [periodAnchor, setPeriodAnchor] = useState(() => new Date(now))
  const summary = getDashboardSummary(customers, now)
  const period = getDashboardPeriod(periodUnit, periodAnchor)
  const previous = previousPeriod(periodUnit, period)
  const periodSummary = getPeriodSummary(customers, followUps, period)
  const previousSummary = getPeriodSummary(customers, followUps, previous)
  const comparisonLabel = periodUnit === 'month' ? '上月' : periodUnit === 'quarter' ? '上季度' : '上年'
  const movePeriod = (direction: -1 | 1) => setPeriodAnchor((current) => {
    const next = new Date(current)
    if (periodUnit === 'year') next.setFullYear(next.getFullYear() + direction)
    else next.setMonth(next.getMonth() + direction * (periodUnit === 'quarter' ? 3 : 1))
    return next
  })
  const active = customers.filter((customer) => !CLOSED_STAGES.includes(customer.stage))
  const salespeople = [...new Set(customers.map((customer) => customer.salesperson))]
    .map((name) => {
      const owned = customers.filter((customer) => customer.salesperson === name)
      const activeOwned = owned.filter((customer) => !CLOSED_STAGES.includes(customer.stage))
      return {
        name,
        active: activeOwned.length,
        amount: activeOwned.reduce((sum, customer) => sum + customer.expectedAmount, 0),
        highIntent: activeOwned.filter((customer) => customer.intent === '高').length,
        followUps: followUps.filter((item) => item.salesperson === name).length,
      }
    })
    .sort((a, b) => b.amount - a.amount)
  const maxSalesAmount = Math.max(...salespeople.map((person) => person.amount), 1)
  const stages = STAGES.map((stage) => ({ stage, count: customers.filter((customer) => customer.stage === stage).length }))
    .filter((item) => item.count > 0)
  const maxStageCount = Math.max(...stages.map((item) => item.count), 1)
  const riskCustomers = [...summary.overdueCustomers, ...summary.staleCustomers.filter(
    (customer) => !summary.overdueCustomers.some((overdue) => overdue.id === customer.id),
  )].sort((a, b) => b.expectedAmount - a.expectedAmount)
  const dueToday = active.filter((customer) => {
    if (!customer.nextFollowUpAt) return false
    const date = new Date(customer.nextFollowUpAt)
    return date.toDateString() === now.toDateString()
  }).length
  const topRisk = riskCustomers[0]
  const suggestions = [
    summary.overdueCustomers.length
      ? { level: 'urgent', text: `先处理 ${summary.overdueCustomers.length} 位逾期客户，避免高价值商机继续降温。`, href: customerUrl({ task: '已逾期' }) }
      : { level: 'good', text: '当前没有逾期跟进，继续保持今日节奏。', href: customerUrl({ scope: 'active' }) },
    topRisk
      ? { level: 'focus', text: `重点协助${topRisk.salesperson}推进${topRisk.name}，预计金额 ${formatMoney(topRisk.expectedAmount)}。`, href: customerUrl({ customer: topRisk.id }) }
      : { level: 'good', text: '客户跟进计划完整，暂无需要店长介入的风险商机。', href: customerUrl({ scope: 'active' }) },
    { level: 'focus', text: `今日共有 ${dueToday} 项计划跟进，晚班前复盘结果并明确下一步动作。`, href: '#/tasks' },
  ]

  return (
    <section className="manager-dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">店长经营分析</p>
          <h1 id="dashboard-title">经营总览</h1>
          <p className="dashboard-subtitle">聚焦团队产能、商机推进与今日风险</p>
        </div>
        <div className="dashboard-date"><CalendarClock size={17} />数据更新至 {now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</div>
      </header>

      <section className="period-analysis" aria-labelledby="period-analysis-title">
        <header>
          <div><h2 id="period-analysis-title">周期经营对比</h2><p>{period.label}与{comparisonLabel}经营结果</p></div>
          <div className="period-toolbar">
            <div className="period-tabs" aria-label="统计周期">
              {([['month', '月度'], ['quarter', '季度'], ['year', '年度']] as const).map(([unit, label]) => <button type="button" className={periodUnit === unit ? 'active' : ''} aria-pressed={periodUnit === unit} onClick={() => { setPeriodUnit(unit); setPeriodAnchor(new Date(now)) }} key={unit}>{label}</button>)}
            </div>
            <div className="period-stepper"><button type="button" aria-label="上一周期" onClick={() => movePeriod(-1)}>‹</button><strong>{period.label}</strong><button type="button" aria-label="下一周期" onClick={() => movePeriod(1)}>›</button></div>
          </div>
        </header>
        <div className="period-metrics">
          <PeriodMetric href={customerUrl({ period: 'leads', from: dateKey(period.start), to: dateKey(period.end) })} icon={<UserPlus />} label="新增线索" value={`${periodSummary.newLeads}`} unit="人" compare={comparison(periodSummary.newLeads, previousSummary.newLeads)} comparisonLabel={comparisonLabel} />
          <PeriodMetric href={customerUrl({ period: 'visits', from: dateKey(period.start), to: dateKey(period.end) })} icon={<Store />} label="新到店客户" value={`${periodSummary.newVisits}`} unit="人" compare={comparison(periodSummary.newVisits, previousSummary.newVisits)} comparisonLabel={comparisonLabel} />
          <PeriodMetric href={customerUrl({ period: 'deals', from: dateKey(period.start), to: dateKey(period.end) })} icon={<CheckCircle2 />} label="新增成交" value={`${periodSummary.deals}`} unit="单" compare={comparison(periodSummary.deals, previousSummary.deals)} comparisonLabel={comparisonLabel} />
          <PeriodMetric href={customerUrl({ period: 'deals', from: dateKey(period.start), to: dateKey(period.end) })} icon={<CircleDollarSign />} label="成交金额" value={`¥${formatMoney(periodSummary.dealAmount)}`} compare={comparison(periodSummary.dealAmount, previousSummary.dealAmount)} comparisonLabel={comparisonLabel} />
        </div>
      </section>

      <div className="metric-grid">
        <Metric href={customerUrl({ scope: 'active', metric: 'active' })} icon={<Users />} label="在跟客户" value={`${summary.activeCustomers}`} detail={`待跟进 ${summary.pendingCustomers} · 成交 ${summary.completedCustomers} · 流失 ${summary.lostCustomers}`} tone="green" />
        <Metric href={customerUrl({ scope: 'active', sort: 'amount-desc', metric: 'pipeline' })} icon={<CircleDollarSign />} label="预计商机金额" value={`¥${formatMoney(summary.pipelineAmount)}`} detail="未关闭商机合计" tone="gold" />
        <Metric href={customerUrl({ scope: 'active', intent: '高', metric: 'high-intent' })} icon={<Target />} label="高意向客户" value={`${summary.highIntentCustomers}`} detail="优先保障跟进" tone="red" />
        <Metric href={customerUrl({ scope: 'won', metric: 'conversion' })} icon={<TrendingUp />} label="推进转化率" value={`${summary.conversionRate}%`} detail="定金及后续阶段" tone="blue" />
      </div>

      <div className="metric-grid revenue-metric-grid">
        <Metric href={customerUrl({ scope: 'deals', metric: 'revenue' })} icon={<CircleDollarSign />} label="累计成交金额" value={`¥${formatMoney(summary.revenueAmount)}`} detail={`${summary.completedCustomers} 位成交客户`} tone="green" />
        <Metric href={customerUrl({ scope: 'paid', metric: 'paid' })} icon={<CheckCircle2 />} label="已收款" value={`¥${formatMoney(summary.paidAmount)}`} detail="按成交登记汇总" tone="blue" />
        <Metric href={customerUrl({ scope: 'receivable', metric: 'receivable' })} icon={<CalendarClock />} label="待收款" value={`¥${formatMoney(summary.receivableAmount)}`} detail="需要继续跟进回款" tone="red" />
        <Metric href={customerUrl({ scope: 'deals', metric: 'average-order' })} icon={<Target />} label="平均客单价" value={`¥${formatMoney(summary.averageOrderValue)}`} detail={`${summary.marketingCustomers.length} 位可持续经营`} tone="gold" />
      </div>

      <Panel title="成交后持续经营" subtitle={`${summary.marketingCustomers.length} 位客户可继续营销`}>
        <div className="marketing-list">
          {summary.marketingCustomers.slice(0, 6).map((customer) => <a href={customerUrl({ customer: customer.id })} key={customer.id}>
            <span>{customer.name.slice(0, 1)}</span><div><strong>{customer.name}</strong><small>{customer.marketingNote || `${customer.dealProducts?.join('、') || customer.products.join('、') || '已成交客户'}后续维护`}</small></div><b>{customer.marketingStatus ?? '待回访'}</b><time>{customer.marketingNextAt || '待安排'}</time>
          </a>)}
          {!summary.marketingCustomers.length && <EmptyState text="成交登记后，可加购与转介绍客户会显示在这里" />}
        </div>
      </Panel>

      <div className="dashboard-grid dashboard-grid-top">
        <Panel title="销售人员对比" subtitle="按在跟商机金额排序">
          <div className="sales-table" role="table" aria-label="销售人员业绩对比">
            <div className="sales-row sales-head" role="row"><span>销售</span><span>在跟 / 高意向</span><span>跟进</span><span>商机金额</span></div>
            {salespeople.map((person, index) => (
              <a href={customerUrl({ owner: person.name, scope: 'active' })} className="sales-row" role="row" key={person.name}>
                <span className="sales-name"><b>{index + 1}</b>{person.name}</span>
                <span>{person.active} / <em>{person.highIntent}</em></span>
                <span>{person.followUps} 次</span>
                <span className="sales-amount"><strong>¥{formatMoney(person.amount)}</strong><i style={{ width: `${(person.amount / maxSalesAmount) * 100}%` }} /></span>
              </a>
            ))}
            {!salespeople.length && <EmptyState text="暂无销售数据" />}
          </div>
        </Panel>

        <Panel title="客户阶段分布" subtitle={`${summary.activeCustomers} 个活跃商机`}>
          <div className="stage-chart" aria-label="客户阶段分布图">
            {stages.map(({ stage, count }) => (
              <a href={customerUrl({ stage })} className="stage-row" key={stage}>
                <span>{stage}</span>
                <div><i style={{ width: `${Math.max((count / maxStageCount) * 100, 8)}%` }} /></div>
                <strong>{count}</strong>
              </a>
            ))}
            {!stages.length && <EmptyState text="暂无阶段数据" />}
          </div>
        </Panel>
      </div>

      <div className="dashboard-grid dashboard-grid-bottom">
        <Panel title="逾期与风险客户" subtitle={`${riskCustomers.length} 位需要关注`} alert={riskCustomers.length > 0}>
          <div className="risk-list">
            {riskCustomers.map((customer) => {
              const overdue = Boolean(customer.nextFollowUpAt && new Date(customer.nextFollowUpAt) < now)
              return (
                <a href={customerUrl({ customer: customer.id })} className="risk-item" key={customer.id}>
                  <div className="risk-avatar">{customer.name.slice(0, 1)}</div>
                  <div className="risk-main">
                    <div><strong>{customer.name}</strong><span className={`intent intent-${customer.intent}`}>{customer.intent}意向</span></div>
                    <p>{customer.salesperson} · {customer.stage} · ¥{formatMoney(customer.expectedAmount)}</p>
                  </div>
                  <div className={`risk-status ${overdue ? 'is-overdue' : ''}`}>
                    {overdue ? '已逾期' : '久未联系'}
                    <small>{formatDateTime(customer.nextFollowUpAt ?? customer.lastContactAt)}</small>
                    <span className="risk-entry">查看资料 <ArrowRight size={13} aria-hidden="true" /></span>
                  </div>
                </a>
              )
            })}
            {!riskCustomers.length && <EmptyState text="暂无风险客户" success />}
          </div>
        </Panel>

        <Panel title="今日管理建议" subtitle="按经营数据自动生成">
          <div className="suggestion-list">
            {suggestions.map((suggestion, index) => (
              <a href={suggestion.href} className={`suggestion suggestion-${suggestion.level}`} key={suggestion.text}>
                <span>{suggestion.level === 'good' ? <CheckCircle2 /> : suggestion.level === 'urgent' ? <AlertTriangle /> : <Lightbulb />}</span>
                <div><small>建议 {index + 1}</small><p>{suggestion.text}</p></div>
                <ArrowRight aria-hidden="true" />
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function Metric({ icon, label, value, detail, tone, href }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string; href: string }) {
  return <a href={href} className={`metric metric-${tone}`} aria-label={`查看${label}明细`}><span className="metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div><ArrowRight className="metric-arrow" aria-hidden="true" /></a>
}

function PeriodMetric({ icon, label, value, unit, compare, comparisonLabel, href }: { icon: React.ReactNode; label: string; value: string; unit?: string; compare: { text: string; tone: string }; comparisonLabel: string; href: string }) {
  return <a href={href} className="period-metric" aria-label={`查看${label}明细`}><span>{icon}</span><div><p>{label}</p><strong>{value}<small>{unit}</small></strong><em className={`compare-${compare.tone}`}>较{comparisonLabel} {compare.text}</em></div><ArrowRight aria-hidden="true" /></a>
}

function Panel({ title, subtitle, children, alert = false }: { title: string; subtitle: string; children: React.ReactNode; alert?: boolean }) {
  return <section className="dashboard-panel"><header><div><h2>{title}</h2><p>{subtitle}</p></div>{alert && <span className="panel-alert"><AlertTriangle size={14} />需处理</span>}</header>{children}</section>
}

function EmptyState({ text, success = false }: { text: string; success?: boolean }) {
  return <div className="dashboard-empty">{success ? <CheckCircle2 /> : <Users />}<span>{text}</span></div>
}

export default ManagerDashboard
