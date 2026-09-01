import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, ChevronRight, FileUp, PackagePlus, Plus, Printer, Search, ShoppingCart, Trash2, UserPlus } from 'lucide-react'
import type { ConfigProduct, Customer, CustomerFile, OrderItem, PaymentRecord, ProductCatalogItem, ProductCategory, ProductComponent, ProductPackage, ProductSeries, SalesOrder, SkuUnit } from '../../types'
import { availableCount, configProductAvailability, configProductPriceRange, packageAvailability, packagePriceRange } from '../../utils/product-config'
import { formatPriceRange } from '../product-master/pm-utils'
import { ConfigProductPicker } from './ConfigProductPicker'
import { PackagePicker } from './PackagePicker'
import { OrderPreviewModal } from './OrderPreviewModal'
import { QuickCustomerModal } from './QuickCustomerModal'
import { QuickProductModal } from './QuickProductModal'
import './orders.css'
import './orders-layout.css'
import './order-config.css'

// QuickCustomerModal 造出来的客户骨架：字段比 Customer 少，stage 是宽泛的 string。
// 单独定义是为了让「弹窗产出什么」和「落库要什么」这两件事在类型上说清楚。
type QuickCustomerInput = {
  id: string
  name: string
  phone: string
  cityArea: string
  stage: string
  intent: '高' | '中' | '低'
  expectedAmount: number
  products: string[]
  style: string
  budget: string
  renovationProgress: string
  concerns: string[]
  salesperson: string
  source: string
  createdAt: string
  lastContactAt: string
  createdBy: string
  updatedAt: string
}

type Props = {
  customers: Customer[]
  products: ProductCatalogItem[]
  orders: SalesOrder[]
  activeUser: string
  onAddOrder: (order: SalesOrder) => void
  onUpdateOrder: (id: string, changes: Partial<SalesOrder>) => void
  onActivate: (id: string, operator: string) => { ok: boolean; error?: string }
  onAddPayment?: (orderId: string, payment: PaymentRecord) => void
  configProducts?: ConfigProduct[]
  skuUnits?: SkuUnit[]
  components?: ProductComponent[]
  packages?: ProductPackage[]
  categories?: ProductCategory[]
  series?: ProductSeries[]
  showPricing?: boolean
  // 测试阶段销售自行录入：新增客户/临时产品
  onAddCustomer?: (customer: Customer) => void
}

const money = (value: number) => `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const paid = (order: SalesOrder) => order.payments.reduce((sum, item) => sum + (item.type === '退款' ? -item.amount : item.amount), 0)
const routeCustomerId = () => new URLSearchParams(typeof window === 'undefined' ? '' : window.location.hash.split('?')[1] ?? '').get('customer') ?? ''
const nextOrderNo = (orders: SalesOrder[]) => {
  const max = orders.reduce((current, order) => {
    const match = order.orderNo.match(/^NO\.(\d{7})$/)
    return match ? Math.max(current, Number(match[1])) : current
  }, 0)
  return `NO.${String(max + 1).padStart(7, '0')}`
}

// 加急订单现货不足检查：现货/展厅样品主件可用量 < 需要量 → 返回警示文案；外采/定制可订货不警示
const shortageText = (item: OrderItem, skuUnits: SkuUnit[], products: ProductCatalogItem[]): string | null => {
  if (item.skuLines?.length) {
    for (const line of item.skuLines) {
      if (!['现货', '展厅样品'].includes(line.supplyType)) continue
      const unit = skuUnits.find((u) => u.id === line.skuUnitId)
      if (!unit) continue
      const need = item.quantity * line.quantity
      const avail = availableCount(unit)
      if (avail < need) return `「${line.componentName}」现货不足：可用 ${avail}，本单需要 ${need}（${line.sku}）`
    }
    return null
  }
  const product = products.find((p) => p.id === item.productId)
  if (!product || !['现货', '展厅样品'].includes(product.supplyType)) return null
  const avail = Math.max(0, product.availableStock - (product.reservedStock ?? 0))
  return avail < item.quantity ? `现货不足：可用 ${avail}，本单需要 ${item.quantity}（${product.sku}）` : null
}

export function OrderWorkspacePage({ customers, products, orders, activeUser, onAddOrder, onUpdateOrder, onActivate, onAddPayment, configProducts = [], skuUnits = [], components = [], packages = [], categories = [], series = [], showPricing = false, onAddCustomer }: Props) {
  const routeCustomer = routeCustomerId()
  const [customerId, setCustomerId] = useState(customers.some((item) => item.id === routeCustomer) ? routeCustomer : customers[0]?.id ?? '')
  const [query, setQuery] = useState('')
  const [source, setSource] = useState<'config' | 'package' | 'catalog'>(configProducts.length ? 'config' : packages.length ? 'package' : 'catalog')
  const [pickerProduct, setPickerProduct] = useState<ConfigProduct | null>(null)
  const [pickerPackage, setPickerPackage] = useState<ProductPackage | null>(null)
  const [expandedLine, setExpandedLine] = useState<string>('')
  // 产品库单品 三级导航：null = 全部；选品类时只显示该品类下系列；选系列时只显示该系列下单品
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(() => new Set())
  const [orderType, setOrderType] = useState<'订货' | '现货' | '退货'>('订货')
  const [urgent, setUrgent] = useState(false)
  const [items, setItems] = useState<OrderItem[]>([])
  const [otherFee, setOtherFee] = useState(0)
  // 实收价：null = 跟随订单总价（未手动改过）；手动改过之后锁定该值，可用「跟随总价」复位
  const [actualPrice, setActualPrice] = useState<number | null>(null)
  const [deliveryMonth, setDeliveryMonth] = useState('')
  const [deliveryDate, setDeliveryDate] = useState('')
  const [address, setAddress] = useState('')
  const [depositRate, setDepositRate] = useState(50)
  const [depositAmount, setDepositAmount] = useState(0)
  const [note, setNote] = useState('')
  const [quotationFiles, setQuotationFiles] = useState<CustomerFile[]>([])
  const [paymentOrderId, setPaymentOrderId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [notice, setNotice] = useState('')
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null)
  // 测试阶段自助录入入口
  const [showQuickCustomer, setShowQuickCustomer] = useState(false)
  const [showQuickProduct, setShowQuickProduct] = useState(false)
  const quoteInput = useRef<HTMLInputElement>(null)
  const customer = customers.find((item) => item.id === customerId)
  const filtered = products.filter((item) => `${item.name}${item.sku}${item.category ?? ''}${item.woodMaterial ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const filteredConfig = useMemo(() => configProducts
    .filter((item) => item.status === '上架')
    .filter((item) => `${item.name}${item.code}${item.series ?? ''}${item.style ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.sortOrder - b.sortOrder), [configProducts, query])
  const filteredPackages = useMemo(() => packages
    .filter((item) => item.status === '上架')
    .filter((item) => `${item.name}${item.code}${item.description ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.sortOrder - b.sortOrder), [packages, query])
  // —— 产品库单品 三级导航数据 ——
  // 按上架品类 (id, name, sort) → 该品类下的系列名集合 → 该系列下的 configProduct 数量
  const configTree = useMemo(() => {
    const catById = new Map(categories.map((c) => [c.id, c]))
    const list = configProducts.filter((cp) => cp.status === '上架')
    // categoryId -> Map<seriesName, count>
    const grouped = new Map<string, Map<string, number>>()
    for (const cp of list) {
      const map = grouped.get(cp.categoryId) ?? new Map<string, number>()
      const serName = cp.series?.trim() || '其他'
      map.set(serName, (map.get(serName) ?? 0) + 1)
      grouped.set(cp.categoryId, map)
    }
    const rows = categories
      .map((cat) => {
        const serMap = grouped.get(cat.id)
        if (!serMap) return null
        const seriesArr = Array.from(serMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'))
        return { cat, series: seriesArr, total: seriesArr.reduce((s, x) => s + x.count, 0) }
      })
      .filter((row): row is { cat: ProductCategory; series: { name: string; count: number }[]; total: number } => !!row)
      .sort((a, b) => (a.cat.sort ?? 0) - (b.cat.sort ?? 0) || a.cat.name.localeCompare(b.cat.name, 'zh'))
    // 给「其他」这种内置兜底系列，缺失时也补一条占位，让用户能看到完整结构
    for (const r of rows) {
      if (!r.series.find((s) => s.name === '其他')) r.series.push({ name: '其他', count: 0 })
      r.series.sort((a, b) => (a.name === '其他' ? 1 : b.name === '其他' ? -1 : b.count - a.count || a.name.localeCompare(b.name, 'zh')))
    }
    return { rows, catById, total: list.length }
  }, [categories, configProducts])
  // 当前选中品类下可见的单品（受三级 + 搜索影响；搜索非空时忽略三级，全局扁平化匹配）
  const visibleConfig = useMemo(() => {
    const all = configProducts.filter((cp) => cp.status === '上架')
    const q = query.trim().toLowerCase()
    if (q) {
      // 搜索模式：跨品类扁平匹配；顺便把「结果所属品类/系列」返给卡片，做面包屑提示
      return all
        .filter((cp) => `${cp.name}${cp.code}${cp.series ?? ''}${cp.style ?? ''}`.toLowerCase().includes(q))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    }
    if (selectedSeries && selectedCategoryId) {
      return all.filter((cp) => cp.categoryId === selectedCategoryId && (cp.series?.trim() || '其他') === selectedSeries).sort((a, b) => a.sortOrder - b.sortOrder)
    }
    if (selectedCategoryId) {
      return all.filter((cp) => cp.categoryId === selectedCategoryId).sort((a, b) => a.sortOrder - b.sortOrder)
    }
    return all.sort((a, b) => a.sortOrder - b.sortOrder)
  }, [configProducts, query, selectedCategoryId, selectedSeries])
  // 在切换到「产品库单品」且没选中节点时，自动选第一个有单品的品类（让卡片区不空白）
  useEffect(() => {
    if (source !== 'config') return
    if (selectedCategoryId || query.trim()) return
    const first = configTree.rows[0]
    if (first) {
      setSelectedCategoryId(first.cat.id)
      setExpandedCats((s) => (s.has(first.cat.id) ? s : new Set([...s, first.cat.id])))
    }
  }, [source, selectedCategoryId, query, configTree.rows])
  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  // 订单总价 = 商品合计 + 其他费用（客户看到的标价/订单价格）
  const listTotal = Math.round((subtotal + otherFee) * 100) / 100
  // 实收价 = 客户讲价后实际成交价；未手动改过时跟随订单总价
  const actualReceived = Math.round(Math.max(0, actualPrice ?? listTotal) * 100) / 100
  // 定金按实收价计算（不再按优惠前的总价算）
  // 销售最后定的金额为 depositAmount；定金比例仅作 UI 辅助，按 amount / actualReceived 反推
  const requiredDeposit = Math.round(Math.max(0, depositAmount) * 100) / 100
  // 实收价变化时，保持用户上一次设定的"定金比例"为锚，按比例重算金额
  useEffect(() => {
    const next = Math.round(actualReceived * depositRate / 100 * 100) / 100
    setDepositAmount(next)
    // 仅在实收价真正变化时同步（首次 mount 也跑一次，把 amount 初始化到位）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualReceived])
  const selectedPaymentOrder = orders.find((item) => item.id === paymentOrderId)

  const updateItem = (id: string, changes: Partial<OrderItem>) => setItems((rows) => rows.map((row) => row.id === id ? { ...row, ...changes } : row))
  const add = (product: ProductCatalogItem) => setItems((current) => {
    const found = current.find((item) => item.productId === product.id)
    if (found) return current.map((item) => item === found ? { ...item, quantity: item.quantity + 1 } : item)
    return [...current, { id: `item-${Date.now()}-${product.id}`, productId: product.id, sku: product.sku, productName: product.name, specification: product.specifications[0], quantity: 1, unit: '件', unitPrice: product.unitPrice, supplyType: product.supplyType, availableStock: Math.max(0, product.availableStock - (product.reservedStock ?? 0)), material: product.woodMaterial, color: product.color, dimensions: product.dimensions, attachments: [] }]
  })
  const addConfigItem = (item: OrderItem) => {
    setItems((current) => {
      const key = (row: OrderItem) => `${row.configProductId ?? ''}|${JSON.stringify(row.selections ?? {})}`
      const found = current.find((row) => row.configProductId && key(row) === key(item))
      if (found) return current.map((row) => row === found ? { ...row, quantity: row.quantity + item.quantity } : row)
      return [...current, item]
    })
    setExpandedLine(item.id)
    setPickerProduct(null)
  }

  const packagePickKey = (row: OrderItem) => `${row.packageId ?? ''}|${JSON.stringify((row.packageItems ?? []).map((entry) => [entry.productId, entry.quantity, entry.selections]))}`
  const addPackageItem = (item: OrderItem) => {
    setItems((current) => {
      const found = current.find((row) => row.packageId && packagePickKey(row) === packagePickKey(item))
      if (found) return current.map((row) => row === found ? { ...row, quantity: row.quantity + item.quantity } : row)
      return [...current, item]
    })
    setExpandedLine(item.id)
    setPickerPackage(null)
  }

  // 临时产品：销售开单页「+ 添加临时产品」直接进购物车；不进产品主库。
  const addTemporaryItem = (item: OrderItem) => {
    setItems((current) => [...current, item])
    setExpandedLine(item.id)
    setShowQuickProduct(false)
  }

  // 临时客户：销售开单页「+ 新建客户」直接进 customers 表 + 选为当前客户。
  const handleQuickCustomerConfirm = (input: QuickCustomerInput) => {
    if (!onAddCustomer) return
    const customer = { ...input, stage: input.stage as Customer['stage'] } as Customer
    onAddCustomer(customer)
    setCustomerId(customer.id)
    setShowQuickCustomer(false)
    setNotice(`已新建临时客户「${customer.name}」，可在「客户管理」补全详情`)
  }

  const changeCustomer = (id: string) => {
    setCustomerId(id)
    const next = customers.find((item) => item.id === id)
    setAddress(next?.cityArea ?? '')
  }

  const saveDraft = () => {
    if (!customer) {
      // 没客户时：销售开单最容易卡的地方——给出明显提示并直接弹入口
      if (onAddCustomer) {
        setShowQuickCustomer(true)
        setNotice('当前没有可选客户，先录入一个临时客户后再保存。')
      } else {
        setNotice('请选择客户后再保存销售单')
      }
      return
    }
    if (!items.length) { setNotice('请至少加入一件商品'); return }
    const now = new Date().toISOString()
    const savedDepositRate = actualReceived > 0 ? Math.round(depositAmount / actualReceived * 10000) / 100 : 0
    const order: SalesOrder = { id: `order-${Date.now()}`, orderNo: nextOrderNo(orders), orderType, urgent, customerId: customer.id, customerName: customer.name, salesperson: customer.salesperson || activeUser, salespersonId: customer.salespersonId, collaborators: customer.designer ? [customer.designer] : [], products: items.map((item) => item.productName), items, contractAmount: actualReceived, listTotal, actualReceived, depositRate: savedDepositRate, otherFee, signedAt: now.slice(0, 10), expectedDeliveryAt: deliveryDate || undefined, expectedDeliveryMonth: deliveryMonth || undefined, contactPhone: customer.phone, deliveryAddress: address || customer.cityArea, opener: activeUser, follower: customer.salesperson || activeUser, quotationFiles, requiredDeposit, discountAmount: Math.round((listTotal - actualReceived) * 100) / 100, note: note || undefined, status: '待客户签名', payments: [], performanceRate: 100, createdAt: now, updatedAt: now }
    onAddOrder(order)
    setPreviewOrder(order)
    setItems([]); setActualPrice(null); setOtherFee(0); setQuotationFiles([]); setNote('')
    setNotice('销售单已保存，请在预览中打印并完成签名留存')
  }

  const recordDeposit = () => {
    if (!selectedPaymentOrder || paymentAmount <= 0 || !onAddPayment) return
    onAddPayment(selectedPaymentOrder.id, { id: `payment-${Date.now()}`, orderId: selectedPaymentOrder.id, type: '定金', amount: paymentAmount, paidAt: new Date().toISOString(), method: '微信', recordedBy: activeUser, status: '已确认' })
    setPaymentOrderId(''); setPaymentAmount(0); setNotice('定金已登记，可以提交店长审核')
  }

  return <main className="order-workspace">
    <header className="order-page-heading"><div><p>尚品居产品销售单</p><h1>销售开单</h1><span>按日常纸质销售单填写，保存后统一进入订单、收款、送货与售后流程。</span></div><button type="button" className="print-order-button" onClick={() => window.print()}><Printer size={17}/>打印当前开单页</button></header>
    {notice && <div className="order-notice" role="status">{notice}</div>}
    <section className="order-steps" aria-label="订单流程"><b>1 选客户商品</b><span>2 保存报价草稿</span><span>3 客户确认</span><span>4 登记定金</span><span>5 审核备货</span></section>
    <section className="order-entry-panel" aria-label="开单信息">
      <div className="selection-bar sales-form-basics">
        <label><span>订单类型</span><select value={orderType} onChange={(e) => setOrderType(e.target.value as typeof orderType)}><option>订货</option><option>现货</option><option>退货</option></select></label>
        <label className="urgent-toggle" title="客户时间紧急时勾选；加急订单中现货不足的商品会红色警示"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)}/>加急订单</label>
        <label><span>当前客户</span><select value={customerId} onChange={(e) => changeCustomer(e.target.value)}>{customers.length ? customers.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.phone || '电话未登记'}</option>) : <option value="">— 暂无客户，先新建一个 —</option>}</select></label>{onAddCustomer && <button type="button" className="quick-entry-button" onClick={() => setShowQuickCustomer(true)} title="测试期自助录入最小可用客户"><UserPlus size={15}/>新建临时客户</button>}
        <label className="product-search"><span>搜索商品</span><div><Search/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="输入商品名、SKU、品类或木材"/></div></label>
      </div>
      <div className="order-customer-summary"><span><small>客户名称</small><b>{customer?.name ?? '未选择'}</b></span><span><small>联系方式</small><b>{customer?.phone ?? '-'}</b></span><label>送货地址<input value={address || customer?.cityArea || ''} onChange={(e) => setAddress(e.target.value)} placeholder="填写详细送货地址"/></label><label>送货日期<input type="date" value={deliveryDate} onChange={(e) => { setDeliveryDate(e.target.value); setDeliveryMonth(e.target.value.slice(0, 7)) }}/></label></div>
    </section>
    <div className="selection-layout"><section className="product-browser"><header className="browser-head"><div className="browser-tabs" role="tablist" aria-label="商品来源"><button type="button" role="tab" aria-selected={source === 'config'} className={source === 'config' ? 'active' : ''} onClick={() => setSource('config')}>产品库单品{configProducts.length ? ` · ${visibleConfig.length}` : ''}</button><button type="button" role="tab" aria-selected={source === 'package'} className={source === 'package' ? 'active' : ''} onClick={() => setSource('package')}>产品库套餐{packages.length ? ` · ${filteredPackages.length}` : ''}</button>{products.length > 0 && <button type="button" role="tab" aria-selected={source === 'catalog'} className={source === 'catalog' ? 'active' : ''} onClick={() => setSource('catalog')}>商品库 · {filtered.length}</button>}</div>{source === 'config' && <button type="button" className="quick-entry-button pm-tree-quick-add" onClick={() => setShowQuickProduct(true)} title="测试期快速补录未入库产品"><Plus size={15}/>添加临时产品</button>}</header>
      {source === 'config' && (categories.length === 0
        // 无品类数据时回退平铺（兼容老数据 / 测试场景）
        ? <div className="config-list">{filteredConfig.length ? filteredConfig.map((cp) => { const avail = configProductAvailability(cp, skuUnits); const availText = avail.missingSku ? '规格未配齐' : avail.hasCustom ? '含定制主件' : avail.hasPurchase ? '含外采主件' : `可售 ${avail.stock} 套`; return <article key={cp.id} className="config-card"><div><strong>{cp.name}</strong><small>{cp.code}{cp.series ? ` · ${cp.series}` : ''}{cp.style ? ` · ${cp.style}` : ''}</small><small>{availText}</small></div><span><b>{formatPriceRange(configProductPriceRange(cp, skuUnits))}</b><small>选规格后自动算价</small></span><button onClick={() => setPickerProduct(cp)} title="选择规格加入选品"><PackagePlus/></button></article> }) : <div className="cart-empty">产品库暂无上架单品，可让店长在「产品主数据」中配置</div>}</div>
        // 正常三级折叠树
        : <div className="config-cascade">
            <aside className="pm-tree" aria-label="产品库分类导航">
              <div className="pm-tree-head">
                <b>产品分类</b>
                <small>共 {configTree.total} 款单品</small>
              </div>
              <button type="button" className={`pm-tree-row pm-tree-all${!selectedCategoryId ? ' active' : ''}`} onClick={() => { setSelectedCategoryId(null); setSelectedSeries(null) }} aria-pressed={!selectedCategoryId}>
                <span>全部</span><small>{configTree.total}</small>
              </button>
              {configTree.rows.map((row) => {
                const isCat = selectedCategoryId === row.cat.id
                const isExpanded = expandedCats.has(row.cat.id)
                return (
                  <div key={row.cat.id} className={`pm-tree-cat${isCat ? ' active' : ''}`}>
                    <button type="button" className="pm-tree-row pm-tree-cat-row" onClick={() => { const willExpand = !isExpanded; setExpandedCats((s) => { const next = new Set(s); if (willExpand) next.add(row.cat.id); else next.delete(row.cat.id); return next }); setSelectedCategoryId(row.cat.id); setSelectedSeries(null) }} aria-expanded={isExpanded}>
                      <ChevronRight size={12} className={`pm-tree-chevron${isExpanded ? ' rotated' : ''}`} />
                      <span>{row.cat.name}</span>
                      <small>{row.total}</small>
                    </button>
                    {isExpanded && (
                      <div className="pm-tree-series">
                        {row.series.map((ser) => {
                          const isSeries = isCat && selectedSeries === ser.name
                          return (
                            <button key={ser.name} type="button" className={`pm-tree-row pm-tree-series-row${isSeries ? ' active' : ''}`} onClick={() => { setSelectedCategoryId(row.cat.id); setSelectedSeries(ser.name) }} disabled={ser.count === 0} aria-pressed={isSeries}>
                              <span>{ser.name}</span>
                              <small>{ser.count}</small>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </aside>
            <div className="pm-cards">
              {query.trim() && <p className="pm-cards-meta">搜索「{query.trim()}」共匹配 <b>{visibleConfig.length}</b> 款单品</p>}
              {!query.trim() && selectedCategoryId && (() => {
                const cat = configTree.catById.get(selectedCategoryId)
                const label = selectedSeries ? `${cat?.name ?? ''} · ${selectedSeries}` : (cat?.name ?? '')
                return <p className="pm-cards-meta">{label} · 共 <b>{visibleConfig.length}</b> 款</p>
              })()}
              {!query.trim() && !selectedCategoryId && <p className="pm-cards-meta">全部 · 共 <b>{visibleConfig.length}</b> 款</p>}
              {visibleConfig.length === 0
                ? <div className="cart-empty">该节点下暂无单品，请换个分类或清空搜索词再试</div>
                : visibleConfig.map((cp) => {
                    const avail = configProductAvailability(cp, skuUnits)
                    const availText = avail.missingSku ? '规格未配齐' : avail.hasCustom ? '含定制主件' : avail.hasPurchase ? '含外采主件' : `可售 ${avail.stock} 套`
                    const cat = configTree.catById.get(cp.categoryId)
                    return <article key={cp.id} className="config-card">
                      <div>
                        <strong>{cp.name}</strong>
                        <small>{cp.code}{cat ? ` · ${cat.name}` : ''}{cp.series ? ` · ${cp.series}` : ''}{cp.style ? ` · ${cp.style}` : ''}</small>
                        <small>{availText}</small>
                      </div>
                      <span><b>{formatPriceRange(configProductPriceRange(cp, skuUnits))}</b><small>选规格后自动算价</small></span>
                      <button onClick={() => setPickerProduct(cp)} title="选择规格加入选品"><PackagePlus/></button>
                    </article>
                  })}
            </div>
          </div>
      )}
      {source === 'package' && <div className="config-list">{filteredPackages.length ? filteredPackages.map((pk) => { const avail = packageAvailability(pk, configProducts, skuUnits); const availText = avail.missingSku ? '有单品规格未配齐' : avail.hasCustom ? '含定制主件' : avail.hasPurchase ? '含外采主件' : `可售 ${avail.stock} 套`; return <article key={pk.id} className="config-card package-card"><div><strong>{pk.name}</strong><small>{pk.code} · 含 {pk.items.length} 件单品{pk.description ? ` · ${pk.description}` : ''}</small><small>{availText}</small></div><span><b>{formatPriceRange(packagePriceRange(pk, configProducts, skuUnits))}</b><small>选配后自动算价</small></span><button onClick={() => setPickerPackage(pk)} title="选配套餐加入选品"><PackagePlus/></button></article> }) : <div className="cart-empty">产品库暂无上架套餐，可让店长在「产品主数据 · 套餐配置」中创建</div>}</div>}
      {source === 'catalog' && <div>{filtered.map((product) => <article key={product.id}><div><strong>{product.name}</strong><small>{product.sku} · {product.woodMaterial || product.category || '资料待完善'}</small><small>{product.dimensions || product.specifications.join(' / ')}</small></div><span><b>{money(product.unitPrice)}</b><small>{product.supplyType} · 可用 {Math.max(0, product.availableStock - (product.reservedStock ?? 0))}</small></span><button onClick={() => add(product)} title="加入选品"><PackagePlus/></button></article>)}</div>}</section>
      <aside className="selection-cart"><header><ShoppingCart/><div><h2>销售单明细</h2><span>{customer?.name || '未选择客户'} · {items.length} 项</span></div></header>{items.map((item) => <article className="order-line" key={item.id} data-config-line={item.configProductId || item.packageId ? 'true' : undefined}><div className="order-line-main"><strong>{item.productName}{(item.configProductCode || item.packageCode) && <small className="line-code">{item.configProductCode ?? item.packageCode}</small>}</strong>{item.configProductId || item.packageId ? <span className="line-spec-text">{item.specification}</span> : (() => { const matched = item.productId ? products.find((p) => p.id === item.productId) : undefined; return matched ? <select aria-label={`${item.productName}规格`} value={item.specification} onChange={(e) => updateItem(item.id, { specification: e.target.value, dimensions: e.target.value })}>{matched.specifications.map((spec) => <option key={spec}>{spec}</option>)}</select> : <input aria-label={`${item.productName}规格`} value={item.specification ?? ''} onChange={(e) => updateItem(item.id, { specification: e.target.value, dimensions: e.target.value })} placeholder="规格" /> })()}<div className="order-line-details"><input aria-label={`${item.productName}材质`} value={item.material ?? ''} onChange={(e) => updateItem(item.id, { material: e.target.value })} placeholder="材质"/><input aria-label={`${item.productName}单位`} value={item.unit ?? '件'} onChange={(e) => updateItem(item.id, { unit: e.target.value })} placeholder="单位"/><input aria-label={`${item.productName}备注`} value={item.lineNote ?? ''} onChange={(e) => updateItem(item.id, { lineNote: e.target.value })} placeholder="本行备注"/></div>{item.skuLines?.length ? <button type="button" className="line-sku-toggle" aria-expanded={expandedLine === item.id} onClick={() => setExpandedLine((current) => current === item.id ? '' : item.id)}>组件明细 {item.skuLines.length} 项</button> : null}{urgent && shortageText(item, skuUnits, products) && <span className="line-shortage" role="alert">⚠ {shortageText(item, skuUnits, products)}</span>}</div><input aria-label={`${item.productName}数量`} type="number" min="1" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value)) })}/><input className="line-price" aria-label={`${item.productName}单价`} type="number" min="0" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value)) })}/><b>{money(item.unitPrice * item.quantity)}</b><button aria-label={`删除${item.productName}`} onClick={() => setItems((rows) => rows.filter((row) => row.id !== item.id))}><Trash2/></button>{item.skuLines?.length && expandedLine === item.id ? <ul className="line-sku-lines">{item.skuLines.map((line) => <li key={line.skuUnitId}><span>{line.componentName} ×{line.quantity}</span><small>{line.specSummary}</small><small>{line.supplyType}{line.optional ? ' · 选配' : ''}</small>{showPricing && <b>{money(line.unitPrice * line.quantity)}</b>}</li>)}</ul> : null}</article>)}{!items.length && <div className="cart-empty">从左侧选择客户需要的商品</div>}
        <div className="cart-totals"><label>其他费用<input type="number" min="0" value={otherFee} onChange={(e) => setOtherFee(Number(e.target.value))}/></label><label>实收价<div className="actual-price-field"><input aria-label="实收价" type="number" min="0" value={actualReceived} onChange={(e) => setActualPrice(Number(e.target.value))} title="客户讲价后再填这里；默认等于订单总价"/>{actualPrice !== null && actualPrice !== listTotal && <button type="button" className="reset-actual" onClick={() => setActualPrice(null)} title="恢复为订单总价">跟随总价</button>}</div></label><div className="deposit-fields"><label className="deposit-rate-field"><span className="field-label">定金比例</span><div className="deposit-field"><input aria-label="定金比例" type="number" min="0" max="100" step="0.01" value={depositRate} onChange={(event) => { const rate = Math.min(100, Math.max(0, Number(event.target.value) || 0)); setDepositRate(Math.round(rate * 100) / 100); setDepositAmount(Math.round(actualReceived * rate / 100 * 100) / 100) }}/><em>%</em></div></label><label className="deposit-amount-field"><span className="field-label">定金金额（可改）</span><div className="deposit-field"><span className="currency-prefix">¥</span><input aria-label="定金金额" type="number" min="0" step="0.01" value={depositAmount} onChange={(event) => { const amount = Math.max(0, Number(event.target.value) || 0); setDepositAmount(Math.round(amount * 100) / 100); if (actualReceived > 0) setDepositRate(Math.round(amount / actualReceived * 10000) / 100) }}/></div></label></div><label>整单备注<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="楼层、入户、送货、安装及其他约定"/></label><div className="order-file-row"><input ref={quoteInput} className="visually-hidden" type="file" multiple accept="image/*,.pdf,.doc,.docx,.dwg,.dxf,.cad" onChange={(e) => { const files = Array.from(e.target.files ?? []).map((file) => ({ id: `quote-${Date.now()}-${file.name}`, name: file.name, type: file.type || '文件', size: file.size })); setQuotationFiles((current) => [...current, ...files]); e.target.value = '' }}/><button type="button" onClick={() => quoteInput.current?.click()}><FileUp size={15}/>报价/图纸</button><span>{quotationFiles.length ? `已选 ${quotationFiles.length} 个文件` : '可上传客户确认资料'}</span></div><span>商品合计<b>{money(subtotal)}</b></span><span>其他费用<b>{money(otherFee)}</b></span><span>订单总价<b>{money(listTotal)}</b></span><span>应收定金<b>{money(requiredDeposit)}</b></span><strong>实收金额<b>{money(actualReceived)}</b></strong><button className="save-order" onClick={saveDraft}>保存销售单</button></div></aside></div>
    <section className="order-pipeline"><header><h2>订单处理</h2><span>每张订单只沿这一条链路推进</span></header>{orders.map((order) => { const received = paid(order); const depositEnough = received >= (order.requiredDeposit ?? 0); return <article key={order.id}><span><b>{order.orderNo} · {order.customerName}</b><small>{order.products.join('、')} · {money(order.contractAmount)} · 已收 {money(received)}</small></span><i>{order.status}</i><div><button onClick={() => setPreviewOrder(order)}>查看/打印</button>{order.status === '草稿' && <button onClick={() => onUpdateOrder(order.id, { status: '待客户确认' })}>提交客户确认</button>}{order.status === '已签名已确认' && <button onClick={() => onUpdateOrder(order.id, { status: '待审核', customerConfirmedAt: new Date().toISOString(), customerConfirmationNote: '签名回单已上传' })}>提交店长审核</button>}{order.status === '待客户确认' && <button onClick={() => onUpdateOrder(order.id, { status: '待审核', customerConfirmedAt: new Date().toISOString(), customerConfirmationNote: '客户现场/线上确认' })}>客户已确认</button>}{order.status === '待审核' && !depositEnough && onAddPayment && <button onClick={() => { setPaymentOrderId(order.id); setPaymentAmount(Math.max(0, (order.requiredDeposit ?? 0) - received)) }}>登记定金</button>}{order.status === '待审核' && depositEnough && <button onClick={() => { const result = onActivate(order.id, activeUser); setNotice(result.ok ? '订单已生效，已自动生成库存、采购或工厂需求' : result.error ?? '操作失败') }}><CheckCircle2/>审核并生效</button>}</div></article> })}</section>
    {selectedPaymentOrder && <div className="order-payment-backdrop"><section role="dialog" aria-label={`登记定金 · ${selectedPaymentOrder.customerName}`}><h2>登记定金 · {selectedPaymentOrder.customerName}</h2><p>应收定金 {money(selectedPaymentOrder.requiredDeposit ?? 0)}，已收 {money(paid(selectedPaymentOrder))}</p><label>本次收款<input aria-label="本次定金" type="number" min="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(Number(e.target.value))}/></label><footer><button onClick={() => setPaymentOrderId('')}>取消</button><button onClick={recordDeposit}>确认登记</button></footer></section></div>}
    {previewOrder && <OrderPreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} onUpdate={(id, changes) => { onUpdateOrder(id, changes); setPreviewOrder((current) => current?.id === id ? { ...current, ...changes } : current) }}/>}
    {pickerProduct && <ConfigProductPicker product={pickerProduct} components={components} skuUnits={skuUnits} showPricing={showPricing} onClose={() => setPickerProduct(null)} onConfirm={addConfigItem}/>}
    {pickerPackage && <PackagePicker pkg={pickerPackage} configProducts={configProducts} components={components} skuUnits={skuUnits} showPricing={showPricing} onClose={() => setPickerPackage(null)} onConfirm={addPackageItem}/>}
    {showQuickCustomer && onAddCustomer && <QuickCustomerModal activeUser={activeUser} onClose={() => setShowQuickCustomer(false)} onConfirm={handleQuickCustomerConfirm}/>}
    {showQuickProduct && <QuickProductModal onClose={() => setShowQuickProduct(false)} onConfirm={addTemporaryItem}/>}
  </main>
}
