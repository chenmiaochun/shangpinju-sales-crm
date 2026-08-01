import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageSquarePlus,
  Phone,
  Search,
  SlidersHorizontal,
  UserRound,
  FileUp,
  HandCoins,
  Trash2,
  X,
} from 'lucide-react'
import { customers as seedCustomers, followUps as seedFollowUps } from '../../data'
import { productCatalog } from '../../productCatalog'
import type { Customer, CustomerFile, CustomerStage, DesignTask, DesignTaskType, FollowUp, OrderItem } from '../../types'
import type { TeamMember } from '../team'
import './customers.css'

const STORAGE_KEY = 'shangpinju.customer-followup.v1'
const CLOSED_STAGES = new Set<CustomerStage>(['已成交', '已流失'])

export function getCustomerCounts(customers: Customer[]) {
  const completed = customers.filter((customer) => customer.stage === '已成交').length
  const lost = customers.filter((customer) => customer.stage === '已流失').length
  const active = customers.length - completed - lost
  const pending = customers.filter((customer) => !CLOSED_STAGES.has(customer.stage) && Boolean(customer.nextFollowUpAt)).length
  return { total: customers.length, active, completed, lost, pending }
}

const stages: CustomerStage[] = [
  '新线索', '已初聊', '需求确认', '到店', '量尺', '方案设计', '已报价',
  '方案调整', '已定金', '生产交付', '已成交', '已流失',
]

export type CustomerWorkspaceState = { customers: Customer[]; followUps: FollowUp[] }
export interface CustomersPageProps {
  customers?: Customer[]
  followUps?: FollowUp[]
  onStateChange?: (state: CustomerWorkspaceState) => void
  designers?: { id: string; name: string }[]
  salespeople?: { id: string; name: string }[]
  deliveryStaff?: { id: string; name: string }[]
  activeMember?: TeamMember
  onAddDesignTask?: (task: DesignTask) => void
  onRegisterDeal?: (input: DealRegistration) => void
}
export interface DealRegistration { customer: Customer; items: OrderItem[]; contractAmount: number; deposit: number; signedAt: string; expectedDeliveryAt?: string; expectedDeliveryMonth?: string; deliveryReminderAt?: string; recordedBy: string; deliveryOwnerId?: string; deliveryOwner?: string; marketingStatus?: Customer['marketingStatus']; marketingNextAt?: string; marketingNote?: string }
type Channel = FollowUp['channel']

function readState(): CustomerWorkspaceState {
  if (typeof window === 'undefined') return { customers: seedCustomers, followUps: seedFollowUps }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as CustomerWorkspaceState
      if (Array.isArray(parsed.customers) && Array.isArray(parsed.followUps)) return parsed
    }
  } catch {
    // Ignore unavailable or malformed browser storage and use the bundled data.
  }
  return { customers: seedCustomers, followUps: seedFollowUps }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value)
}

function formatDate(value?: string) {
  if (!value) return '未安排'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value))
}

function toLocalInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function isOverdue(value?: string) {
  return Boolean(value && new Date(value).getTime() < Date.now())
}

export function CustomersPage({ customers, followUps, designers = [{ id: 'demo-designer', name: '林设计师' }], salespeople = [{ id: 'demo-sales', name: '林晓' }], deliveryStaff = [{ id: 'demo-aftersales', name: '售后配送组' }], activeMember = { id: 'manager', name: '店长', role: 'manager', active: true }, onStateChange, onAddDesignTask, onRegisterDeal }: CustomersPageProps = {}) {
  const [localState, setLocalState] = useState<CustomerWorkspaceState>(readState)
  const controlled = customers !== undefined && followUps !== undefined && onStateChange !== undefined
  const state = controlled ? { customers, followUps } : localState
  const [selectedId, setSelectedId] = useState(seedCustomers[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<CustomerStage | '全部'>('全部')
  const [ownerFilter, setOwnerFilter] = useState('全部')
  const [taskFilter, setTaskFilter] = useState<'全部' | '待跟进' | '已逾期'>('全部')
  const [formOpen, setFormOpen] = useState(false)
  const [handoffOpen, setHandoffOpen] = useState(false)
  const [dealOpen, setDealOpen] = useState(false)

  useEffect(() => {
    if (!controlled) try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* no-op */ }
  }, [controlled, state])

  function commit(updater: (current: CustomerWorkspaceState) => CustomerWorkspaceState) {
    if (controlled) onStateChange(updater(state))
    else setLocalState(updater)
  }

  const owners = useMemo(() => [...new Set(state.customers.map((item) => item.salesperson))], [state.customers])
  const counts = useMemo(() => getCustomerCounts(state.customers), [state.customers])
  const filtered = useMemo(() => state.customers.filter((customer) => {
    const keyword = query.trim().toLowerCase()
    const matchesQuery = !keyword || [customer.name, customer.phone, customer.source, ...customer.products]
      .some((value) => value.toLowerCase().includes(keyword))
    const matchesStage = stageFilter === '全部' || customer.stage === stageFilter
    const matchesOwner = ownerFilter === '全部' || customer.salesperson === ownerFilter
    const matchesTask = taskFilter === '全部'
      || (taskFilter === '待跟进' && !CLOSED_STAGES.has(customer.stage) && Boolean(customer.nextFollowUpAt))
      || (taskFilter === '已逾期' && !CLOSED_STAGES.has(customer.stage) && isOverdue(customer.nextFollowUpAt))
    return matchesQuery && matchesStage && matchesOwner && matchesTask
  }), [ownerFilter, query, stageFilter, state.customers, taskFilter])

  const selected = state.customers.find((customer) => customer.id === selectedId)
  const canWorkOnSelected = Boolean(selected && (
    activeMember.role === 'manager'
    || (activeMember.role === 'operations' && selected.sourceService === activeMember.name && selected.handoffStatus !== '已接收' && selected.handoffStatus !== '已开始跟进')
    || (activeMember.role === 'sales' && (selected.salespersonId === activeMember.id || selected.salesperson === activeMember.name || selected.pendingSalespersonId === activeMember.id || selected.pendingSalesperson === activeMember.name
      || Boolean(activeMember.canDesign && (selected.designerId === activeMember.id || selected.designer === activeMember.name))))
    || (activeMember.role === 'designer' && (selected.designerId === activeMember.id || selected.designer === activeMember.name))
    || (activeMember.role === 'aftersales' && (selected.salespersonId === activeMember.id || selected.salesperson === activeMember.name))
  ))
  const timeline = useMemo(() => state.followUps
    .filter((item) => item.customerId === selectedId)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [selectedId, state.followUps])

  function updateStage(stage: CustomerStage) {
    if (stage === '已成交') {
      setDealOpen(true)
      return
    }
    commit((current) => ({
      ...current,
      customers: current.customers.map((customer) => customer.id === selectedId
        ? { ...customer, stage, nextFollowUpAt: CLOSED_STAGES.has(stage) ? undefined : customer.nextFollowUpAt }
        : customer),
    }))
  }

  function addFollowUp(data: Omit<FollowUp, 'id' | 'customerId' | 'salesperson'>, design?: DesignTaskDraft) {
    if (!selected) return
    const record: FollowUp = {
      ...data,
      id: `followup-${Date.now()}`,
      customerId: selected.id,
      salesperson: selected.salesperson,
    }
    commit((current) => ({
      followUps: [record, ...current.followUps],
      customers: current.customers.map((customer) => customer.id === selected.id ? {
        ...customer,
        lastContactAt: data.at,
        nextFollowUpAt: data.nextAt || undefined,
        handoffStatus: customer.handoffStatus === '已接收' ? '已开始跟进' : customer.handoffStatus,
      } : customer),
    }))
    if (design && onAddDesignTask) {
      const now = new Date().toISOString()
      onAddDesignTask({ ...design, id: `design-${Date.now()}`, customerId: selected.id, customerName: selected.name, salesperson: selected.salesperson, status: '待接收', solutionFiles: [], createdAt: now, updatedAt: now })
    }
    setFormOpen(false)
  }

  function saveDeal(input: Omit<DealRegistration, 'customer' | 'recordedBy'>) {
    if (!selected) return
    if (onRegisterDeal) {
      onRegisterDeal({ ...input, customer: selected, recordedBy: activeMember.name })
      setDealOpen(false)
      return
    }
    commit((current) => ({
      ...current,
      customers: current.customers.map((customer) => customer.id === selected.id
        ? { ...customer, dealAmount: input.contractAmount, paidAmount: input.deposit, dealDate: input.signedAt, deliveryDate: input.expectedDeliveryAt, dealProducts: input.items.map((item) => item.productName), stage: '已定金', nextFollowUpAt: undefined, marketingStatus: input.marketingStatus, marketingNextAt: input.marketingNextAt, marketingNote: input.marketingNote }
        : customer),
    }))
    setDealOpen(false)
  }

  function createHandoff(salespersonId: string, summary: string, appointmentAt?: string) {
    if (!selected) return
    const target = salespeople.find((item) => item.id === salespersonId)
    if (!target) return
    const at = new Date().toISOString()
    const handoff = { id: `handoff-${Date.now()}`, fromName: activeMember.name, toName: target.name, toId: target.id, status: '待销售接收' as const, summary, appointmentAt: appointmentAt ? new Date(appointmentAt).toISOString() : undefined, createdAt: at }
    commit((current) => ({ ...current, customers: current.customers.map((item) => item.id === selected.id ? { ...item, sourceService: item.sourceService || activeMember.name, handoffStatus: '待销售接收', pendingSalesperson: target.name, pendingSalespersonId: target.id, handoffHistory: [handoff, ...(item.handoffHistory ?? [])] } : item) }))
    setHandoffOpen(false)
  }

  function acceptHandoff() {
    if (!selected) return
    const at = new Date().toISOString()
    commit((current) => ({ ...current, customers: current.customers.map((item) => item.id === selected.id ? { ...item, salesperson: item.pendingSalesperson || item.salesperson, salespersonId: item.pendingSalespersonId, pendingSalesperson: undefined, pendingSalespersonId: undefined, handoffStatus: '已接收', nextFollowUpAt: item.nextFollowUpAt || at, handoffHistory: (item.handoffHistory ?? []).map((handoff, index) => index === 0 ? { ...handoff, status: '已接收' as const, acceptedAt: at } : handoff) } : item) }))
  }

  return (
    <section className="customers-page" aria-label="客户与跟进">
      <header className="customers-header">
        <div>
          <p className="customers-eyebrow">客户经营</p>
          <h1>客户与跟进</h1>
          <p className="customers-summary">在跟 {counts.active} 位 · 已成交 {counts.completed} 位 · 已流失 {counts.lost} 位 · {counts.pending} 项待跟进</p>
        </div>
        {canWorkOnSelected && <button className="primary-button header-action" onClick={() => setFormOpen(true)}><MessageSquarePlus size={18} />新增跟进</button>}
      </header>

      <div className={`customers-workspace ${selected ? 'has-selection' : ''}`}>
        <aside className={`customer-list-panel ${selected ? 'mobile-hidden' : ''}`}>
          <div className="customer-tools">
            <label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户、电话或产品" /></label>
            <div className="filter-row">
              <SlidersHorizontal size={16} aria-hidden="true" />
              <select aria-label="客户阶段" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as CustomerStage | '全部')}>
                <option>全部</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
              <select aria-label="负责人" value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
                <option>全部</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}
              </select>
            </div>
            <div className="segmented-control" aria-label="跟进状态">
              {(['全部', '待跟进', '已逾期'] as const).map((filter) => <button key={filter} className={taskFilter === filter ? 'active' : ''} onClick={() => setTaskFilter(filter)}>{filter}</button>)}
            </div>
          </div>
          <div className="list-count">{filtered.length} 位客户</div>
          <div className="customer-list">
            {filtered.map((customer) => (
              <button key={customer.id} className={`customer-row ${selectedId === customer.id ? 'selected' : ''}`} onClick={() => setSelectedId(customer.id)}>
                <span className={`intent-dot intent-${customer.intent}`} aria-label={`${customer.intent}意向`} />
                <span className="customer-row-main">
                  <span className="customer-row-title"><strong>{customer.name}</strong><span className="stage-tag">{customer.stage}</span></span>
                  <span className="customer-row-meta">{customer.phone} · {customer.source}</span>
                  <span className={`next-followup ${isOverdue(customer.nextFollowUpAt) ? 'overdue' : ''}`}><Clock3 size={14} />{customer.nextFollowUpAt ? `下次 ${formatDate(customer.nextFollowUpAt)}` : '暂无下一步任务'}</span>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!filtered.length && <div className="empty-state"><Search size={24} /><strong>没有匹配的客户</strong><span>调整搜索词或筛选条件</span></div>}
          </div>
        </aside>

        <main className={`customer-detail ${!selected ? 'mobile-hidden' : ''}`}>
          {selected ? (
            <>
              <button className="mobile-back" onClick={() => setSelectedId('')}><ArrowLeft size={18} />返回客户列表</button>
              <div className="detail-heading">
                <div className="customer-avatar">{selected.name.slice(0, 1)}</div>
                <div><div className="title-line"><h2>{selected.name}</h2><span className={`intent-badge intent-${selected.intent}`}>{selected.intent}意向</span></div><p>{selected.phone || '电话未登记'} · 负责人 {selected.salesperson}</p></div>
                {selected.phone && <a className="icon-button" href={`tel:${selected.phone.replace(/\*/g, '')}`} title="拨打电话" aria-label="拨打电话"><Phone size={19} /></a>}
              </div>

              <section className="handoff-card"><div><span>客户责任链</span><strong>{selected.sourceService ? `来源客服 ${selected.sourceService}` : '销售直接接待'}<b>→</b>{selected.handoffStatus === '待销售接收' ? `待 ${selected.pendingSalesperson} 接收` : `销售 ${selected.salesperson}`}</strong>{selected.handoffHistory?.[0] && <small>{selected.handoffHistory[0].summary}</small>}</div><div>{selected.handoffStatus === '待销售接收' && (activeMember.role === 'manager' || activeMember.id === selected.pendingSalespersonId || activeMember.name === selected.pendingSalesperson) ? <button className="primary-button" onClick={acceptHandoff}>接收客户</button> : (activeMember.role === 'manager' || activeMember.role === 'operations') && <button className="secondary-button" onClick={() => setHandoffOpen(true)}><ArrowRightLeft size={16}/>转交销售</button>}</div></section>

              <div className="stage-editor">
                <label htmlFor="customer-stage">当前阶段</label>
                <select id="customer-stage" disabled={!canWorkOnSelected} value={selected.stage} onChange={(event) => updateStage(event.target.value as CustomerStage)}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select>
                <span>{canWorkOnSelected ? '变更后自动保存' : '当前阶段由对应负责人推进'}</span>
              </div>

              <section className={`next-task ${isOverdue(selected.nextFollowUpAt) ? 'task-overdue' : ''}`}>
                <div className="section-icon"><CalendarClock size={19} /></div>
                <div><span>下一步任务</span><strong>{timeline[0]?.nextAction || '尚未安排具体行动'}</strong><small>{selected.nextFollowUpAt ? `${formatDate(selected.nextFollowUpAt)} · ${selected.salesperson}` : '新增跟进时可同步安排'}</small></div>
                {selected.nextFollowUpAt && <span className="task-status">{isOverdue(selected.nextFollowUpAt) ? '已逾期' : '待执行'}</span>}
              </section>

              <section className="customer-profile">
                <div className="section-title"><h3>客户画像</h3><span>{formatMoney(selected.expectedAmount)} 预计成交</span></div>
                <dl>
                  <div><dt>意向产品</dt><dd>{selected.products.join('、')}</dd></div>
                  <div><dt>偏好风格</dt><dd>{selected.style}</dd></div>
                  <div><dt>客户预算</dt><dd>{selected.budget}</dd></div>
                  <div><dt>装修进度</dt><dd>{selected.renovationProgress}</dd></div>
                  <div><dt>主要顾虑</dt><dd className="concern-list">{selected.concerns.map((item) => <span key={item}>{item}</span>)}</dd></div>
                  <div><dt>客户来源</dt><dd>{selected.source}</dd></div>
                </dl>
              </section>

              {selected.stage === '已成交' && <section className="deal-card">
                <div className="section-title"><h3><HandCoins size={17}/>成交与持续经营</h3>{canWorkOnSelected && <button className="text-button" onClick={() => setDealOpen(true)}>编辑成交</button>}</div>
                <div className="deal-summary">
                  <div><span>成交金额</span><strong>{formatMoney(selected.dealAmount ?? selected.expectedAmount)}</strong></div>
                  <div><span>已收款</span><strong>{formatMoney(selected.paidAmount ?? 0)}</strong></div>
                  <div><span>待收款</span><strong>{formatMoney(Math.max(0, (selected.dealAmount ?? selected.expectedAmount) - (selected.paidAmount ?? 0)))}</strong></div>
                  <div><span>持续营销</span><strong>{selected.marketingStatus ?? '待回访'}</strong></div>
                </div>
                <p>{selected.dealDate ? `${selected.dealDate} 成交` : '成交日期未登记'} · {selected.dealProducts?.length ? selected.dealProducts.join('、') : selected.products.join('、') || '产品未登记'}{selected.marketingNextAt ? ` · 下次触达 ${selected.marketingNextAt}` : ''}</p>
              </section>}

              <section className="timeline-section">
                <div className="section-title"><h3>跟进记录</h3>{canWorkOnSelected && <button className="text-button" onClick={() => setFormOpen(true)}><MessageSquarePlus size={16} />新增跟进</button>}</div>
                <div className="timeline">
                  {timeline.map((item) => <article className="timeline-item" key={item.id}>
                    <span className="timeline-marker"><CheckCircle2 size={16} /></span>
                    <div className="timeline-card">
                      <div className="timeline-meta"><strong>{item.channel}</strong><span>{formatDate(item.at)} · {item.salesperson}</span></div>
                      <p>{item.content}</p><div className="result-line"><span>结果</span>{item.result}</div>
                      {item.nextAction && <div className="action-line"><CalendarClock size={15} /><span><b>下一步：</b>{item.nextAction}{item.nextAt ? ` · ${formatDate(item.nextAt)}` : ''}</span></div>}
                    </div>
                  </article>)}
                  {!timeline.length && <div className="empty-state"><UserRound size={24} /><strong>还没有跟进记录</strong><span>记录第一次沟通，推进客户阶段</span></div>}
                </div>
              </section>
            </>
          ) : <div className="detail-placeholder"><UserRound size={34} /><strong>选择一位客户</strong><span>查看客户画像与跟进记录</span></div>}
        </main>
      </div>
      {formOpen && selected && <FollowUpDialog customer={selected} designers={designers} onClose={() => setFormOpen(false)} onSubmit={addFollowUp} onDealRequested={() => setDealOpen(true)} />}
      {handoffOpen && selected && <HandoffDialog customer={selected} salespeople={salespeople} onClose={() => setHandoffOpen(false)} onSubmit={createHandoff} />}
      {dealOpen && selected && <DealDialog customer={selected} deliveryStaff={deliveryStaff} onClose={() => setDealOpen(false)} onSubmit={saveDeal} />}
    </section>
  )
}

function DealDialog({ customer, deliveryStaff, onClose, onSubmit }: { customer: Customer; deliveryStaff: { id: string; name: string }[]; onClose: () => void; onSubmit: (input: Omit<DealRegistration, 'customer' | 'recordedBy'>) => void }) {
  const [dealAmount, setDealAmount] = useState(String(customer.dealAmount ?? (customer.expectedAmount || '')))
  const [paidAmount, setPaidAmount] = useState(String(customer.paidAmount ?? ''))
  const [dealDate, setDealDate] = useState(customer.dealDate ?? new Date().toISOString().slice(0, 10))
  const [deliveryDate, setDeliveryDate] = useState(customer.deliveryDate ?? '')
  const [deliveryOwnerId, setDeliveryOwnerId] = useState('')
  const [deliveryPlan, setDeliveryPlan] = useState<'within-month' | 'undecided'>(customer.deliveryDate ? 'within-month' : 'undecided')
  const [expectedDeliveryMonth, setExpectedDeliveryMonth] = useState('')
  const [marketingStatus, setMarketingStatus] = useState<Customer['marketingStatus']>(customer.marketingStatus ?? '待回访')
  const [marketingNextAt, setMarketingNextAt] = useState(customer.marketingNextAt ?? '')
  const [marketingNote, setMarketingNote] = useState(customer.marketingNote ?? '')
  const initialProducts = customer.dealProducts ?? customer.products
  const emptyItem = (index = 0): OrderItem => ({ id: `item-${Date.now()}-${index}`, productName: '', specification: '', quantity: 1, unitPrice: 0, supplyType: '定制生产' })
  const fromCatalog = (productName: string, index: number): OrderItem => { const product = productCatalog.find((entry) => entry.name === productName); return product ? { id: `item-${Date.now()}-${index}`, productId: product.id, sku: product.sku, productName: product.name, specification: product.specifications[0], quantity: 1, unitPrice: product.unitPrice, supplyType: product.supplyType, availableStock: product.availableStock } : emptyItem(index) }
  const [items, setItems] = useState<OrderItem[]>(initialProducts.length ? initialProducts.map(fromCatalog) : [emptyItem()])
  const updateItem = (id: string, changes: Partial<OrderItem>) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item))
  useEffect(() => { const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0); if (total > 0) setDealAmount(String(total)) }, [items])
  const chooseProduct = (itemId: string, productId: string) => { const product = productCatalog.find((entry) => entry.id === productId); if (product) updateItem(itemId, { productId: product.id, sku: product.sku, productName: product.name, specification: product.specifications[0], unitPrice: product.unitPrice, supplyType: product.supplyType, availableStock: product.availableStock }) }
  function submit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(dealAmount)
    const paid = Number(paidAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0) return
    const validItems = items.filter((item) => item.productName.trim() && item.quantity > 0)
    if (!validItems.length || paid > amount) return
    const deliveryOwner = deliveryStaff.find((item) => item.id === deliveryOwnerId)
    if (deliveryPlan === 'within-month' && (!deliveryDate || !deliveryOwner)) return
    if (deliveryPlan === 'undecided' && !expectedDeliveryMonth) return
    const reminder = expectedDeliveryMonth ? (() => { const [year, month] = expectedDeliveryMonth.split('-').map(Number); const date = new Date(Date.UTC(year, month - 1, 1)); date.setUTCDate(date.getUTCDate() - 10); return date.toISOString().slice(0, 10) })() : undefined
    onSubmit({ contractAmount: amount, deposit: paid, signedAt: dealDate, expectedDeliveryAt: deliveryPlan === 'within-month' ? deliveryDate : undefined, expectedDeliveryMonth: deliveryPlan === 'undecided' ? expectedDeliveryMonth : deliveryDate.slice(0, 7), deliveryReminderAt: deliveryPlan === 'undecided' ? reminder : undefined, deliveryOwnerId: deliveryOwner?.id, deliveryOwner: deliveryOwner?.name, items: validItems.map((item) => ({ ...item, productName: item.productName.trim(), specification: item.specification?.trim() || undefined })), marketingStatus, marketingNextAt: marketingNextAt || undefined, marketingNote: marketingNote.trim() || undefined })
  }
  return <div className="dialog-backdrop" role="presentation"><section className="followup-dialog deal-dialog" role="dialog" aria-modal="true" aria-labelledby="deal-title"><header><div><p>成交自动转订单</p><h2 id="deal-title">登记成交 · {customer.name}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭成交登记"><X size={18}/></button></header><form onSubmit={submit}>
    <label>成交金额（元）*<input required min="1" type="number" value={dealAmount} onChange={(event) => setDealAmount(event.target.value)}/></label>
    <label>已收款（元）<input min="0" type="number" value={paidAmount} onChange={(event) => setPaidAmount(event.target.value)}/></label>
    <label>成交日期 *<input required type="date" value={dealDate} onChange={(event) => setDealDate(event.target.value)}/></label>
    <div className="form-divider deal-wide"><span>产品与备货方式</span></div>
    <div className="deal-items deal-wide">{items.map((item, index) => { const product = productCatalog.find((entry) => entry.id === item.productId); return <div className="deal-item" key={item.id}><select aria-label={`产品名称 ${index + 1}`} required value={item.productId ?? ''} onChange={(event) => chooseProduct(item.id, event.target.value)}><option value="">选择产品</option>{productCatalog.map((entry) => <option key={entry.id} value={entry.id}>{entry.name} · {entry.sku}</option>)}</select><select aria-label={`规格 ${index + 1}`} required value={item.specification ?? ''} onChange={(event) => updateItem(item.id, { specification: event.target.value })}><option value="">选择规格</option>{product?.specifications.map((specification) => <option key={specification}>{specification}</option>)}</select><input aria-label={`数量 ${index + 1}`} required min="1" type="number" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })}/><div className="product-snapshot"><strong>{formatMoney(item.unitPrice)}</strong><span>{item.supplyType}{item.supplyType === '现货' || item.supplyType === '展厅样品' ? ` · 可用 ${item.availableStock ?? 0}` : ''}</span></div>{items.length > 1 && <button type="button" className="icon-button" aria-label={`删除产品 ${index + 1}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 size={16}/></button>}</div> })}</div>
    <button type="button" className="secondary-button add-deal-item deal-wide" onClick={() => setItems((current) => [...current, emptyItem(current.length)])}>新增产品</button>
    <div className="form-divider deal-wide"><span>交付安排</span></div>
    <label className="deal-wide">送货安排方式<select aria-label="送货安排方式" value={deliveryPlan} onChange={(event) => { const plan = event.target.value as 'within-month' | 'undecided'; setDeliveryPlan(plan); if (plan === 'undecided') { setDeliveryOwnerId(''); setDeliveryDate('') } }}><option value="within-month">客户要求一个月内送货</option><option value="undecided">暂不确定送货，设置提醒</option></select></label>
    {deliveryPlan === 'within-month' ? <><label>预计交付日期 *<input required min={dealDate} max={new Date(new Date(dealDate).getTime() + 30 * 86400000).toISOString().slice(0, 10)} type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)}/></label><label>@ 售后 / 送货负责人 *<select required value={deliveryOwnerId} onChange={(event) => setDeliveryOwnerId(event.target.value)}><option value="">请选择负责人</option>{deliveryStaff.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></> : <label className="deal-wide">预计送货月份 *<input required min={dealDate.slice(0, 7)} type="month" value={expectedDeliveryMonth} onChange={(event) => setExpectedDeliveryMonth(event.target.value)}/><small className="field-hint">系统在预计月份前 10 天提醒销售确认日期和指派人员，售后可提前查看月度订单量。</small></label>}
    <div className="form-divider deal-wide"><span>成交后持续经营</span></div>
    <label>客户经营状态<select value={marketingStatus} onChange={(event) => setMarketingStatus(event.target.value as Customer['marketingStatus'])}><option>待回访</option><option>可加购</option><option>可转介绍</option><option>长期维护</option><option>暂不营销</option></select></label>
    <label>下次触达日期<input type="date" value={marketingNextAt} onChange={(event) => setMarketingNextAt(event.target.value)}/></label>
    <label className="deal-wide">后续机会说明<textarea rows={2} value={marketingNote} onChange={(event) => setMarketingNote(event.target.value)} placeholder="例如：交付后邀请转介绍，后续可补购餐桌"/></label>
    <p className="dialog-note deal-wide">保存后自动生成销售订单、定金记录，以及库存锁定、样品锁定、采购或生产需求。</p>
    <footer><button type="button" className="secondary-button" onClick={onClose}>取消</button><button type="submit" className="primary-button">确认成交并生成订单</button></footer>
  </form></section></div>
}

function HandoffDialog({ customer, salespeople, onClose, onSubmit }: { customer: Customer; salespeople: { id: string; name: string }[]; onClose: () => void; onSubmit: (salespersonId: string, summary: string, appointmentAt?: string) => void }) {
  const [salespersonId, setSalespersonId] = useState('')
  const [summary, setSummary] = useState('')
  const [appointmentAt, setAppointmentAt] = useState('')
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="followup-dialog handoff-dialog" role="dialog" aria-modal="true" aria-labelledby="handoff-title"><header><div><p>客服转交销售</p><h2 id="handoff-title">客户交接 · {customer.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20}/></button></header><form onSubmit={(event) => { event.preventDefault(); onSubmit(salespersonId, summary.trim(), appointmentAt || undefined) }}><label>接收销售 *<select required value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)}><option value="">请选择销售</option>{salespeople.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>邀约到店时间<input type="datetime-local" value={appointmentAt} onChange={(event) => setAppointmentAt(event.target.value)}/></label><label>交接摘要 *<textarea required rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="填写客户需求、预算、意向产品、已沟通重点和下一步建议"/></label><footer><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">确认转交</button></footer></form></section></div>
}

type DesignTaskDraft = Omit<DesignTask, 'id' | 'customerId' | 'customerName' | 'salesperson' | 'status' | 'solutionFiles' | 'createdAt' | 'updatedAt'>

function FollowUpDialog({ customer, designers, onClose, onSubmit, onDealRequested }: { customer: Customer; designers: { id: string; name: string }[]; onClose: () => void; onSubmit: (data: Omit<FollowUp, 'id' | 'customerId' | 'salesperson'>, design?: DesignTaskDraft) => void; onDealRequested?: () => void }) {
  const [channel, setChannel] = useState<Channel>('微信')
  const [at, setAt] = useState(toLocalInput())
  const [content, setContent] = useState('')
  const [result, setResult] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextAt, setNextAt] = useState('')
  const [needsDesign, setNeedsDesign] = useState(false)
  const [designerId, setDesignerId] = useState('')
  const [designType, setDesignType] = useState<DesignTaskType>('效果图')
  const [requirement, setRequirement] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [designPriority, setDesignPriority] = useState<'普通' | '紧急'>('普通')
  const [referenceFiles, setReferenceFiles] = useState<CustomerFile[]>([])
  const [dealConfirmed, setDealConfirmed] = useState(false)
  const referenceInput = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const designer = designers.find((item) => item.id === designerId)
    onSubmit({ channel, at: new Date(at).toISOString(), content: content.trim(), result: result.trim(), nextAction: nextAction.trim() || undefined, nextAt: nextAt ? new Date(nextAt).toISOString() : undefined }, needsDesign && designer ? { designerId, designerName: designer.name, type: designType, requirement: requirement.trim(), dueAt: new Date(dueAt).toISOString(), priority: designPriority, referenceFiles } : undefined)
    if (dealConfirmed) window.setTimeout(() => onDealRequested?.(), 0)
  }

  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="followup-dialog" role="dialog" aria-modal="true" aria-labelledby="followup-title">
      <header><div><p>记录客户沟通</p><h2 id="followup-title">新增跟进 · {customer.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button></header>
      <form onSubmit={submit}>
        <fieldset><legend>沟通方式</legend><div className="channel-options">{(['微信', '电话', '到店', '量尺'] as Channel[]).map((item) => <label key={item}><input type="radio" name="channel" checked={channel === item} onChange={() => setChannel(item)} /><span>{item}</span></label>)}</div></fieldset>
        <label>跟进时间<input type="datetime-local" required value={at} onChange={(event) => setAt(event.target.value)} /></label>
        <label>沟通内容<textarea required rows={3} value={content} onChange={(event) => setContent(event.target.value)} placeholder="客户关注了什么、表达了哪些需求？" /></label>
        <label>本次结果<input required value={result} onChange={(event) => setResult(event.target.value)} placeholder="例如：已发送材质方案" /></label>
        <div className="design-assist-toggle"><label><input type="checkbox" checked={dealConfirmed} onChange={(event) => { setDealConfirmed(event.target.checked); if (event.target.checked) { setNextAction(''); setNextAt('') } }} /><span>客户本次已确认成交</span></label><small>保存跟进后继续登记产品、金额和备货方式</small></div>
        <div className="form-divider"><span>下一步任务</span></div>
        <label>行动内容<input value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="例如：邀请客户到店看样" /></label>
        <label>计划时间<input type="datetime-local" value={nextAt} onChange={(event) => setNextAt(event.target.value)} /></label>
        <div className="design-assist-toggle"><label><input type="checkbox" checked={needsDesign} onChange={(event) => setNeedsDesign(event.target.checked)} /><span>需要设计师协助</span></label><small>保存后自动 @设计师，并在任务中心生成待办</small></div>
        {needsDesign && <section className="design-assist-fields"><div className="design-grid"><label>指派设计师 *<select required value={designerId} onChange={(event) => setDesignerId(event.target.value)}><option value="">请选择设计师</option>{designers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>任务类型 *<select required value={designType} onChange={(event) => setDesignType(event.target.value as DesignTaskType)}>{(['平面布局', '家具搭配', '效果图', '报价方案', '方案修改', '其他'] as DesignTaskType[]).map((item) => <option key={item}>{item}</option>)}</select></label><label>计划完成时间 *<input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label><label>紧急程度<select value={designPriority} onChange={(event) => setDesignPriority(event.target.value as '普通' | '紧急')}><option>普通</option><option>紧急</option></select></label></div><label>设计任务要求 *<textarea required rows={2} value={requirement} onChange={(event) => setRequirement(event.target.value)} placeholder="说明客户需求、空间范围和设计重点" /></label><div className="reference-upload"><input ref={referenceInput} className="visually-hidden" type="file" multiple accept="image/*,.pdf,.dwg,.dxf,.cad,.zip" onChange={(event) => { const files = Array.from(event.target.files ?? []).map((file) => ({ id: `ref-${Date.now()}-${file.name}`, name: file.name, type: file.type || '文件', size: file.size })); setReferenceFiles((current) => [...current, ...files]) }} /><button type="button" onClick={() => referenceInput.current?.click()}><FileUp size={16} />添加参考资料</button><span>户型图、现场照片、PDF、CAD</span>{referenceFiles.map((file) => <div key={file.id}><span>{file.name}</span><button type="button" aria-label={`删除 ${file.name}`} onClick={() => setReferenceFiles((current) => current.filter((item) => item.id !== file.id))}><Trash2 size={14} /></button></div>)}</div></section>}
        <footer><button type="button" className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" type="submit">保存跟进</button></footer>
      </form>
    </section>
  </div>
}

export default CustomersPage
