import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, ChevronRight, ClipboardCheck, MessageSquareQuote, ShieldAlert, Sparkles } from 'lucide-react'
import type { Customer, FollowUp } from '../../types'
import { evaluateSalesSop, getManualStorageKey, inferSopPath, type ManualConfirmations, type SopItemKind, type SopPath } from './sop-engine'
import './sop.css'

export interface SalesSopPageProps { customers: Customer[]; followUps: FollowUp[] }

const sectionLabels: Record<SopItemKind, string> = { question: '必问信息', action: '必做动作', condition: '通过条件' }
const pathOptions: { id:SopPath; label:string; description:string }[] = [
  { id:'retail-fast', label:'成品当场成交', description:'选品 → 报价成交 → 送货售后' },
  { id:'retail-followup', label:'成品需要跟进', description:'首次到店后安排再次到店' },
  { id:'custom', label:'量尺定制', description:'到店体验与上门量尺分开推进' },
]

function loadManual(customerId: string): ManualConfirmations {
  try { return JSON.parse(localStorage.getItem(getManualStorageKey(customerId)) ?? '{}') as ManualConfirmations } catch { return {} }
}
function loadPath(customer: Customer): SopPath {
  const saved = localStorage.getItem(`shangpinju:sales-sop:path:${customer.id}`)
  return pathOptions.some((item) => item.id === saved) ? saved as SopPath : inferSopPath(customer)
}

export function SalesSopPage({ customers, followUps }: SalesSopPageProps) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '')
  const [manual, setManual] = useState<ManualConfirmations>(() => customerId ? loadManual(customerId) : {})
  const customer = customers.find((item) => item.id === customerId) ?? customers[0]
  const [path, setPath] = useState<SopPath>(() => customer ? loadPath(customer) : 'retail-followup')
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  useEffect(() => { if (customer && customer.id !== customerId) setCustomerId(customer.id) }, [customer, customerId])
  useEffect(() => { if (customer) { setManual(loadManual(customer.id)); setPath(loadPath(customer)) } }, [customer?.id])
  const evaluation = useMemo(() => customer ? evaluateSalesSop(customer, followUps, manual, path) : null, [customer, followUps, manual, path])
  useEffect(() => { if (evaluation) setActiveStageIndex(evaluation.currentStageIndex) }, [customer?.id, path, evaluation?.currentStageIndex])

  function selectPath(nextPath: SopPath) {
    if (!customer) return
    setPath(nextPath)
    localStorage.setItem(`shangpinju:sales-sop:path:${customer.id}`, nextPath)
  }

  function toggle(itemId: string) {
    if (!customer) return
    setManual((current) => {
      const next = { ...current, [itemId]: !current[itemId] }
      if (!next[itemId]) delete next[itemId]
      localStorage.setItem(getManualStorageKey(customer.id), JSON.stringify(next))
      return next
    })
  }

  if (!customer || !evaluation) return <section className="sales-sop sop-empty"><ClipboardCheck size={32} /><h1>家具销售 SOP</h1><p>录入客户后即可按阶段检查销售动作。</p></section>

  const current = evaluation.stages[activeStageIndex] ?? evaluation.currentStage
  const currentMissing = current.items.filter((item) => !item.completed)
  const currentReady = currentMissing.length === 0
  const nextViewedStage = evaluation.stages[activeStageIndex + 1]
  const currentActions = currentReady ? [nextViewedStage ? `推进至「${nextViewedStage.name}」并约定首个动作` : '完成成交交付，并持续跟进送货与售后'] : currentMissing.map((item) => item.label)
  return <section className="sales-sop" aria-label="家具销售 SOP">
    <header className="sop-hero">
      <div><p className="sop-eyebrow">尚品居 · 门店成交作业台</p><h1>家具销售 SOP</h1><span>把每一次跟进变成清晰、可复盘的成交动作</span></div>
      <label className="sop-customer-picker">当前客户<select aria-label="选择客户" value={customer.id} onChange={(event) => setCustomerId(event.target.value)}>{customers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.stage}</option>)}</select></label>
    </header>

    <section className="sop-path-selector" aria-label="客户成交路径"><div><strong>客户成交路径</strong><span>按实际情况选择，不需要的环节会自动省略</span></div><div>{pathOptions.map((option) => <button type="button" className={path === option.id ? 'active' : ''} aria-pressed={path === option.id} key={option.id} onClick={() => selectPath(option.id)}><b>{option.label}</b><small>{option.description}</small></button>)}</div></section>

    <nav className="sop-stage-track" aria-label="销售阶段">
      {evaluation.stages.map((stage, index) => <button type="button" onClick={() => setActiveStageIndex(index)} key={stage.id} className={`sop-stage-node ${stage.status} ${activeStageIndex === index ? 'viewing' : ''}`} aria-current={stage.status === 'current' ? 'step' : undefined} aria-pressed={activeStageIndex === index}>
        <span>{stage.status === 'completed' ? <Check size={15} /> : index + 1}</span><div><b>{stage.name}</b><small>{stage.completedCount}/{stage.items.length}</small></div>{index < evaluation.stages.length - 1 && <ChevronRight size={15} />}
      </button>)}
    </nav>

    <div className="sop-summary-grid">
      <article className="sop-customer-summary"><div><span>当前客户</span><strong>{customer.name}</strong><small>{customer.salesperson} 负责 · {customer.intent}意向</small></div><dl><div><dt>意向品类</dt><dd>{customer.products.join('、') || '待确认'}</dd></div><div><dt>预算</dt><dd>{customer.budget || '待确认'}</dd></div><div><dt>风格</dt><dd>{customer.style || '待确认'}</dd></div></dl></article>
      <article className={`sop-readiness ${currentReady ? 'ready' : ''}`}><div className="sop-readiness-icon">{currentReady ? <CheckCircle2 /> : <AlertTriangle />}</div><div><span>{activeStageIndex === evaluation.currentStageIndex ? '当前阶段判断' : '查看阶段判断'}</span><strong>{currentReady ? '已具备推进条件' : `还缺 ${currentMissing.length} 项`}</strong><p>{currentReady ? (nextViewedStage ? `可以进入「${nextViewedStage.name}」` : '进入送货与售后跟进') : `完成下方清单后再推进至「${nextViewedStage?.name ?? '交付'}」`}</p></div></article>
    </div>

    <div className="sop-workspace">
      <main className="sop-main">
        <header className="sop-stage-header"><div><p>{activeStageIndex === evaluation.currentStageIndex ? '当前阶段' : '查看阶段'} · {activeStageIndex + 1}/{evaluation.stages.length}</p><h2>{current.name}</h2><span>{current.summary}</span></div><div className="sop-progress"><strong>{Math.round(current.completedCount / current.items.length * 100)}%</strong><span>本阶段完成度</span></div></header>
        <section className="sop-checklist" aria-label={`${current.name}检查清单`}>
          {(['question', 'action', 'condition'] as SopItemKind[]).map((kind) => <div className="sop-check-group" key={kind}><h3>{sectionLabels[kind]}</h3>{current.items.filter((x) => x.kind === kind).map((check) => <label className={check.completed ? 'checked' : ''} key={check.id}><input type="checkbox" checked={check.completed} disabled={check.source === 'stage' || check.source === 'data'} onChange={() => toggle(check.id)} /><span className="check-mark"><Check size={14} /></span><span>{check.label}<small>{check.source === 'data' ? '客户资料/跟进记录已识别' : check.source === 'manual' ? '人工确认' : '待完成，可人工确认'}</small></span></label>)}</div>)}
        </section>
        <div className="sop-reference-grid">
          <section><h3><ShieldAlert size={17} />常见风险</h3><ul>{current.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></section>
          <section className="sop-script"><h3><MessageSquareQuote size={17} />推荐话术</h3><blockquote>{current.script}</blockquote></section>
        </div>
      </main>

      <aside className="sop-action-panel"><header><Sparkles size={18} /><div><h2>下一步行动</h2><span>根据现有资料实时生成</span></div></header><ol>{currentActions.map((action, index) => <li key={action}><span>{index + 1}</span><p>{action}</p></li>)}</ol><div className="sop-evidence"><h3>判断依据</h3><p>成交路径：{pathOptions.find((item) => item.id === path)?.label}</p><p>客户阶段：{customer.stage}</p><p>有效跟进：{followUps.filter((x) => x.customerId === customer.id).length} 条</p><p>人工确认：{Object.values(manual).filter(Boolean).length} 项</p></div></aside>
    </div>

    <section className="sop-playbook"><header><div><p>当前路径参考</p><h2>{pathOptions.find((item) => item.id === path)?.label}作业手册</h2></div><span>展开查看每一阶段的标准动作</span></header><div className="sop-playbook-list">{evaluation.stages.map((stage, index) => <details key={stage.id} open={activeStageIndex === index}><summary><span>{index + 1}</span><div><strong>{stage.name}</strong><small>{stage.summary}</small></div><b>{stage.status === 'completed' ? '已完成' : stage.status === 'current' ? '进行中' : '待推进'}</b></summary><div className="sop-detail-body"><section><h3>必问信息</h3><ul>{stage.questions.map((x) => <li key={x}>{x}</li>)}</ul></section><section><h3>必做动作</h3><ul>{stage.actions.map((x) => <li key={x}>{x}</li>)}</ul></section><section><h3>通过条件</h3><ul>{stage.conditions.map((x) => <li key={x}>{x}</li>)}</ul></section><section><h3>常见风险</h3><ul>{stage.risks.map((x) => <li key={x}>{x}</li>)}</ul></section><section className="wide"><h3>推荐话术</h3><p>{stage.script}</p></section></div></details>)}</div></section>
  </section>
}

export default SalesSopPage
