import { useState } from 'react'
import { X } from 'lucide-react'
import type { SupplyDemand } from '../../types'

export function SupplyDemandDialog({ demand, onClose, onSubmit }: { demand: SupplyDemand; onClose: () => void; onSubmit: (changes: Partial<SupplyDemand>) => void }) {
  const ordering = demand.status === '待处理'
  const received = demand.receivedQuantity ?? 0
  const [supplier, setSupplier] = useState(demand.supplier ?? '')
  const [unitCost, setUnitCost] = useState(demand.unitCost ?? 0)
  const [expectedAt, setExpectedAt] = useState(demand.expectedAt ?? '')
  const [accepted, setAccepted] = useState(Math.max(0, demand.quantity - received))
  const [rejected, setRejected] = useState(0)
  const [inspectionNote, setInspectionNote] = useState(demand.inspectionNote ?? '')
  const [payableStatus, setPayableStatus] = useState<SupplyDemand['payableStatus']>(demand.payableStatus ?? '未对账')
  const remaining = Math.max(0, demand.quantity - received)

  const submit = () => {
    const now = new Date().toISOString()
    if (ordering) onSubmit({ supplier: supplier.trim(), unitCost, expectedAt: expectedAt || undefined, orderedAt: now, payableStatus: '未对账', status: demand.supplyType === '定制生产' ? '生产中' : '采购中' })
    else if (demand.status === '已到货') onSubmit({ payableStatus })
    else { const receivedQuantity = received + accepted; onSubmit({ supplier: supplier.trim() || demand.supplier, unitCost: unitCost || demand.unitCost, receivedQuantity, rejectedQuantity: (demand.rejectedQuantity ?? 0) + rejected, inspectionNote: inspectionNote.trim(), receivedAt: now, payableStatus: receivedQuantity > 0 ? '待付款' : demand.payableStatus, status: receivedQuantity >= demand.quantity ? '已到货' : '部分到货' }) }
  }

  return <div className="inventory-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="inventory-dialog" role="dialog" aria-modal="true" aria-label={`${ordering ? '建立采购生产单' : demand.status === '已到货' ? '采购对账' : '到货验收'} · ${demand.productName}`}><header><div><h2>{ordering ? '建立采购 / 工厂订单' : demand.status === '已到货' ? '采购应付对账' : '到货验收'}</h2><p>{demand.orderNo} · {demand.customerName} · {demand.productName}</p></div><button aria-label="关闭" onClick={onClose}><X/></button></header><div className="inventory-dialog-body"><section className="demand-overview"><span>订购数量<strong>{demand.quantity}</strong></span><span>累计合格<strong>{received}</strong></span><span>待到货<strong>{remaining}</strong></span><span>累计不合格<strong>{demand.rejectedQuantity ?? 0}</strong></span></section>{ordering ? <div className="demand-form"><label>供应商 / 工厂<input aria-label="供应商 / 工厂" required value={supplier} onChange={(event) => setSupplier(event.target.value)}/></label><label>采购单价<input aria-label="采购单价" type="number" min="0" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))}/></label><label>预计到货日期<input aria-label="预计到货日期" type="date" value={expectedAt} onChange={(event) => setExpectedAt(event.target.value)}/></label></div> : demand.status === '已到货' ? <div className="demand-form"><label>应付状态<select aria-label="应付状态" value={payableStatus} onChange={(event) => setPayableStatus(event.target.value as SupplyDemand['payableStatus'])}><option>未对账</option><option>待付款</option><option>部分付款</option><option>已付款</option></select></label><div className="payable-total">应付金额<strong>¥{((demand.unitCost ?? 0) * received).toLocaleString()}</strong></div></div> : <div className="demand-form"><label>本次合格数量<input aria-label="本次合格数量" type="number" min="0" max={remaining} value={accepted} onChange={(event) => setAccepted(Number(event.target.value))}/></label><label>本次不合格数量<input aria-label="本次不合格数量" type="number" min="0" value={rejected} onChange={(event) => setRejected(Number(event.target.value))}/></label><label className="wide">验收说明<textarea aria-label="验收说明" rows={3} value={inspectionNote} onChange={(event) => setInspectionNote(event.target.value)} placeholder="破损、少件、色差及处理方式"/></label></div>}<p className="inventory-dialog-note">合格数量进入库存并锁定到客户订单；不合格品不入可用库存，保留验收记录。</p></div><footer><button onClick={onClose}>取消</button><button className="primary" disabled={ordering ? !supplier.trim() : demand.status !== '已到货' && accepted + rejected <= 0} onClick={submit}>{ordering ? demand.supplyType === '定制生产' ? '确认下厂' : '确认采购' : demand.status === '已到货' ? '保存对账状态' : '确认验收入库'}</button></footer></section></div>
}
