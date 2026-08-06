import { useRef, useState } from 'react'
import { ArrowRightLeft, Check, ClipboardPlus, FileUp, PackageMinus, PackagePlus, RotateCcw, ShieldCheck, Trash2, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { InventoryDocument, InventoryDocumentType, ProductCatalogItem, ReplenishmentRequest, Warehouse, WarehouseStock } from '../../types'

type Capabilities = { receive: boolean; issue: boolean; transfer: boolean; audit: boolean; requestReplenishment: boolean; approveReplenishment: boolean; purchase: boolean }
type Props = { products: ProductCatalogItem[]; warehouses: Warehouse[]; stocks: WarehouseStock[]; documents: InventoryDocument[]; requests: ReplenishmentRequest[]; operator: string; capabilities: Capabilities; onDocument: (document: InventoryDocument) => { ok: boolean; error?: string }; onRequest: (request: ReplenishmentRequest) => void; onReview: (id: string, status: '已批准' | '已驳回' | '已转采购', reviewer: string, note?: string) => void }

const documentActions: { type: InventoryDocumentType; label: string; icon: typeof PackagePlus; permission: keyof Capabilities }[] = [
  { type:'到货入库', label:'到货入库', icon:PackagePlus, permission:'receive' },
  { type:'销售出库', label:'销售出库', icon:PackageMinus, permission:'issue' },
  { type:'客户退货', label:'客户退货', icon:RotateCcw, permission:'receive' },
  { type:'仓库调拨', label:'仓库调拨', icon:ArrowRightLeft, permission:'transfer' },
  { type:'盘点调整', label:'盘点减少', icon:ClipboardPlus, permission:'audit' },
  { type:'破损报废', label:'破损报废', icon:Trash2, permission:'audit' },
]
const moneylessNumber = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits:2, maximumFractionDigits:2 })

export function InventoryWorkflowPanel(props: Props) {
  const [mode, setMode] = useState<'operations' | 'replenishment' | 'warehouses'>('operations')
  const [formType, setFormType] = useState<InventoryDocumentType | null>(null)
  const [feedback, setFeedback] = useState('')
  const [showRequest, setShowRequest] = useState(false)
  const importInput = useRef<HTMLInputElement>(null)
  const activeWarehouses = props.warehouses.filter((item) => item.active)

  const importReceipts = async (file: File) => {
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type:'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval:'' })
      let imported = 0; const errors: string[] = []
      rows.forEach((row, index) => {
        const sku = String(row.SKU ?? row['商品SKU'] ?? '').trim(); const quantity = Number(row['数量']); const warehouseName = String(row['入库仓库'] ?? '').trim()
        const product = props.products.find((item) => item.sku.toLowerCase() === sku.toLowerCase()); const warehouse = activeWarehouses.find((item) => item.name === warehouseName) ?? activeWarehouses[0]
        if (!product || !warehouse || !Number.isFinite(quantity) || quantity <= 0) { errors.push(`第 ${index + 2} 行商品、数量或仓库无效`); return }
        const result = props.onDocument(makeDocument('到货入库', product, quantity, props.operator, undefined, warehouse.id, String(row['备注'] ?? '批量到货导入')))
        result.ok ? imported++ : errors.push(`第 ${index + 2} 行：${result.error}`)
      })
      setFeedback(`成功入库 ${imported} 行${errors.length ? `；${errors.slice(0,3).join('；')}` : ''}`)
    } catch { setFeedback('入库文件读取失败，请使用 Excel 或 CSV 文件') }
  }
  const downloadReceiptTemplate = () => {
    const sheet=XLSX.utils.aoa_to_sheet([['SKU','数量','入库仓库','备注'],[props.products[0]?.sku??'SPJ-001',1,activeWarehouses[0]?.name??'尚品居总仓','采购到货']])
    const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,sheet,'到货入库');XLSX.writeFile(workbook,'尚品居到货入库模板.xlsx')
  }

  return <section className="inventory-workflow">
    <nav className="workflow-tabs"><button className={mode === 'operations' ? 'active' : ''} onClick={() => setMode('operations')}>出入库作业</button><button className={mode === 'replenishment' ? 'active' : ''} onClick={() => setMode('replenishment')}>补仓审批 {props.requests.filter((item) => item.status === '待审批').length > 0 && <i>{props.requests.filter((item) => item.status === '待审批').length}</i>}</button><button className={mode === 'warehouses' ? 'active' : ''} onClick={() => setMode('warehouses')}>仓库明细</button></nav>
    {feedback && <div className="workflow-feedback"><span>{feedback}</span><button aria-label="关闭提示" onClick={() => setFeedback('')}><X size={15}/></button></div>}
    {mode === 'operations' && <><div className="workflow-actions">{documentActions.filter((item) => props.capabilities[item.permission]).map(({ type, label, icon:Icon }) => <button key={type} onClick={() => setFormType(type)}><Icon size={17}/>{label}</button>)}{props.capabilities.receive && <><button onClick={downloadReceiptTemplate}><FileUp size={17}/>入库模板</button><button onClick={() => importInput.current?.click()}><FileUp size={17}/>批量到货</button><input hidden ref={importInput} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => { const file=event.target.files?.[0]; event.target.value=''; if(file) void importReceipts(file) }}/></>}</div>{formType && <DocumentForm type={formType} products={props.products} warehouses={activeWarehouses} operator={props.operator} onCancel={() => setFormType(null)} onSubmit={(document) => { const result=props.onDocument(document); if(result.ok){setFormType(null);setFeedback(`${document.documentNo} 已完成`)} else setFeedback(result.error ?? '操作失败') }}/>}<DocumentList documents={props.documents} warehouses={props.warehouses}/></>}
    {mode === 'replenishment' && <><div className="workflow-actions">{props.capabilities.requestReplenishment && <button onClick={() => setShowRequest(true)}><ClipboardPlus size={17}/>新增补仓申请</button>}</div>{showRequest && <ReplenishmentForm products={props.products} operator={props.operator} onCancel={() => setShowRequest(false)} onSubmit={(request) => { props.onRequest(request); setShowRequest(false); setFeedback(`${request.requestNo} 已提交主管审批`) }}/>}<ReplenishmentList requests={props.requests} capabilities={props.capabilities} operator={props.operator} onReview={props.onReview}/></>}
    {mode === 'warehouses' && <WarehouseBalances products={props.products} warehouses={props.warehouses} stocks={props.stocks}/>} 
  </section>
}

function makeDocument(type: InventoryDocumentType, product: ProductCatalogItem, quantity: number, operator: string, fromWarehouseId?: string, toWarehouseId?: string, note?: string): InventoryDocument { const stamp=Date.now(); return { id:`document-${stamp}`, documentNo:`${type === '到货入库' ? 'RK' : type === '销售出库' ? 'CK' : type === '仓库调拨' ? 'DB' : 'KC'}${String(stamp).slice(-8)}`, type, status:'待执行', productId:product.id, sku:product.sku, productName:product.name, quantity, fromWarehouseId, toWarehouseId, note, operator, createdAt:new Date().toISOString() } }

function DocumentForm({ type, products, warehouses, operator, onCancel, onSubmit }: { type: InventoryDocumentType; products: ProductCatalogItem[]; warehouses: Warehouse[]; operator: string; onCancel:()=>void; onSubmit:(document:InventoryDocument)=>void }) {
  const [productId,setProductId]=useState(products[0]?.id??''); const [quantity,setQuantity]=useState(1); const [from,setFrom]=useState(warehouses[0]?.id??''); const [to,setTo]=useState(warehouses[type === '仓库调拨' ? 1 : 0]?.id??warehouses[0]?.id??''); const [note,setNote]=useState(''); const inbound=type==='到货入库'||type==='客户退货'
  const submit=(event:React.FormEvent)=>{event.preventDefault();const product=products.find((item)=>item.id===productId);if(product)onSubmit(makeDocument(type,product,quantity,operator,inbound?undefined:from,inbound||type==='仓库调拨'?to:undefined,note))}
  return <form className="workflow-form" onSubmit={submit}><header><h3>{type}</h3><button type="button" aria-label="关闭" onClick={onCancel}><X size={16}/></button></header><label>商品<select value={productId} onChange={(e)=>setProductId(e.target.value)}>{products.map((item)=><option value={item.id} key={item.id}>{item.sku} · {item.name}</option>)}</select></label><label>数量<input type="number" min="0.01" step="0.01" value={quantity} onChange={(e)=>setQuantity(Number(e.target.value))}/></label>{!inbound&&<label>调出仓库<select value={from} onChange={(e)=>setFrom(e.target.value)}>{warehouses.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}{(inbound||type==='仓库调拨')&&<label>调入仓库<select value={to} onChange={(e)=>setTo(e.target.value)}>{warehouses.map((item)=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}<label className="wide">说明<input value={note} onChange={(e)=>setNote(e.target.value)} placeholder="采购单、客户订单、退换货或盘点原因"/></label><footer><button type="button" onClick={onCancel}>取消</button><button className="primary">确认执行</button></footer></form>
}

function ReplenishmentForm({ products, operator, onCancel, onSubmit }: { products:ProductCatalogItem[];operator:string;onCancel:()=>void;onSubmit:(request:ReplenishmentRequest)=>void }) { const [productId,setProductId]=useState(products[0]?.id??'');const [quantity,setQuantity]=useState(1);const [neededAt,setNeededAt]=useState('');const [reason,setReason]=useState('销售备货需求');return <form className="workflow-form" onSubmit={(event)=>{event.preventDefault();const product=products.find((item)=>item.id===productId);if(!product)return;const now=new Date().toISOString();onSubmit({id:`replenishment-${Date.now()}`,requestNo:`BC${String(Date.now()).slice(-8)}`,productId:product.id,sku:product.sku,productName:product.name,quantity,neededAt:neededAt||undefined,reason,requester:operator,status:'待审批',createdAt:now,updatedAt:now})}}><header><h3>补仓申请</h3><button type="button" aria-label="关闭" onClick={onCancel}><X size={16}/></button></header><label>商品<select value={productId} onChange={(e)=>setProductId(e.target.value)}>{products.map((item)=><option value={item.id} key={item.id}>{item.sku} · {item.name}</option>)}</select></label><label>申请数量<input type="number" min="0.01" step="0.01" value={quantity} onChange={(e)=>setQuantity(Number(e.target.value))}/></label><label>需要日期<input type="date" value={neededAt} onChange={(e)=>setNeededAt(e.target.value)}/></label><label>申请原因<input required value={reason} onChange={(e)=>setReason(e.target.value)}/></label><footer><button type="button" onClick={onCancel}>取消</button><button className="primary">提交审批</button></footer></form> }

function ReplenishmentList({ requests, capabilities, operator, onReview }: {requests:ReplenishmentRequest[];capabilities:Capabilities;operator:string;onReview:Props['onReview']}) { return <div className="workflow-list">{requests.map((item)=><article key={item.id}><span><b>{item.productName}</b><small>{item.requestNo} · {item.requester} · 需要 {item.neededAt||'待确认'}</small></span><strong>{moneylessNumber(item.quantity)}</strong><em>{item.status}</em><p>{item.reason}</p><div>{item.status==='待审批'&&capabilities.approveReplenishment&&<><button onClick={()=>onReview(item.id,'已批准',operator)}><Check size={14}/>批准</button><button onClick={()=>onReview(item.id,'已驳回',operator,'主管驳回')}>驳回</button></>}{item.status==='已批准'&&capabilities.purchase&&<button onClick={()=>onReview(item.id,'已转采购',operator)}><ShieldCheck size={14}/>转采购</button>}</div></article>)}{!requests.length&&<div className="workflow-empty">暂无补仓申请</div>}</div> }
function DocumentList({documents,warehouses}:{documents:InventoryDocument[];warehouses:Warehouse[]}) { const name=(id?:string)=>warehouses.find((item)=>item.id===id)?.name??'-';return <div className="workflow-list">{documents.map((item)=><article key={item.id}><span><b>{item.productName}</b><small>{item.documentNo} · {item.operator}</small></span><strong>{item.quantity.toFixed(2)}</strong><em>{item.type}</em><p>{item.type==='仓库调拨'?`${name(item.fromWarehouseId)} → ${name(item.toWarehouseId)}`:name(item.toWarehouseId??item.fromWarehouseId)}{item.note?` · ${item.note}`:''}</p><div><i>{item.status}</i></div></article>)}{!documents.length&&<div className="workflow-empty">暂无库存作业单据</div>}</div> }
function WarehouseBalances({products,warehouses,stocks}:{products:ProductCatalogItem[];warehouses:Warehouse[];stocks:WarehouseStock[]}) { return <div className="warehouse-grid">{warehouses.filter((item)=>item.active).map((warehouse)=><section key={warehouse.id}><header><b>{warehouse.name}</b><small>{warehouse.type}</small></header>{stocks.filter((item)=>item.warehouseId===warehouse.id&&item.quantity!==0).map((stock)=><div key={stock.productId}><span>{products.find((item)=>item.id===stock.productId)?.name??stock.productId}</span><strong>{moneylessNumber(stock.quantity)}</strong></div>)}{!stocks.some((item)=>item.warehouseId===warehouse.id&&item.quantity!==0)&&<p>暂无库存</p>}</section>)}</div> }
