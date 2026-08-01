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
} from 'lucide-react'
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

export function ManagerDashboard({
  customers = defaultCustomers,
  followUps = defaultFollowUps,
  now = new Date(),
}: ManagerDashboardProps) {
  const summary = getDashboardSummary(customers, now)
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
      ? { level: 'urgent', text: `先处理 ${summary.overdueCustomers.length} 位逾期客户，避免高价值商机继续降温。` }
      : { level: 'good', text: '当前没有逾期跟进，继续保持今日节奏。' },
    topRisk
      ? { level: 'focus', text: `重点协助${topRisk.salesperson}推进${topRisk.name}，预计金额 ${formatMoney(topRisk.expectedAmount)}。` }
      : { level: 'good', text: '客户跟进计划完整，暂无需要店长介入的风险商机。' },
    { level: 'focus', text: `今日共有 ${dueToday} 项计划跟进，晚班前复盘结果并明确下一步动作。` },
  ]

  return (
    <section className="manager-dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-header">
        <div>
          <p className="dashboard-eyebrow">店长经营分析</p>
          <h1 id="dashboard-title">经营总览</h1>
          <p className="dashboard-subtitle">聚焦团队产能、商机推进与今日风险</p>
        </div>
        <div className="dashboard-date"><CalendarClock size={17} />{now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
      </header>

      <div className="metric-grid">
        <Metric icon={<Users />} label="在跟客户" value={`${summary.activeCustomers}`} detail={`待跟进 ${summary.pendingCustomers} · 成交 ${summary.completedCustomers} · 流失 ${summary.lostCustomers}`} tone="green" />
        <Metric icon={<CircleDollarSign />} label="预计商机金额" value={`¥${formatMoney(summary.pipelineAmount)}`} detail="未关闭商机合计" tone="gold" />
        <Metric icon={<Target />} label="高意向客户" value={`${summary.highIntentCustomers}`} detail="优先保障跟进" tone="red" />
        <Metric icon={<TrendingUp />} label="推进转化率" value={`${summary.conversionRate}%`} detail="定金及后续阶段" tone="blue" />
      </div>

      <div className="metric-grid revenue-metric-grid">
        <Metric icon={<CircleDollarSign />} label="累计成交金额" value={`¥${formatMoney(summary.revenueAmount)}`} detail={`${summary.completedCustomers} 位成交客户`} tone="green" />
        <Metric icon={<CheckCircle2 />} label="已收款" value={`¥${formatMoney(summary.paidAmount)}`} detail="按成交登记汇总" tone="blue" />
        <Metric icon={<CalendarClock />} label="待收款" value={`¥${formatMoney(summary.receivableAmount)}`} detail="需要继续跟进回款" tone="red" />
        <Metric icon={<Target />} label="平均客单价" value={`¥${formatMoney(summary.averageOrderValue)}`} detail={`${summary.marketingCustomers.length} 位可持续经营`} tone="gold" />
      </div>

      <Panel title="成交后持续经营" subtitle={`${summary.marketingCustomers.length} 位客户可继续营销`}>
        <div className="marketing-list">
          {summary.marketingCustomers.slice(0, 6).map((customer) => <article key={customer.id}>
            <span>{customer.name.slice(0, 1)}</span><div><strong>{customer.name}</strong><small>{customer.marketingNote || `${customer.dealProducts?.join('、') || customer.products.join('、') || '已成交客户'}后续维护`}</small></div><b>{customer.marketingStatus ?? '待回访'}</b><time>{customer.marketingNextAt || '待安排'}</time>
          </article>)}
          {!summary.marketingCustomers.length && <EmptyState text="成交登记后，可加购与转介绍客户会显示在这里" />}
        </div>
      </Panel>

      <div className="dashboard-grid dashboard-grid-top">
        <Panel title="销售人员对比" subtitle="按在跟商机金额排序">
          <div className="sales-table" role="table" aria-label="销售人员业绩对比">
            <div className="sales-row sales-head" role="row"><span>销售</span><span>在跟 / 高意向</span><span>跟进</span><span>商机金额</span></div>
            {salespeople.map((person, index) => (
              <div className="sales-row" role="row" key={person.name}>
                <span className="sales-name"><b>{index + 1}</b>{person.name}</span>
                <span>{person.active} / <em>{person.highIntent}</em></span>
                <span>{person.followUps} 次</span>
                <span className="sales-amount"><strong>¥{formatMoney(person.amount)}</strong><i style={{ width: `${(person.amount / maxSalesAmount) * 100}%` }} /></span>
              </div>
            ))}
            {!salespeople.length && <EmptyState text="暂无销售数据" />}
          </div>
        </Panel>

        <Panel title="客户阶段分布" subtitle={`${summary.activeCustomers} 个活跃商机`}>
          <div className="stage-chart" aria-label="客户阶段分布图">
            {stages.map(({ stage, count }) => (
              <div className="stage-row" key={stage}>
                <span>{stage}</span>
                <div><i style={{ width: `${Math.max((count / maxStageCount) * 100, 8)}%` }} /></div>
                <strong>{count}</strong>
              </div>
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
                <article className="risk-item" key={customer.id}>
                  <div className="risk-avatar">{customer.name.slice(0, 1)}</div>
                  <div className="risk-main">
                    <div><strong>{customer.name}</strong><span className={`intent intent-${customer.intent}`}>{customer.intent}意向</span></div>
                    <p>{customer.salesperson} · {customer.stage} · ¥{formatMoney(customer.expectedAmount)}</p>
                  </div>
                  <div className={`risk-status ${overdue ? 'is-overdue' : ''}`}>
                    {overdue ? '已逾期' : '久未联系'}
                    <small>{formatDateTime(customer.nextFollowUpAt ?? customer.lastContactAt)}</small>
                  </div>
                </article>
              )
            })}
            {!riskCustomers.length && <EmptyState text="暂无风险客户" success />}
          </div>
        </Panel>

        <Panel title="今日管理建议" subtitle="按经营数据自动生成">
          <div className="suggestion-list">
            {suggestions.map((suggestion, index) => (
              <div className={`suggestion suggestion-${suggestion.level}`} key={suggestion.text}>
                <span>{suggestion.level === 'good' ? <CheckCircle2 /> : suggestion.level === 'urgent' ? <AlertTriangle /> : <Lightbulb />}</span>
                <div><small>建议 {index + 1}</small><p>{suggestion.text}</p></div>
                <ArrowRight aria-hidden="true" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <article className={`metric metric-${tone}`}><span className="metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article>
}

function Panel({ title, subtitle, children, alert = false }: { title: string; subtitle: string; children: React.ReactNode; alert?: boolean }) {
  return <section className="dashboard-panel"><header><div><h2>{title}</h2><p>{subtitle}</p></div>{alert && <span className="panel-alert"><AlertTriangle size={14} />需处理</span>}</header>{children}</section>
}

function EmptyState({ text, success = false }: { text: string; success?: boolean }) {
  return <div className="dashboard-empty">{success ? <CheckCircle2 /> : <Users />}<span>{text}</span></div>
}

export default ManagerDashboard
