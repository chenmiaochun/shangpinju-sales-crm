import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpRight, BarChart3, Boxes, CheckCircle2, Lightbulb, Megaphone, MessageSquareText, Radio, Target } from 'lucide-react'
import type { Customer, FollowUp } from '../../types'
import { buildSalesInsights, formatCompactMoney, type InsightPeriod, type TrendPoint } from './insights'
import './insights.css'

export interface SalesInsightsPageProps { customers: Customer[]; followUps: FollowUp[]; now?: Date }

export function SalesInsightsPage({ customers, followUps, now = new Date() }: SalesInsightsPageProps) {
  const [period, setPeriod] = useState<InsightPeriod>(30)
  const insight = useMemo(() => buildSalesInsights(customers, followUps, period, now), [customers, followUps, period, now])
  const isEmpty = customers.length === 0 && followUps.length === 0

  return <main className="sales-insights" aria-labelledby="insights-title">
    <header className="insights-header">
      <div><p className="insights-eyebrow">经营洞察</p><h1 id="insights-title">从数据找到下一步增长</h1><p>观察获客质量、商机健康度与团队跟进动作</p></div>
      <div className="period-switch" aria-label="分析时间范围">
        {([7, 30, 90] as InsightPeriod[]).map((days) => <button key={days} type="button" aria-pressed={period === days} onClick={() => setPeriod(days)}>近{days}天</button>)}
      </div>
    </header>

    {isEmpty ? <Empty title="暂无经营数据" detail="录入客户与跟进记录后，这里会生成趋势、风险和销售辅导建议。" /> : <>
      <section className="insight-summary" aria-label="周期摘要">
        <Summary icon={<Radio />} label="新增线索" value={insight.trend.reduce((sum, point) => sum + point.leads, 0).toString()} detail={`近${period}天`} tone="green" />
        <Summary icon={<Target />} label="新增商机金额" value={`¥${formatCompactMoney(insight.trend.reduce((sum, point) => sum + point.amount, 0))}`} detail="按客户创建时间" tone="gold" />
        <Summary icon={<MessageSquareText />} label="跟进活动" value={`${insight.activity.total}次`} detail={`覆盖 ${insight.activity.coverageRate}% 在跟客户`} tone="blue" />
        <Summary icon={<AlertTriangle />} label="停留风险" value={`${insight.stageRisks.reduce((sum, item) => sum + item.riskCustomers, 0)}个`} detail="超过 7 天未联系" tone="red" />
      </section>

      <div className="insights-grid insights-grid-top">
        <Panel title="业务趋势" subtitle="新增线索与跟进活动">
          <TrendChart points={insight.trend} />
        </Panel>
        <Panel title="来源质量" subtitle="按新增商机金额排序">
          {insight.sources.length ? <div className="source-list">{insight.sources.map((source) => <div className="source-row" key={source.source}>
            <div><strong>{source.source}</strong><span>{source.leads} 条线索 · {source.highIntent} 条高意向</span></div>
            <div><b>¥{formatCompactMoney(source.amount)}</b><span>高意向率 {source.highIntentRate}%</span></div>
          </div>)}</div> : <MiniEmpty text={`近${period}天暂无新增线索`} />}
        </Panel>
      </div>

      <Panel title="产品热度前十" subtitle={`近${period}天按关注、高意向与成交综合排序，为活动和备货提供依据`}>
        {insight.products.length ? <div className="product-ranking" role="table" aria-label="产品热度前十">
          <div className="product-rank-head" role="row"><span>排名 / 产品</span><span>客户热度</span><span>关联商机</span><span>活动建议</span><span>备货建议</span></div>
          {insight.products.map((item, index) => <div className="product-rank-row" role="row" key={item.product}>
            <div className="product-name"><b>{index + 1}</b><span><strong>{item.product}</strong><small>{item.supplyType ?? '供应方式待核对'}{item.availableStock !== undefined ? ` · 可用库存 ${item.availableStock}` : ''}</small></span></div>
            <div className="product-heat"><strong>{item.interestedCustomers} 人关注</strong><small>{item.highIntent} 人高意向 · {item.highIntentRate}%{item.deals ? ` · ${item.deals} 人成交` : ''}</small><i><em style={{ width: `${Math.max(item.highIntentRate, 6)}%` }}/></i></div>
            <div className="product-amount"><strong>¥{formatCompactMoney(item.amount)}</strong><small>关联客户商机</small></div>
            <span className={`product-advice ${item.activityAdvice === '优先策划活动' ? 'is-priority' : ''}`}><Megaphone size={14}/>{item.activityAdvice}</span>
            <span className="product-supply"><Boxes size={14}/>{item.supplyAdvice}</span>
          </div>)}
        </div> : <MiniEmpty text={`近${period}天暂无产品意向数据`} />}
      </Panel>

      <div className="insights-grid insights-grid-middle">
        <Panel title="阶段停留风险" subtitle="以最近联系时间评估，7 天以上标记风险">
          {insight.stageRisks.length ? <div className="risk-table" role="table" aria-label="阶段停留风险">
            <div className="risk-table-head" role="row"><span>阶段</span><span>客户</span><span>平均未联系</span><span>风险金额</span></div>
            {insight.stageRisks.map((item) => <div className="risk-table-row" role="row" key={item.stage}><strong>{item.stage}</strong><span>{item.customers} 位</span><span className={item.averageIdleDays >= 7 ? 'is-risk' : ''}>{item.averageIdleDays} 天</span><b>{item.amountAtRisk ? `¥${formatCompactMoney(item.amountAtRisk)}` : '—'}</b></div>)}
          </div> : <MiniEmpty text="暂无在跟商机" />}
        </Panel>
        <Panel title="跟进活动质量" subtitle={`近${period}天动作完整度`}>
          <div className="quality-list">
            <Quality label="客户覆盖率" value={insight.activity.coverageRate} />
            <Quality label="结果记录率" value={insight.activity.resultRate} />
            <Quality label="下一步完整率" value={insight.activity.nextActionRate} />
          </div>
          <p className="quality-footnote">人均跟进 <strong>{insight.activity.averagePerActiveCustomer}</strong> 次 / 在跟客户</p>
        </Panel>
      </div>

      <div className="insights-grid insights-grid-bottom">
        <Panel title="丢单原因" subtitle={`累计 ${insight.lostReasons.reduce((sum, item) => sum + item.count, 0)} 个流失客户`}>
          {insight.lostReasons.length ? <div className="lost-list">{insight.lostReasons.map((item) => <div key={item.reason}><span><strong>{item.reason}</strong><small>{item.count} 单 · ¥{formatCompactMoney(item.amount)}</small></span><b>{item.share}%</b><i><em style={{ width: `${item.share}%` }} /></i></div>)}</div> : <MiniEmpty text="暂无丢单记录" success />}
        </Panel>
        <Panel title="销售辅导建议" subtitle="基于当前数据自动生成">
          {insight.suggestions.length ? <div className="coaching-list">{insight.suggestions.map((text, index) => <article key={text}><span><Lightbulb /></span><div><small>建议 {index + 1}</small><p>{text}</p></div><ArrowUpRight /></article>)}</div> : <MiniEmpty text="数据积累后生成建议" />}
        </Panel>
      </div>
    </>}
  </main>
}

function Summary({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { return <article className={`insight-summary-card tone-${tone}`}><span>{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></article> }
function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <section className="insights-panel"><header><h2>{title}</h2><p>{subtitle}</p></header>{children}</section> }
function Quality({ label, value }: { label: string; value: number }) { return <div className="quality-row"><div><span>{label}</span><b>{value}%</b></div><i><em className={value < 60 ? 'low' : value < 80 ? 'medium' : ''} style={{ width: `${value}%` }} /></i></div> }
function MiniEmpty({ text, success = false }: { text: string; success?: boolean }) { return <div className="insights-mini-empty">{success ? <CheckCircle2 /> : <BarChart3 />}<span>{text}</span></div> }
function Empty({ title, detail }: { title: string; detail: string }) { return <section className="insights-empty"><BarChart3 /><h2>{title}</h2><p>{detail}</p></section> }

function TrendChart({ points }: { points: TrendPoint[] }) {
  const width = 720, height = 190, padX = 24, padTop = 18, padBottom = 34
  const max = Math.max(...points.flatMap((point) => [point.leads, point.followUps]), 1)
  const x = (index: number) => points.length === 1 ? width / 2 : padX + (index / (points.length - 1)) * (width - padX * 2)
  const y = (value: number) => padTop + (1 - value / max) * (height - padTop - padBottom)
  const line = (key: 'leads' | 'followUps') => points.map((point, index) => `${x(index)},${y(point[key])}`).join(' ')
  return <div className="trend-wrap">
    <div className="trend-legend"><span><i className="lead-dot" />新增线索</span><span><i className="follow-dot" />跟进活动</span></div>
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="新增线索与跟进活动趋势图">
      {[0, .5, 1].map((ratio) => <line key={ratio} x1={padX} x2={width - padX} y1={y(max * ratio)} y2={y(max * ratio)} className="grid-line" />)}
      <polyline points={line('followUps')} className="trend-follow" /><polyline points={line('leads')} className="trend-lead" />
      {points.map((point, index) => <g key={`${point.label}-${index}`}><circle cx={x(index)} cy={y(point.followUps)} r="4" className="follow-point" /><circle cx={x(index)} cy={y(point.leads)} r="4" className="lead-point" />{(points.length <= 7 || index % 2 === 0) && <text x={x(index)} y={height - 9} textAnchor="middle">{point.label}</text>}</g>)}
    </svg>
  </div>
}

export default SalesInsightsPage
