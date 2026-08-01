import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, CircleDollarSign, ClipboardPlus, PackageCheck, Truck, Wrench, X } from 'lucide-react'
import type { AfterSalesTicket, Customer, DeliveryTask, PaymentRecord, SalesOrder } from '../../types'
import './lifecycle.css'

type Tab = '订单与业绩' | '交付安装' | '售后服务'

interface Props {
  customers: Customer[]
  orders: SalesOrder[]
  deliveryTasks: DeliveryTask[]
  afterSalesTickets: AfterSalesTicket[]
  activeUser: string
  onAddOrder: (item: SalesOrder) => void
  onUpdateOrder: (id: string, changes: Partial<SalesOrder>) => void
  onAddPayment: (orderId: string, item: PaymentRecord) => void
  onAddDelivery: (item: DeliveryTask) => void
  onUpdateDelivery: (id: string, changes: Partial<DeliveryTask>) => void
  onAddTicket: (item: AfterSalesTicket) => void
  onUpdateTicket: (id: string, changes: Partial<AfterSalesTicket>) => void
}

const money = (value: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value)
const paid = (order: SalesOrder) => order.payments.reduce((sum, item) => sum + (item.type === '退款' ? -item.amount : item.amount), 0)
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export function LifecyclePage(props: Props) {
  const [tab, setTab] = useState<Tab>('订单与业绩')
  const [dialog, setDialog] = useState<'order' | 'payment' | 'delivery' | 'ticket' | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState(props.orders[0]?.id ?? '')
  const selectedOrder = props.orders.find((item) => item.id === selectedOrderId) ?? props.orders[0]
  const totals = useMemo(() => ({
    contracts: props.orders.reduce((sum, item) => sum + item.contractAmount, 0),
    received: props.orders.reduce((sum, item) => sum + paid(item), 0),
    pendingDelivery: props.deliveryTasks.filter((item) => item.status !== '已完成').length,
    openTickets: props.afterSalesTickets.filter((item) => item.status !== '已完成').length,
  }), [props.afterSalesTickets, props.deliveryTasks, props.orders])

  return <main className="lifecycle-page">
    <header className="lifecycle-header"><div><p>成交履约</p><h1>订单、交付与售后</h1><span>从成交收款到送货验收、售后回访，全程关联同一位客户。</span></div><button className="primary-button" onClick={() => setDialog('order')}><ClipboardPlus size={17}/>成交转订单</button></header>
    <section className="lifecycle-metrics" aria-label="成交履约指标">
      <article><CircleDollarSign/><div><span>合同金额</span><strong>{money(totals.contracts)}</strong><small>{props.orders.length} 笔订单</small></div></article>
      <article><CheckCircle2/><div><span>已回款</span><strong>{money(totals.received)}</strong><small>待收 {money(Math.max(0, totals.contracts - totals.received))}</small></div></article>
      <article><Truck/><div><span>待交付安装</span><strong>{totals.pendingDelivery}</strong><small>按排期推进</small></div></article>
      <article><Wrench/><div><span>待处理售后</span><strong>{totals.openTickets}</strong><small>超期需店长介入</small></div></article>
    </section>
    <div className="lifecycle-tabs" role="tablist">{(['订单与业绩', '交付安装', '售后服务'] as Tab[]).map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
    {tab === '订单与业绩' && <section className="lifecycle-panel"><div className="panel-title"><div><h2>成交订单</h2><span>业绩按实际回款统计，退款自动冲减。</span></div>{selectedOrder && <button onClick={() => setDialog('payment')}>登记收款</button>}</div>
      <div className="order-table"><div className="table-row table-head"><span>订单 / 客户</span><span>负责人</span><span>合同金额</span><span>已回款</span><span>业绩金额</span><span>状态</span></div>{props.orders.map((order) => <button className={`table-row ${selectedOrder?.id === order.id ? 'selected' : ''}`} key={order.id} onClick={() => setSelectedOrderId(order.id)}><span><b>{order.orderNo}</b><small>{order.customerName} · {order.products.join('、')}</small></span><span>{order.salesperson}</span><span>{money(order.contractAmount)}</span><span>{money(paid(order))}</span><span>{money(paid(order) * order.performanceRate / 100)}</span><span><i>{order.status}</i></span></button>)}</div>
      {!props.orders.length && <Empty icon={<PackageCheck/>} title="还没有成交订单" detail="客户确认成交后，从这里生成订单并登记定金。"/>}
      {selectedOrder && <div className="order-detail"><div><span>回款进度</span><strong>{Math.min(100, Math.round(paid(selectedOrder) / selectedOrder.contractAmount * 100))}%</strong><progress max="100" value={paid(selectedOrder) / selectedOrder.contractAmount * 100}/></div><div><span>业绩归属</span><strong>{selectedOrder.salesperson}</strong><small>计入比例 {selectedOrder.performanceRate}%</small></div><div><span>预计交付</span><strong>{selectedOrder.expectedDeliveryAt || '待排期'}</strong><small>{selectedOrder.collaborators.length ? `协作：${selectedOrder.collaborators.join('、')}` : '暂无协作人员'}</small></div></div>}
    </section>}
    {tab === '交付安装' && <section className="lifecycle-panel"><div className="panel-title"><div><h2>送货安装排期</h2><span>订单、地址、负责人和验收结果统一留档。</span></div>{selectedOrder && <button onClick={() => setDialog('delivery')}>新增交付任务</button>}</div><div className="delivery-grid">{props.deliveryTasks.map((task) => <article key={task.id}><header><span>{task.status}</span><b>{task.customerName}</b></header><p>{task.address || '地址待补充'}</p><dl><div><dt>计划时间</dt><dd>{task.scheduledAt?.replace('T', ' ') || '待排期'}</dd></div><div><dt>负责人</dt><dd>{task.owner}</dd></div><div><dt>安装人员</dt><dd>{task.installer || '待安排'}</dd></div></dl>{task.status !== '已完成' && <button onClick={() => props.onUpdateDelivery(task.id, { status: task.status === '待排期' ? '已排期' : task.status === '已排期' ? '配送中' : task.status === '配送中' ? '安装中' : task.status === '安装中' ? '待验收' : '已完成', ...(task.status === '待验收' ? { completedAt: new Date().toISOString() } : {}) })}>推进下一节点</button>}</article>)}</div>{!props.deliveryTasks.length && <Empty icon={<Truck/>} title="暂无交付任务" detail="选择成交订单后建立送货与安装排期。"/>}</section>}
    {tab === '售后服务' && <section className="lifecycle-panel"><div className="panel-title"><div><h2>售后工单</h2><span>每个问题都有责任人、期限、处理结果和客户确认。</span></div>{selectedOrder && <button onClick={() => setDialog('ticket')}>新建售后工单</button>}</div><div className="ticket-list">{props.afterSalesTickets.map((ticket) => <article key={ticket.id}><span className={ticket.priority === '紧急' ? 'urgent' : ''}>{ticket.priority}</span><div><h3>{ticket.customerName} · {ticket.category}</h3><p>{ticket.description}</p><small>负责人 {ticket.owner} · {ticket.dueAt ? `要求 ${ticket.dueAt} 前完成` : '未设置期限'}</small></div><strong>{ticket.status}</strong>{ticket.status !== '已完成' && <button onClick={() => props.onUpdateTicket(ticket.id, { status: ticket.status === '待受理' ? '处理中' : ticket.status === '处理中' ? '待客户确认' : '已完成' })}>推进</button>}</article>)}</div>{!props.afterSalesTickets.length && <Empty icon={<Wrench/>} title="暂无售后工单" detail="交付后的补件、维修、安装调整都从这里登记。"/>}</section>}
    {dialog === 'order' && <OrderDialog customers={props.customers} activeUser={props.activeUser} onClose={() => setDialog(null)} onSubmit={(order) => { props.onAddOrder(order); setSelectedOrderId(order.id); setDialog(null) }}/>} 
    {dialog === 'payment' && selectedOrder && <PaymentDialog order={selectedOrder} activeUser={props.activeUser} onClose={() => setDialog(null)} onSubmit={(payment) => { props.onAddPayment(selectedOrder.id, payment); setDialog(null) }}/>} 
    {dialog === 'delivery' && selectedOrder && <DeliveryDialog order={selectedOrder} activeUser={props.activeUser} customer={props.customers.find((item) => item.id === selectedOrder.customerId)} onClose={() => setDialog(null)} onSubmit={(task) => { props.onAddDelivery(task); setDialog(null) }}/>} 
    {dialog === 'ticket' && selectedOrder && <TicketDialog order={selectedOrder} activeUser={props.activeUser} onClose={() => setDialog(null)} onSubmit={(ticket) => { props.onAddTicket(ticket); setDialog(null) }}/>} 
  </main>
}

function Empty({ icon, title, detail }: { icon: React.ReactNode; title: string; detail: string }) { return <div className="lifecycle-empty">{icon}<strong>{title}</strong><span>{detail}</span></div> }

function DialogShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="lifecycle-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="lifecycle-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label="关闭" onClick={onClose}><X/></button></header>{children}</section></div> }

function OrderDialog({ customers, activeUser, onClose, onSubmit }: { customers: Customer[]; activeUser: string; onClose: () => void; onSubmit: (item: SalesOrder) => void }) {
  const candidates = customers.filter((item) => !['已流失'].includes(item.stage)); const [customerId, setCustomerId] = useState(candidates[0]?.id ?? ''); const customer = customers.find((item) => item.id === customerId); const [amount, setAmount] = useState(customer?.dealAmount || customer?.expectedAmount || 0); const [delivery, setDelivery] = useState('')
  return <DialogShell title="成交转订单" onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); if (!customer) return; const now = new Date().toISOString(); onSubmit({ id: id('order'), orderNo: `SPJ${Date.now().toString().slice(-8)}`, customerId, customerName: customer.name, salesperson: customer.salesperson || activeUser, salespersonId: customer.salespersonId, collaborators: customer.designer ? [customer.designer] : [], products: customer.products, contractAmount: amount, signedAt: now.slice(0, 10), expectedDeliveryAt: delivery || undefined, status: '已签约', payments: [], performanceRate: 100, createdAt: now, updatedAt: now }) }}><label>成交客户<select value={customerId} onChange={(e) => { setCustomerId(e.target.value); const next = customers.find((item) => item.id === e.target.value); setAmount(next?.dealAmount || next?.expectedAmount || 0) }}>{candidates.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.stage}</option>)}</select></label><label>合同金额<input aria-label="合同金额" required min="1" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}/></label><label>预计交付日期<input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)}/></label><p className="dialog-note">生成后客户阶段自动更新为“已定金”，业绩按实际回款计算。</p><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">生成订单</button></footer></form></DialogShell>
}

function PaymentDialog({ order, activeUser, onClose, onSubmit }: { order: SalesOrder; activeUser: string; onClose: () => void; onSubmit: (item: PaymentRecord) => void }) { const [amount, setAmount] = useState(Math.max(0, order.contractAmount - paid(order))); const [type, setType] = useState<PaymentRecord['type']>('定金'); return <DialogShell title={`登记收款 · ${order.customerName}`} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSubmit({ id: id('payment'), orderId: order.id, type, amount, paidAt: new Date().toISOString(), method: '微信', recordedBy: activeUser }) }}><label>款项类型<select value={type} onChange={(e) => setType(e.target.value as PaymentRecord['type'])}><option>定金</option><option>进度款</option><option>尾款</option><option>退款</option></select></label><label>金额<input aria-label="收款金额" required min="1" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))}/></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">确认登记</button></footer></form></DialogShell> }

function DeliveryDialog({ order, customer, activeUser, onClose, onSubmit }: { order: SalesOrder; customer?: Customer; activeUser: string; onClose: () => void; onSubmit: (item: DeliveryTask) => void }) { const [address, setAddress] = useState(customer?.cityArea || ''); const [scheduledAt, setScheduledAt] = useState(''); return <DialogShell title={`新增交付任务 · ${order.customerName}`} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); const now = new Date().toISOString(); onSubmit({ id: id('delivery'), orderId: order.id, customerId: order.customerId, customerName: order.customerName, address, contactPhone: customer?.phone || '', scheduledAt: scheduledAt || undefined, status: scheduledAt ? '已排期' : '待排期', owner: activeUser, createdAt: now, updatedAt: now }) }}><label>送货地址<input required value={address} onChange={(e) => setAddress(e.target.value)}/></label><label>计划送货安装时间<input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}/></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">创建任务</button></footer></form></DialogShell> }

function TicketDialog({ order, activeUser, onClose, onSubmit }: { order: SalesOrder; activeUser: string; onClose: () => void; onSubmit: (item: AfterSalesTicket) => void }) { const [description, setDescription] = useState(''); const [category, setCategory] = useState<AfterSalesTicket['category']>('安装调整'); return <DialogShell title={`新建售后工单 · ${order.customerName}`} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); const now = new Date().toISOString(); onSubmit({ id: id('ticket'), orderId: order.id, customerId: order.customerId, customerName: order.customerName, category, description, priority: '普通', status: '待受理', owner: activeUser, createdAt: now, updatedAt: now }) }}><label>问题类型<select value={category} onChange={(e) => setCategory(e.target.value as AfterSalesTicket['category'])}><option>补件</option><option>维修</option><option>安装调整</option><option>质量问题</option><option>使用咨询</option><option>其他</option></select></label><label>问题说明<textarea aria-label="问题说明" required rows={4} value={description} onChange={(e) => setDescription(e.target.value)}/></label><footer><button type="button" onClick={onClose}>取消</button><button className="primary-button">创建工单</button></footer></form></DialogShell> }

