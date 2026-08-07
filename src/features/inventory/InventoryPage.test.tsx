import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProductCatalogItem, SupplyDemand } from '../../types'
import { InventoryPage } from './InventoryPage'

const products: ProductCatalogItem[] = [{ id:'p1', sku:'CZ-001', name:'实木餐桌', category:'餐厅', specifications:['1.8m'], unitPrice:9800, costPrice:5600, supplyType:'现货', availableStock:3, reservedStock:1, safetyStock:2 }]
const demands: SupplyDemand[] = [{ id:'d1', orderId:'o1', orderNo:'SPJ0001', customerId:'c1', customerName:'张女士', orderItemId:'i1', productName:'实木沙发', specification:'三人位', quantity:1, supplyType:'定制生产', demandType:'生产需求', status:'待处理', createdAt:'2026-08-05', updatedAt:'2026-08-05' }]

describe('InventoryPage', () => {
  it('shows physical, reserved and available stock and records an adjustment', () => {
    const onAdjust = vi.fn()
    render(<InventoryPage products={products} demands={demands} movements={[]} operator="店长" onAddProduct={vi.fn()} onAdjust={onAdjust} onUpdateDemand={vi.fn()}/>)
    expect(screen.getByText('锁定 1.00 · 可用 2.00')).toBeTruthy()
    expect(screen.getByText('¥9,800.00')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name:'调整库存' }))
    fireEvent.change(screen.getByLabelText('调整数量'), { target:{ value:'5' } })
    fireEvent.click(screen.getByRole('button', { name:'确认调整' }))
    expect(onAdjust).toHaveBeenCalledWith('p1', 5, '库存调整', '店长', '人工盘点调整')
  })

  it('moves a custom factory demand into production', () => {
    const onUpdateDemand = vi.fn()
    render(<InventoryPage products={products} demands={demands} movements={[]} operator="店长" onAddProduct={vi.fn()} onAdjust={vi.fn()} onUpdateDemand={onUpdateDemand}/>)
    fireEvent.click(screen.getByRole('button', { name:/采购与工厂订单/ }))
    expect(screen.getAllByText('SPJ0001')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name:'开始生产' }))
    fireEvent.change(screen.getByLabelText('供应商 / 工厂'), { target:{ value:'揭阳合作工厂' } })
    fireEvent.change(screen.getByLabelText('采购单价'), { target:{ value:'6800' } })
    fireEvent.change(screen.getByLabelText('图纸版本'), { target:{ value:'V2 客户确认版' } })
    fireEvent.change(screen.getByLabelText('木材材质'), { target:{ value:'北美黑胡桃木' } })
    fireEvent.change(screen.getByLabelText('颜色/表面工艺'), { target:{ value:'原木色木蜡油' } })
    fireEvent.change(screen.getByLabelText('成品尺寸'), { target:{ value:'2200×950×800mm' } })
    fireEvent.click(screen.getByRole('button', { name:'确认下厂' }))
    expect(onUpdateDemand).toHaveBeenCalledWith('d1', expect.objectContaining({ status:'生产中', supplier:'揭阳合作工厂', unitCost:6800, payableStatus:'未对账', drawingVersion:'V2 客户确认版', woodMaterial:'北美黑胡桃木', productionProgress:'已下厂' }))
  })

  it('records qualified and rejected quantities during receiving inspection', () => {
    const onUpdateDemand = vi.fn()
    const purchasing: SupplyDemand = { ...demands[0], supplyType:'外采产品', demandType:'采购需求', status:'采购中', supplier:'床垫供应商', unitCost:4200, quantity:3 }
    render(<InventoryPage products={products} demands={[purchasing]} movements={[]} operator="店长" onAddProduct={vi.fn()} onAdjust={vi.fn()} onUpdateDemand={onUpdateDemand}/>)
    fireEvent.click(screen.getByRole('button', { name:/采购与工厂订单/ }))
    fireEvent.click(screen.getByRole('button', { name:'确认到货' }))
    fireEvent.change(screen.getByLabelText('本次合格数量'), { target:{ value:'2' } })
    fireEvent.change(screen.getByLabelText('本次不合格数量'), { target:{ value:'1' } })
    fireEvent.click(screen.getByRole('button', { name:'确认验收入库' }))
    expect(onUpdateDemand).toHaveBeenCalledWith('d1', expect.objectContaining({ status:'部分到货', receivedQuantity:2, rejectedQuantity:1, payableStatus:'待付款' }))
  })

  it('keeps cost and stock-changing actions behind back-office permissions', () => {
    render(<InventoryPage products={products} demands={demands} movements={[]} operator="销售" capabilities={{ manageCatalog:false, purchase:false, receive:false, audit:false, viewCost:false }} onAddProduct={vi.fn()} onAdjust={vi.fn()} onUpdateDemand={vi.fn()}/>)
    expect(screen.queryByRole('button', { name:'新增商品' })).toBeNull()
    expect(screen.queryByRole('button', { name:'调整库存' })).toBeNull()
    expect(screen.getByText('成本无查看权限')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name:/采购与工厂订单/ }))
    expect(screen.getByText('仅查看')).toBeTruthy()
  })
})
