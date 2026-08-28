import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ConfigProduct, OrderItem, ProductCatalogItem, ProductCategory, SalesOrder, SkuUnit } from '../../types'
import { customers, followUps } from '../../data'
import { SalesInsightsPage } from './SalesInsightsPage'

const now = new Date('2026-07-30T12:00:00+08:00')

const categories: ProductCategory[] = [{ id: 'cat-1', name: '餐桌类', code: 'CT', sort: 1 }]
const configProducts: ConfigProduct[] = [
  {
    id: 'sp-1',
    categoryId: 'cat-1',
    name: '1.8m 黑胡桃圆餐桌',
    code: 'SP-CT-001',
    sortOrder: 1,
    components: [{ componentId: 'comp-1', quantity: 1, optional: false }],
    adjustPrice: 0,
    status: '上架',
  },
]
const skuUnits: SkuUnit[] = [
  {
    id: 'unit-1',
    componentId: 'comp-1',
    sku: 'CTM-1.8M-HZW',
    specValues: {},
    unitPrice: 6800,
    costPrice: 3000,
    supplyType: '现货',
    availableStock: 5,
    reservedStock: 0,
    safetyStock: 1,
    status: '上架',
  },
]
const legacyProducts: ProductCatalogItem[] = [
  { id: 'lp-1', sku: 'OLD-1', name: '老商品沙发', specifications: [], unitPrice: 8800, supplyType: '现货', availableStock: 3, costPrice: 5000, category: '沙发类' },
]

const orders = [
  {
    id: 'o1',
    orderNo: 'XS-20260720-01',
    customerId: 'c1',
    customerName: '测试客户',
    salesperson: '小林',
    collaborators: [],
    products: [],
    items: [
      {
        id: 'i1',
        productName: '1.8m 黑胡桃圆餐桌',
        quantity: 2,
        unitPrice: 6800,
        supplyType: '现货',
        configProductId: 'sp-1',
        skuLines: [
          { skuUnitId: 'unit-1', sku: 'CTM-1.8M-HZW', componentId: 'comp-1', componentName: '台面', specSummary: '', quantity: 1, unitPrice: 6800, supplyType: '现货', optional: false },
        ],
      },
      { id: 'i2', productName: '老商品沙发', quantity: 1, unitPrice: 8800, supplyType: '现货', productId: 'lp-1' },
    ] as OrderItem[],
    contractAmount: 22400,
    signedAt: '2026-07-20',
    status: '已生效',
    payments: [],
    performanceRate: 0,
    createdAt: '2026-07-20',
    updatedAt: '2026-07-20',
  } as SalesOrder,
]

describe('SalesInsightsPage', () => {
  it('renders every insight section and switches periods', () => {
    render(<SalesInsightsPage customers={customers} followUps={followUps} now={now} />)
    expect(screen.getByRole('heading', { name: '从数据找到下一步增长' })).toBeInTheDocument()
    expect(screen.getByText('业务趋势')).toBeInTheDocument()
    expect(screen.getByText('来源质量')).toBeInTheDocument()
    expect(screen.getByText('阶段停留风险')).toBeInTheDocument()
    expect(screen.getByText('跟进活动质量')).toBeInTheDocument()
    expect(screen.getByText('丢单原因')).toBeInTheDocument()
    expect(screen.getByText('销售辅导建议')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '近7天' }))
    expect(screen.getByRole('button', { name: '近7天' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('近7天动作完整度')).toBeInTheDocument()
  })

  it('shows a complete empty state', () => {
    render(<SalesInsightsPage customers={[]} followUps={[]} now={now} />)
    expect(screen.getByText('暂无经营数据')).toBeInTheDocument()
    expect(screen.getByText(/录入客户与跟进记录后/)).toBeInTheDocument()
  })

  it('4.6 商品销售分析：订单聚合单品/老商品、品类占比，无订单时提示', () => {
    render(
      <SalesInsightsPage
        customers={[]}
        followUps={[]}
        orders={orders}
        configProducts={configProducts}
        productPackages={[]}
        skuUnits={skuUnits}
        categories={categories}
        legacyProducts={legacyProducts}
        canViewCost={false}
        now={now}
      />,
    )
    expect(screen.getByText('商品销售分析')).toBeInTheDocument()
    expect(screen.getByText('商品销售排名')).toBeInTheDocument()
    expect(screen.getByText('品类销售占比')).toBeInTheDocument()
    // 单品与老商品均被聚合
    expect(screen.getByText('1.8m 黑胡桃圆餐桌')).toBeInTheDocument()
    expect(screen.getByText('老商品沙发')).toBeInTheDocument()
    // 品类按销售额归类
    expect(screen.getByText('餐桌类')).toBeInTheDocument()
    expect(screen.getByText('沙发类')).toBeInTheDocument()
    // 无 cost.view → 毛利区块不出现
    expect(screen.queryByText('毛利分析')).toBeNull()
  })

  it('4.6 毛利分析仅在 cost.view 时可见，成本按 SKU 实时核算', () => {
    render(
      <SalesInsightsPage
        customers={[]}
        followUps={[]}
        orders={orders}
        configProducts={configProducts}
        productPackages={[]}
        skuUnits={skuUnits}
        categories={categories}
        legacyProducts={legacyProducts}
        canViewCost
        now={now}
      />,
    )
    expect(screen.getByText('毛利分析')).toBeInTheDocument()
    // 单品毛利率 (6800*2-3000*2)/(6800*2)=56%；老商品 (8800-5000)/8800=43%（排名与毛利表各出现一次）
    expect(screen.getAllByText('56%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('43%').length).toBeGreaterThan(0)
    // 综合毛利率 (22400-11000)/22400≈51%（仅毛利摘要唯一出现）
    expect(screen.getByText('51%')).toBeInTheDocument()
  })
})
