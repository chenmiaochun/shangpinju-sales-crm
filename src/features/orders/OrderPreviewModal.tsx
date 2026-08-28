import { useRef, useState } from 'react'
import { Check, Eraser, PenLine, Printer, X } from 'lucide-react'
import { SHANGPINJU_LOGO } from '../../assets/shangpinju-brand'
import type { CustomerFile, SalesOrder } from '../../types'
import './order-print.css'

type Props = {
  order: SalesOrder
  onClose: () => void
  onUpdate: (id: string, changes: Partial<SalesOrder>) => void
}

const money = (value: number) => value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const received = (order: SalesOrder) => order.payments.reduce((sum, item) => sum + (item.type === '退款' ? -item.amount : item.amount), 0)
const dateText = (value?: string) => value ? value.slice(0, 10).replaceAll('-', ' / ') : '____ / __ / __'

export function amountToChinese(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '零元整'
  const digits = '零壹贰叁肆伍陆柒捌玖'
  const units = ['', '拾', '佰', '仟']
  const groups = ['', '万', '亿', '兆']
  const integer = Math.floor(Math.min(value, 9999999999999999))
  const fraction = Math.round((value - Math.floor(value)) * 100)
  const renderGroup = (group: number) => {
    let result = ''
    let zeroPending = false
    for (let index = 3; index >= 0; index--) {
      const divisor = 10 ** index
      const digit = Math.floor(group / divisor) % 10
      if (digit) {
        if (zeroPending && result) result += '零'
        result += digits[digit] + units[index]
        zeroPending = false
      } else if (result) zeroPending = true
    }
    return result
  }
  let remaining = integer
  let result = ''
  let groupIndex = 0
  let bridgeZero = false
  while (remaining > 0) {
    const group = remaining % 10000
    if (group) {
      const text = renderGroup(group) + groups[groupIndex]
      result = text + (bridgeZero && result ? '零' : '') + result
      bridgeZero = group < 1000
    } else if (result) bridgeZero = true
    remaining = Math.floor(remaining / 10000)
    groupIndex++
  }
  const jiao = Math.floor(fraction / 10)
  const fen = fraction % 10
  return `${result}元${jiao ? `${digits[jiao]}角` : ''}${fen ? `${digits[fen]}分` : '整'}`
}

export function SignaturePad({ onConfirm }: { onConfirm: (attachment: CustomerFile) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [width, setWidth] = useState(4)
  const [drawing, setDrawing] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x:(event.clientX - rect.left) * event.currentTarget.width / rect.width, y:(event.clientY - rect.top) * event.currentTarget.height / rect.height }
  }
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    const context = event.currentTarget.getContext('2d')
    const next = point(event)
    context?.beginPath(); context?.moveTo(next.x, next.y)
    setDrawing(true); setHasInk(true)
  }
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return
    event.preventDefault()
    const context = event.currentTarget.getContext('2d')
    const next = point(event)
    if (!context) return
    context.lineWidth = width
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#111'
    context.lineTo(next.x, next.y)
    context.stroke()
  }
  const clear = () => {
    const element = canvas.current
    element?.getContext('2d')?.clearRect(0, 0, element.width, element.height)
    setHasInk(false)
  }
  const confirm = () => {
    if (!canvas.current || !hasInk) return
    const dataUrl = canvas.current.toDataURL('image/png')
    onConfirm({ id:`signature-${Date.now()}`, name:'客户电子签名.png', type:'image/png', size:dataUrl.length, dataUrl, category:'签名回单', uploadedAt:new Date().toISOString() })
  }
  return <div className="signature-pad no-print"><canvas ref={canvas} width="700" height="180" aria-label="客户电子签名板" onPointerDown={start} onPointerMove={move} onPointerUp={() => setDrawing(false)} onPointerCancel={() => setDrawing(false)}/><div><label>笔画粗细<select value={width} onChange={(event) => setWidth(Number(event.target.value))}><option value="2">细</option><option value="4">中</option><option value="7">粗</option></select></label><button type="button" onClick={clear}><Eraser/>清空重签</button><button type="button" disabled={!hasInk} onClick={confirm}><PenLine/>确认签名</button></div></div>
}

export function OrderPreviewModal({ order, onClose, onUpdate }: Props) {
  const [message, setMessage] = useState('')
  const [printMode, setPrintMode] = useState<'quote' | 'sales'>(order.status === '草稿' ? 'quote' : 'sales')
  const rows = [...(order.items ?? []), ...Array.from({ length: Math.max(0, 10 - (order.items?.length ?? 0)) }, () => null)]
  const deposit = received(order)
  const signature = order.signatureFiles?.find((file) => file.category === '签名回单' && file.dataUrl)
  const handlePrint = () => {
    onUpdate(order.id, { printedAt:new Date().toISOString() })
    window.print()
  }
  const saveSignature = (attachment: CustomerFile) => {
    onUpdate(order.id, { signatureFiles:[...(order.signatureFiles ?? []).filter((file) => file.category !== '签名回单'), attachment], signatureUploadedAt:new Date().toISOString(), status:'已签名已确认' })
    setMessage('电子签名已保存，订单已标记为“已签名已确认”')
  }
  return <div className="order-preview-backdrop" role="dialog" aria-modal="true" aria-label="订货单预览">
    <section className="order-preview-shell">
      <header className="preview-toolbar">
        <div><b>订货单预览</b><span>{order.status}</span></div>
        <div className="preview-toolbar-modes no-print">
          <button type="button" className={`pm-mode-btn${printMode === 'quote' ? ' active' : ''}`} onClick={() => setPrintMode('quote')}>报价单样式</button>
          <button type="button" className={`pm-mode-btn${printMode === 'sales' ? ' active' : ''}`} onClick={() => setPrintMode('sales')}>销售单样式</button>
        </div>
        <div>
          {printMode === 'quote' && <label className="preview-quote-valid no-print">有效期至<input type="date" value={order.quoteValidUntil?.slice(0, 10) ?? ''} onChange={(event) => onUpdate(order.id, { quoteValidUntil: event.target.value })} /></label>}
          <button onClick={handlePrint}><Printer/>打印订单</button>
          <button aria-label="关闭预览" onClick={onClose}><X/></button>
        </div>
      </header>
      {message && <p className="preview-message" role="status">{message}</p>}
      <article className="sales-order-sheet">
        <header className="sheet-title"><div><img src={SHANGPINJU_LOGO} alt="尚品居"/><span><b>尚品居</b><small>原创家具</small></span></div><h1>{printMode === 'quote' ? '尚品居产品报价单' : '尚品居产品销售单'}</h1><strong>{order.orderNo}</strong>{order.urgent && <span className="sheet-urgent-badge">加急</span>}</header>
        {printMode === 'quote' ? (
          <div className="sheet-meta"><span>报价日期：<b>{dateText(order.signedAt)}</b></span><span>有效期至：<b>{dateText(order.quoteValidUntil)}</b></span><span>客户：<b>{order.customerName}</b></span></div>
        ) : (
          <div className="sheet-meta"><span>类型：<b>{['订货','现货','退货'].map((type) => `${type}（${order.orderType === type ? '✓' : '　'}）`).join('　')}</b></span><span>开单日期：{dateText(order.signedAt)}</span><span>送货日期：{dateText(order.expectedDeliveryAt)}</span></div>
        )}
        <div className="sheet-customer"><span>客户名称：<b>{order.customerName}</b></span><span>联系方式：<b>{order.contactPhone || ''}</b></span><span>送货地址：<b>{order.deliveryAddress || ''}</b></span></div>
        <table><thead><tr><th>型号名称</th><th>规格尺寸</th><th>数量</th><th>单位</th><th>材质</th><th>单价</th><th>金额</th><th>备注</th></tr></thead><tbody>{rows.map((item, index) => <tr key={item?.id ?? `empty-${index}`}><td>{item?.productName}</td><td>{item?.specification || item?.dimensions}</td><td>{item?.quantity}</td><td>{item?.unit}</td><td>{item?.material}</td><td>{item ? money(item.unitPrice) : ''}</td><td>{item ? money(item.quantity * item.unitPrice) : ''}</td><td>{item?.lineNote || item?.customRequirement}</td></tr>)}</tbody></table>
        {(order.items ?? []).some((item) => item.skuLines?.length) && <div className="sheet-components"><h2>组件明细（送货验收对照）</h2>{(order.items ?? []).filter((item) => item.skuLines?.length).map((item) => item.packageId ? <div className="sheet-component-group package-group" key={item.id}><b>{item.productName} ×{item.quantity}（{item.packageCode}）</b>{(item.packageItems ?? []).map((entry) => <div className="sheet-component-subgroup" key={entry.productId}><b className="subgroup-title">{entry.productName} ×{entry.quantity}（{entry.productCode}）</b><table><thead><tr><th>组件</th><th>规格</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>{entry.skuLines.map((line) => <tr key={line.skuUnitId}><td>{line.componentName}{line.optional ? '（选配）' : ''}</td><td>{line.specSummary}</td><td>{line.quantity * entry.quantity * item.quantity}</td><td>{money(line.unitPrice)}</td><td>{money(line.unitPrice * line.quantity * entry.quantity * item.quantity)}</td></tr>)}</tbody></table></div>)}<table><tbody><tr className="component-group-total"><td colSpan={4}>套餐组合价（含套餐调整）</td><td>{money(item.unitPrice * item.quantity)}</td></tr></tbody></table></div> : <div className="sheet-component-group" key={item.id}><b>{item.productName} ×{item.quantity}{item.configProductCode ? `（${item.configProductCode}）` : ''}</b><table><thead><tr><th>组件</th><th>规格</th><th>数量</th><th>单价</th><th>小计</th></tr></thead><tbody>{item.skuLines!.map((line) => <tr key={line.skuUnitId}><td>{line.componentName}{line.optional ? '（选配）' : ''}</td><td>{line.specSummary}</td><td>{line.quantity * item.quantity}</td><td>{money(line.unitPrice)}</td><td>{money(line.unitPrice * line.quantity * item.quantity)}</td></tr>)}<tr className="component-group-total"><td colSpan={4}>单品组合价（含配置调整）</td><td>{money(item.unitPrice * item.quantity)}</td></tr></tbody></table></div>)}</div>}
        <div className="sheet-totals"><span>其他费用：<b>¥{money(order.otherFee ?? 0)}</b></span><span>总金额：<b>¥{money(order.contractAmount)}</b></span>{printMode === 'sales' && <span>实收金额：<b>¥{money(order.contractAmount)}</b></span>}{printMode === 'sales' && <span>已收订金：<b>¥{money(deposit)}</b></span>}{printMode === 'sales' && <strong>实收金额合计：{amountToChinese(order.contractAmount)}</strong>}</div>
        <div className="sheet-note"><b>备注：</b><span>{order.note}</span></div>
        <div className="sheet-signatures"><span>开单人员：<b>{order.opener || order.salesperson}</b></span><span>跟单人员：<b>{order.follower || order.salesperson}</b></span>{printMode === 'sales' && <span>送货人员：<b>{order.deliveryPerson || ''}</b></span>}{printMode === 'sales' && <span className="customer-signature">客户签名：{signature?.dataUrl && <img src={signature.dataUrl} alt="客户电子签名"/>}</span>}</div>
        {printMode === 'sales' && !signature && <SignaturePad onConfirm={saveSignature}/>} 
        {printMode === 'quote' ? (
          <ol className="sheet-terms">
            <li>本报价单有效期至 {dateText(order.quoteValidUntil)}，逾期价格以最新报价为准。</li>
            <li>报价含标准配置；选配及定制项目以双方确认为准。</li>
            <li>本报价单仅供价格参考，最终以下单时正式销售单为准。</li>
          </ol>
        ) : (
          <ol className="sheet-terms"><li>货期自订单确认及定金到账之日起计算；定制产品以双方确认时间为准。</li><li>定制产品按确认的型号、规格、材质和颜色生产，确认后原则上不作变更。</li><li>客户应在送货前结清约定款项，并确保送货通道、电梯及安装现场具备条件。</li><li>送货日期如需调整，请提前联系跟单人员；不可抗力造成的延期双方另行协商。</li><li>客户收货时应现场检查数量及外观，确认无误后签名；异常应在单据上注明。</li><li>产品保养、维修及售后服务按尚品居相关服务标准执行。</li><li>本销售单一式两份，客户与门店各执一份，签字后具有确认效力。</li></ol>
        )}
        <footer>公司地址：广东省揭阳市揭东区北环大道与金山路交汇处（尚品居原创家具）　营业时间：周一至周日 9:00-22:00</footer>
      </article>
      <footer className="preview-actions"><label><input type="checkbox" checked={Boolean(order.customerCopyGiven)} onChange={(event) => onUpdate(order.id, { customerCopyGiven:event.target.checked })}/><Check/>{printMode === 'quote' ? '已打印/发送报价单' : '已打印客户联并交给客户'}</label>{signature && <span className="signature-saved"><Check/>电子签名已永久保存</span>}</footer>
    </section>
  </div>
}
