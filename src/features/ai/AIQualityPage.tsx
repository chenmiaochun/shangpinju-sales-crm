import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clipboard, Sparkles, Target } from 'lucide-react'
import { customers as defaultCustomers, followUps as defaultFollowUps } from '../../data'
import type { Customer, FollowUp } from '../../types'
import { scoreCustomers, type QualityDimension } from './scoring'
import './ai-quality.css'

interface AIQualityPageProps {
  customers?: Customer[]
  followUps?: FollowUp[]
  now?: Date
}

const dimensions: QualityDimension[] = ['成交意向', '需求成熟度', '关系活跃度', '跟进健康度']

export function AIQualityPage({ customers = defaultCustomers, followUps = defaultFollowUps, now = new Date() }: AIQualityPageProps) {
  const analyses = useMemo(() => scoreCustomers(customers, followUps, now), [customers, followUps, now])
  const [selectedId, setSelectedId] = useState(analyses[0]?.customer.id ?? '')
  const [copied, setCopied] = useState<number | null>(null)
  const selected = analyses.find(({ customer }) => customer.id === selectedId) ?? analyses[0]

  if (!selected) return <main className="ai-quality"><header className="ai-quality__header"><div><span className="ai-quality__eyebrow"><Sparkles size={15} /> AI 跟进质检</span><h1>客户跟进质量与成交机会</h1></div></header><section className="ai-quality--empty">暂无客户可质检</section></main>
  const { customer, report } = selected

  async function copyScript(script: string, index: number) {
    await navigator.clipboard.writeText(script)
    setCopied(index)
    window.setTimeout(() => setCopied(null), 1600)
  }

  return (
    <main className="ai-quality">
      <header className="ai-quality__header">
        <div><span className="ai-quality__eyebrow"><Sparkles size={15} /> AI 跟进质检</span><h1>客户跟进质量与成交机会</h1></div>
        <div className="ai-quality__score"><strong>{report.overallScore}</strong><span>综合分</span></div>
      </header>

      <div className="ai-quality__layout">
        <aside className="ai-quality__customers" aria-label="客户列表">
          {analyses.map((item) => <button key={item.customer.id} className={item.customer.id === customer.id ? 'is-active' : ''} onClick={() => setSelectedId(item.customer.id)}><span><strong>{item.customer.name}</strong><small>{item.customer.stage} · {item.customer.salesperson}</small></span><b>{item.report.overallScore}</b></button>)}
        </aside>

        <div className="ai-quality__content">
          <section className="ai-quality__dimensions">
            {dimensions.map((name) => {
              const item = report.dimensions[name]
              return <article className="quality-metric" key={name}><div className="quality-metric__top"><span>{name}</span><strong>{item.score}</strong></div><div className="quality-metric__bar"><i style={{ width: `${item.score}%` }} /></div><p>{item.summary}</p><ul>{item.evidence.map((evidence) => <li key={evidence.label}><span>{evidence.label}<small>{evidence.detail}</small></span><b className={evidence.impact >= 0 ? 'is-positive' : 'is-negative'}>{evidence.impact >= 0 ? '+' : ''}{evidence.impact}</b></li>)}</ul></article>
            })}
          </section>

          <section className="quality-grid">
            <article className="quality-panel"><h2><AlertTriangle size={18} /> 风险提示</h2>{report.risks.length ? <ul className="quality-list quality-list--risk">{report.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p className="quality-ok"><CheckCircle2 size={17} /> 暂无显著风险</p>}</article>
            <article className="quality-panel"><h2><Target size={18} /> 缺失信息</h2>{report.missingInformation.length ? <div className="quality-tags">{report.missingInformation.map((item) => <span key={item}>{item}</span>)}</div> : <p className="quality-ok"><CheckCircle2 size={17} /> 关键信息完整</p>}</article>
          </section>

          <section className="quality-panel"><h2>建议下一步</h2><ol className="quality-actions">{report.nextActions.map((item) => <li key={item.action}><span data-priority={item.priority}>{item.priority}</span><div><strong>{item.action}</strong><p>{item.reason}</p></div></li>)}</ol></section>
          <section className="quality-panel"><h2>可直接使用的话术</h2><div className="quality-scripts">{report.scripts.map((script, index) => <div key={script}><p>{script}</p><button onClick={() => copyScript(script, index)} title="复制话术"><Clipboard size={16} /> {copied === index ? '已复制' : '复制'}</button></div>)}</div></section>
        </div>
      </div>
    </main>
  )
}

export default AIQualityPage
