import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, FileUp, PackagePlus, Search, ShoppingCart, Trash2 } from 'lucide-react'
import type { Customer, CustomerFile, OrderItem, PaymentRecord, ProductCatalogItem, SalesOrder } from '../../types'
import './orders.css'
import './orders-layout.css'

type Props = {
  customers: Customer[]
  products: ProductCatalogItem[]
  orders: SalesOrder[]
  activeUser: string
  onAddOrder: (order: SalesOrder) => void
  onUpdateOrder: (id: string, changes: Partial<SalesOrder>) => void
  onActivate: (id: string, operator: string) => { ok: boolean; error?: string }
  onAddPayment?: (orderId: string, payment: PaymentRecord) => void
}

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const paid = (order: SalesOrder) => order.payments.reduce((sum, item) => sum + (item.type === '退款' ? -item.amount : item.amount), 0)
const routeCustomerId = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] ?? '').get('customer') ?? ''

export function OrderWorkspacePage({ customers, products, orders, activeUser, onAddOrder, onUpdateOrder, onActivate, onAddPayment }: Props) {
  const routeCustomer = routeCustomerId()
  const [customerId, setCustomerId] = useState(customers.some((item) => item.id === routeCustomer) ? routeCustomer : customers[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<OrderItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [deliveryMonth, setDeliveryMonth] = useState('')
  const [address, setAddress] = useState('')
  const [depositRate, setDepositRate] = useState(20)
  const [note, setNote] = useState('')
  const [quotationFiles, setQuotationFiles] = useState<CustomerFile[]>([])
  const [paymentOrderId, setPaymentOrderId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [notice, setNotice] = useState('')
  const quoteInput = useRef<HTMLInputElement>(null)
  const customer = customers.find((item) => item.id === customerId)
  const filtered = products.filter((item) => `${item.name}${item.sku}${item.category ?? ''}${item.woodMaterial ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const total = Math.max(0, subtotal - discount)
  const requiredDeposit = Math.round(total * depositRate / 100 * 100) / 100
  const selectedPaymentOrder = orders.find((item) => item.id === paymentOrderId)

  const updateItem = (id: string, changes: Partial<OrderItem>) => setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...changes } : row))
  const add = (product: ProductCatalogItem) => setItems((current) => {
    const found = current.find((item) => item.productId === product.id)
    if (found) return current.map((item) => item === found ? { ...item, quantity: item.quantity + 1 } : item)
    return [...current, { id: `item-${Date.now()}-${product.id}`, productId: product.id, sku: product.sku, productName: product.name, specification: product.specifications[0], quantity: 1, unitPrice: product.unitPrice, supplyType: product.supplyType, availableStock: Math.max(0, product.availableStock - (product.reservedStock ?? 0)), material: product.woodMaterial, color: product.color, dimensions: product.dimensions, attachments: [] }]
  })

  const changeCustomer = (id: string) => {
    setCustomerId(id)
    const next = customers.find((item) => item.id === id)
    setAddress(next?.cityArea ?? '')
  }

  const saveDraft = () => {
    if (!customer || !items.length) { setNotice('请选择客户并至少加入一件商品'); return }
    if (discount > 0 && !discountReason.trim()) { setNotice('有优惠时请填写优惠原因，便于店长审核'); return }
    const now = new Date().toISOString()
    onAddOrder({ id: `order-${Date.now()}`, orderNo: `SPJ${String(Date.now()).slice(-8)}`, customerId: customer.id, customerName: customer.name, salesperson: customer.salesperson || activeUser, salespersonId: customer.salespersonId, collaborators: customer.designer ? [customer.designer] : [], products: items.map((item) => item.productName), items, contractAmount: total, signedAt: now.slice(0, 10), expectedDeliveryMonth: deliveryMonth || undefined, contactPhone: customer.phone, deliveryAddress: address || customer.cityArea, quotationFiles, requiredDeposit, discountAmount: discount, discountReason: discountReason || undefined, note: note || undefined, status: '草稿', payments: [], performanceRate: 100, createdAt: now, updatedAt: now })
    setItems([]); setDiscount(0); setDiscountReason(''); setQuotationFiles([]); setNote('')
    setNotice('订单草稿已保存，尚未占用库存')
  }

  const recordDeposit = () => {
    if (!selectedPaymentOrder || paymentAmount <= 0 || !onAddPayment) return
    onAddPayment(selectedPaymentOrder.id, { id: `payment-${Date.now()}`, orderId: selectedPaymentOrder.id, type: '定金', amount: paymentAmount, paidAt: new Date().toISOString(), method: '微信', recordedBy: activeUser, status: '已确认' })
    setPaymentOrderId(''); setPaymentAmount(0); setNotice('定金已登记，可以提交店长审核')
  }

  return <main className="order-workspace">
    <header><div><p>唯一开单入口</p><h1>现场选品与正式订单</h1><span>从客户跟进带入资料；客户确认和定金达标后，店长审核生效并自动生成库存、采购或工厂需求。</span></div></header>
    {notice && <div className="order-notice" role="status">{notice}</div>}
    <section className="order-steps" aria-label="订单流程"><b>1 选客户商品</b><span>2 保存报价草稿</span><span>3 客户确认</span><span>4 登记定金</span><span>5 审核备货</span></section>
    <section className="order-entry-panel" aria-label="开单信息">
      <div className="selection-bar">
        <label><span>当前客户</span><select value={customerId} onChange={(e) => changeCustomer(e.target.value)}>{customers.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.phone || '电话未登记'}</option>)}</select></label>
        <label className="product-search"><span>搜索商品</span><div><Search/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入商品名、SKU、品类或木材"/></div></label>
      </div>
      <div className="order-customer-summary"><span><small>客户</small><b>{customer?.name ?? '未选择'}</b></span><span><small>负责人</small><b>{customer?.salesperson ?? '-'}</b></span><label>收货地址<input value={address || customer?.cityArea || ''} onChange={(e) => setAddress(e.target.value)} placeholder="填写详细收货地址"/></label><label>预计送货月份<input type="month" value={deliveryMonth} onChange={(e) => setDeliveryMonth(e.target.value)}/></label></div>
    </section>
    <div className="selection-layout"><section className="product-browser"><header><h2>商品库</h2><span>{filtered.length} 个商品</span></header><div>{filtered.map((product) => <article key={product.id}><div><strong>{product.name}</strong><small>{product.sku} · {product.woodMaterial || product.category || '资料待完善'}</small><small>{product.dimensions || product.specifications.join(' / ')}</small></div><span><b>{money(product.unitPrice)}</b><small>{product.supplyType} · 可用 {Math.max(0, product.availableStock - (product.reservedStock ?? 0))}</small></span><button onClick={() => add(product)} title="加入选品"><PackagePlus/></button></article>)}</div></section>
      <aside className="selection-cart"><header><ShoppingCart/><div><h2>本次选品</h2><span>{customer?.name || '未选择客户'} · {items.length} 项</span></div></header>{items.map((item) => <article className="order-line" key={item.id}><div className="order-line-main"><strong>{item.productName}</strong><select aria-label={`${item.productName}规格`} value={item.specification} onChange={(e) => updateItem(item.id, { specification: e.target.value, dimensions: e.target.value })}>{products.find((p) => p.id === item.productId)?.specifications.map((spec) => <option key={spec}>{spec}</option>)}</select><div className="order-line-details"><input aria-label={`${item.productName}材质`} value={item.material ?? ''} onChange={(e) => updateItem(item.id, { material: e.target.value })} placeholder="材质"/><input aria-label={`${item.productName}颜色`} value={item.color ?? ''} onChange={(e) => updateItem(item.id, { color: e.target.value })} placeholder="颜色"/><input aria-label={`${item.productName}定制要求`} value={item.customRequirement ?? ''} onChange={(e) => updateItem(item.id, { customRequirement: e.target.value })} placeholder="定制/工艺要求"/></div></div><input aria-label={`${item.productName}数量`} type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}/><b>{money(item.unitPrice * item.quantity)}</b><button aria-label={`删除${item.productName}`} onClick={() => setItems((rows) => rows.filter((row) => row.id !== item.id))}><Trash2/></button></article>)}{!items.length && <div className="cart-empty">从左侧选择客户需要的商品</div>}
        <div className="cart-totals"><label>整单优惠<input type="number" min="0" max={subtotal} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}/></label>{discount > 0 && <label>优惠原因<input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="店长审核依据"/></label>}<label>定金比例<input type="number" min="0" max="100" value={depositRate} onChange={(e) => setDepositRate(Number(e.target.value))}/></label><label>订单备注<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="楼层、入户、安装等要求"/></label><div className="order-file-row"><input ref={quoteInput} className="visually-hidden" type="file" multiple accept="image/*,.pdf,.doc,.docx,.dwg,.dxf,.cad" onChange={(e) => { const files = Array.from(e.target.files ?? []).map((file) => ({ id: `quote-${Date.now()}-${file.name}`, name: file.name, type: file.type || '文件', size: file.size })); setQuotationFiles((current) => [...current, ...files]); e.target.value = '' }}/><button type="button" onClick={() => quoteInput.current?.click()}><FileUp size={15}/>报价/图纸</button><span>{quotationFiles.length ? `已选 ${quotationFiles.length} 个文件` : '可上传客户确认资料'}</span></div><span>商品合计<b>{money(subtotal)}</b></span><span>应收定金<b>{money(requiredDeposit)}</b></span><strong>订单金额<b>{money(total)}</b></strong><button className="save-order" onClick={saveDraft}>保存订单草稿</button></div></aside></div>
    <section className="order-pipeline"><header><h2>订单处理</h2><span>每张订单只沿这一条链路推进</span></header>{orders.map((order) => { const received = paid(order); const depositEnough = received >= (order.requiredDeposit ?? 0); return <article key={order.id}><span><b>{order.orderNo} · {order.customerName}</b><small>{order.products.join('、')} · {money(order.contractAmount)} · 已收 {money(received)}</small></span><i>{order.status}</i><div>{order.status === '草稿' && <button onClick={() => onUpdateOrder(order.id, { status: '待客户确认' })}>生成报价并提交确认</button>}{order.status === '待客户确认' && <button onClick={() => onUpdateOrder(order.id, { status: '待审核', customerConfirmedAt: new Date().toISOString(), customerConfirmationNote: '客户现场/线上确认' })}>客户已确认</button>}{order.status === '待审核' && !depositEnough && onAddPayment && <button onClick={() => { setPaymentOrderId(order.id); setPaymentAmount(Math.max(0, (order.requiredDeposit ?? 0) - received)) }}>登记定金</button>}{order.status === '待审核' && depositEnough && <button onClick={() => { const result = onActivate(order.id, activeUser); setNotice(result.ok ? '订单已生效，已自动生成库存、采购或工厂需求' : result.error ?? '操作失败') }}><CheckCircle2/>审核并生效</button>}</div></article> })}</section>
    {selectedPaymentOrder && <div className="order-payment-backdrop"><section role="dialog" aria-label={`登记定金 · ${selectedPaymentOrder.customerName}`}><h2>登记定金 · {selectedPaymentOrder.customerName}</h2><p>应收定金 {money(selectedPaymentOrder.requiredDeposit ?? 0)}，已收 {money(paid(selectedPaymentOrder))}</p><label>本次收款<input aria-label="本次定金" type="number" min="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))}/></label><footer><button onClick={() => setPaymentOrderId('')}>取消</button><button onClick={recordDeposit}>确认登记</button></footer></section></div>}
  </main>
}
