import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesDataProvider, useSalesData } from './SalesDataContext'
import type {
  Customer,
  OrderItem,
  ProductCatalogItem,
  SalesOrder,
  SkuUnit,
  SupplyDemand,
} from '../types'

// Phase 4.1：SKU 库存闭环回归——取消订单释放 SKU 预留（断层 A）、
// 外采需求到货入 SKU 库存并留流水（断层 B）、老商品路径不回归。
vi.mock('../api/salesApi', () => ({
  salesApi: {
    getState: vi.fn(async () => { throw new Error('offline') }),
    getDesigners: vi.fn(async () => ({ designers: [] })),
    getSalespeople: vi.fn(async () => ({ salespeople: [] })),
    getDeliveryStaff: vi.fn(async () => ({ deliveryStaff: [] })),
    getAudit: vi.fn(async () => ({ items: [] })),
    getIntegrations: vi.fn(async () => ({ integrations: {} })),
    putState: vi.fn(),
  },
}))

let api: ReturnType<typeof useSalesData> | null = null
function Probe() {
  api = useSalesData()
  return null
}

const customer: Customer = {
  id: 'cus-1',
  name: '测试客户',
  salesperson: '吴销售',
  phone: '',
  source: '导入',
  stage: '已定金',
  intent: '高',
  expectedAmount: 6800,
  products: [],
  style: '',
  budget: '',
  renovationProgress: '',
  concerns: [],
  lastContactAt: '2026-08-26',
  createdAt: '2026-08-26',
}

const skuUnits: SkuUnit[] = [
  {
    id: 'unit-1',
    componentId: 'comp-1',
    sku: 'CTM-1.8M-HZW',
    specValues: { 尺寸: '1.8m' },
    unitPrice: 3000,
    costPrice: 1800,
    supplyType: '现货',
    availableStock: 5,
    reservedStock: 2,
    safetyStock: 1,
    status: '上架',
  },
  {
    id: 'unit-2',
    componentId: 'comp-2',
    sku: 'CTJ-KZ-HZW',
    specValues: { 材质: '黑胡桃' },
    unitPrice: 900,
    costPrice: 500,
    supplyType: '外采产品',
    availableStock: 0,
    reservedStock: 0,
    safetyStock: 0,
    status: '上架',
  },
]

const legacyProduct: ProductCatalogItem = {
  id: 'prod-1',
  sku: 'OLD-SOFA-01',
  name: '老商品沙发',
  specifications: [],
  unitPrice: 8800,
  supplyType: '现货',
  availableStock: 3,
  reservedStock: 1,
}

const orderItems: OrderItem[] = [
  {
    id: 'item-1',
    productName: '1.8m 圆餐桌',
    quantity: 1,
    unitPrice: 6800,
    supplyType: '现货',
    configProductId: 'sp-1',
    skuLines: [
      {
        skuUnitId: 'unit-1',
        sku: 'CTM-1.8M-HZW',
        componentId: 'comp-1',
        componentName: '台面',
        specSummary: '尺寸：1.8m',
        quantity: 2,
        unitPrice: 3000,
        supplyType: '现货',
        optional: false,
      },
      {
        skuUnitId: 'unit-2',
        sku: 'CTJ-KZ-HZW',
        componentId: 'comp-2',
        componentName: '岩板转盘',
        specSummary: '材质：黑胡桃',
        quantity: 3,
        unitPrice: 900,
        supplyType: '外采产品',
        optional: true,
      },
    ],
  },
  { id: 'item-2', productId: 'prod-1', productName: '老商品沙发', quantity: 1, unitPrice: 8800, supplyType: '现货' },
  { id: 'item-3', productId: 'prod-1', productName: '老商品沙发（换货备用）', quantity: 1, unitPrice: 8800, supplyType: '外采产品' },
]

const order: SalesOrder = {
  id: 'order-1',
  orderNo: 'XS-20260826-01',
  customerId: 'cus-1',
  customerName: '测试客户',
  salesperson: '吴销售',
  collaborators: [],
  products: [],
  items: orderItems,
  contractAmount: 6800,
  signedAt: '2026-08-26',
  status: '备货中',
  payments: [],
  performanceRate: 0,
  createdAt: '2026-08-26',
  updatedAt: '2026-08-26',
}

const supplyDemands: SupplyDemand[] = [
  {
    id: 'd-sku-lock',
    orderId: 'order-1',
    orderNo: 'XS-20260826-01',
    customerId: 'cus-1',
    customerName: '测试客户',
    orderItemId: 'item-1',
    productName: '1.8m 圆餐桌 · 台面',
    specification: '尺寸：1.8m',
    quantity: 2,
    supplyType: '现货',
    demandType: '库存锁定',
    status: '已锁定',
    skuUnitId: 'unit-1',
    sku: 'CTM-1.8M-HZW',
    createdAt: '2026-08-26',
    updatedAt: '2026-08-26',
  },
  {
    id: 'd-sku-buy',
    orderId: 'order-1',
    orderNo: 'XS-20260826-01',
    customerId: 'cus-1',
    customerName: '测试客户',
    orderItemId: 'item-1',
    productName: '1.8m 圆餐桌 · 岩板转盘',
    specification: '材质：黑胡桃',
    quantity: 3,
    supplyType: '外采产品',
    demandType: '采购需求',
    status: '待处理',
    skuUnitId: 'unit-2',
    sku: 'CTJ-KZ-HZW',
    createdAt: '2026-08-26',
    updatedAt: '2026-08-26',
  },
  {
    id: 'd-legacy-lock',
    orderId: 'order-1',
    orderNo: 'XS-20260826-01',
    customerId: 'cus-1',
    customerName: '测试客户',
    orderItemId: 'item-2',
    productName: '老商品沙发',
    quantity: 1,
    supplyType: '现货',
    demandType: '库存锁定',
    status: '已锁定',
    createdAt: '2026-08-26',
    updatedAt: '2026-08-26',
  },
  {
    id: 'd-legacy-buy',
    orderId: 'order-1',
    orderNo: 'XS-20260826-01',
    customerId: 'cus-1',
    customerName: '测试客户',
    orderItemId: 'item-3',
    productName: '老商品沙发（换货备用）',
    quantity: 4,
    supplyType: '外采产品',
    demandType: '采购需求',
    status: '待处理',
    createdAt: '2026-08-26',
    updatedAt: '2026-08-26',
  },
]

const STORAGE_KEY = 'shangpinju.customer-followup.v1'

function seed() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      customers: [customer],
      followUps: [],
      designTasks: [],
      orders: [order],
      deliveryTasks: [],
      afterSalesTickets: [],
      supplyDemands,
      products: [legacyProduct],
      skuUnits,
      inventoryMovements: [],
    }),
  )
}

beforeEach(() => {
  window.localStorage.clear()
  seed()
  api = null
})

describe('Phase 4.1 SKU 库存闭环', () => {
  it('取消生效订单时同步释放 SKU 与老商品预留，未锁定需求不误放库存', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    // 等待 Provider 完成首次异步同步（getState 抛错 → offline）
    await act(async () => {})
    expect(api).not.toBeNull()

    await act(async () => {
      api!.cancelOrder('order-1', '老板')
    })

    const unit1 = api!.skuUnits.find((unit) => unit.id === 'unit-1')
    const unit2 = api!.skuUnits.find((unit) => unit.id === 'unit-2')
    const product = api!.products.find((item) => item.id === 'prod-1')
    // 断层 A：SKU 预留按锁定量释放（2 → 0）
    expect(unit1?.reservedStock).toBe(0)
    // 外采需求是「待处理」（未锁库存），取消不应动它的预留
    expect(unit2?.reservedStock).toBe(0)
    // 老商品路径回归：预留 1 → 0
    expect(product?.reservedStock).toBe(0)
    // 需求与订单状态
    expect(
      api!.supplyDemands
        .filter((demand) => demand.orderId === 'order-1')
        .every((demand) => demand.status === '已取消'),
    ).toBe(true)
    expect(api!.orders.find((item) => item.id === 'order-1')?.status).toBe('已取消')
  })

  it('外采 SKU 需求到货验收后入 SKU 库存、为客户预留并生成流水', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    await act(async () => {
      api!.updateSupplyDemand('d-sku-buy', {
        status: '已到货',
        receivedQuantity: 3,
        supplier: '东莞岩板厂',
      })
    })

    const unit2 = api!.skuUnits.find((unit) => unit.id === 'unit-2')
    // 断层 B：到货入库存并为该订单客户预留
    expect(unit2?.availableStock).toBe(3)
    expect(unit2?.reservedStock).toBe(3)

    const movement = api!.inventoryMovements[0]
    expect(movement).toBeDefined()
    expect(movement.type).toBe('采购入库')
    expect(movement.quantity).toBe(3)
    expect(movement.beforeStock).toBe(0)
    expect(movement.afterStock).toBe(3)
    expect(movement.skuUnitId).toBe('unit-2')
    expect(movement.sku).toBe('CTJ-KZ-HZW')
    expect(movement.productName).toBe('1.8m 圆餐桌 · 岩板转盘')
    expect(movement.operator).toBe('东莞岩板厂')
    // SKU 流水不填老商品 productId
    expect(movement.productId).toBeUndefined()
    expect(movement.note).toContain('XS-20260826-01')

    // 同订单还有一条老商品采购需求「待处理」，整单为部分齐货
    expect(api!.orders.find((item) => item.id === 'order-1')?.status).toBe('部分齐货')
  })

  it('老商品采购需求到货仍走原路径（products 入库 + 流水）', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    await act(async () => {
      api!.updateSupplyDemand('d-legacy-buy', {
        status: '已到货',
        receivedQuantity: 4,
        supplier: '佛山老供应商',
      })
    })

    const product = api!.products.find((item) => item.id === 'prod-1')
    expect(product?.availableStock).toBe(7)
    expect(product?.reservedStock).toBe(5)

    const movement = api!.inventoryMovements[0]
    expect(movement.type).toBe('采购入库')
    expect(movement.quantity).toBe(4)
    expect(movement.productId).toBe('prod-1')
    expect(movement.operator).toBe('佛山老供应商')
    // 老路径不动 SKU 台账
    expect(api!.skuUnits.find((unit) => unit.id === 'unit-2')?.availableStock).toBe(0)
  })
})

describe('4.7 importProductMaster 批量导入合并', () => {
  it('将 categories/components/skuUnits 合并进现有集合', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    const catBefore = api!.categories.length
    const compBefore = api!.components.length
    const skuBefore = api!.skuUnits.length

    await act(async () => {
      api!.importProductMaster({
        categories: [{ id: 'nc-1', name: '新大类', code: 'NC', sort: 0 }],
        components: [
          { id: 'nc-1-c', categoryId: 'nc-1', code: 'NCC', name: '新主件', sort: 0, specDims: [] },
        ],
        skuUnits: [
          {
            id: 'nc-1-s',
            componentId: 'nc-1-c',
            sku: 'NCC-1',
            specValues: {},
            unitPrice: 1,
            costPrice: 0,
            supplyType: '现货',
            availableStock: 0,
            reservedStock: 0,
            safetyStock: 0,
            status: '上架',
          },
        ],
      })
    })

    expect(api!.categories.length).toBe(catBefore + 1)
    expect(api!.components.length).toBe(compBefore + 1)
    expect(api!.skuUnits.length).toBe(skuBefore + 1)
    expect(api!.categories.find((c) => c.id === 'nc-1')).toBeTruthy()
    expect(api!.skuUnits.find((s) => s.sku === 'NCC-1')).toBeTruthy()
  })
})

describe('产品系列 moveComponentsToSeries 批量迁移', () => {
  it('按主件 id 批量写入 seriesId，其余主件不受影响；undefined 迁回公共/其他', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    // 预置 3 个主件：a 无系列、b 属 series-x、c 无系列（公共/其他）
    await act(async () => {
      api!.importProductMaster({
        categories: [{ id: 'cat-s', name: '系列测试大类', code: 'SC', sort: 0 }],
        series: [
          { id: 'series-x', categoryId: 'cat-s', name: '五福系列', sort: 0 },
          { id: 'series-y', categoryId: 'cat-s', name: '尚品系列', sort: 0 },
        ],
        components: [
          { id: 'mc-a', categoryId: 'cat-s', code: 'SC-A', name: '通用五金', sort: 0, specDims: [] },
          { id: 'mc-b', categoryId: 'cat-s', code: 'SC-B', name: '五福框架', sort: 0, specDims: [], seriesId: 'series-x' },
          { id: 'mc-c', categoryId: 'cat-s', code: 'SC-C', name: '通用脚件', sort: 0, specDims: [] },
        ],
      })
    })

    // 批量迁移 a、c 到尚品系列
    await act(async () => {
      api!.moveComponentsToSeries(['mc-a', 'mc-c'], 'series-y')
    })
    expect(api!.components.find((c) => c.id === 'mc-a')?.seriesId).toBe('series-y')
    expect(api!.components.find((c) => c.id === 'mc-c')?.seriesId).toBe('series-y')
    // 其余主件不受影响
    expect(api!.components.find((c) => c.id === 'mc-b')?.seriesId).toBe('series-x')

    // 把 mc-a 迁回公共/其他（seriesId 归一化为 undefined）
    await act(async () => {
      api!.moveComponentsToSeries(['mc-a'], undefined)
    })
    expect(api!.components.find((c) => c.id === 'mc-a')?.seriesId).toBeUndefined()
    expect(api!.components.find((c) => c.id === 'mc-c')?.seriesId).toBe('series-y')
    expect(api!.components.find((c) => c.id === 'mc-b')?.seriesId).toBe('series-x')
  })
})

describe('4.4 售后接入（断层 C 修复：产品库单品/套餐行退货/换货走 SKU）', () => {
  it('单品行退货按 skuLines 回加 SKU 库存并释放预留，订单置退货中', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    await act(async () => {
      api!.returnOrderItem('order-1', 'item-1', 1, '质量问题', '店长')
    })

    const unit1 = api!.skuUnits.find((u) => u.id === 'unit-1')!
    const unit2 = api!.skuUnits.find((u) => u.id === 'unit-2')!
    // item-1 skuLines：unit-1 用量 2、unit-2 用量 3；退货数量 1 → +2 / +3
    expect(unit1.availableStock).toBe(5 + 2)
    expect(unit1.reservedStock).toBe(0) // 原预留 2 已释放
    expect(unit2.availableStock).toBe(0 + 3)
    // 流水记录含 skuUnitId
    expect(
      api!.inventoryMovements.some(
        (m) => m.skuUnitId === 'unit-1' && m.type === '退货入库',
      ),
    ).toBe(true)
    const ord = api!.orders.find((o) => o.id === 'order-1')!
    expect(ord.status).toBe('退货中')
    expect(ord.returnRecords?.[0].skuUnitIds).toEqual(['unit-1', 'unit-2'])
  })

  it('老商品行退货仍走老商品路径，不动 SKU 台账', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    await act(async () => {
      api!.returnOrderItem('order-1', 'item-2', 1, '客户不喜欢', '店长')
    })

    expect(api!.products.find((p) => p.id === 'prod-1')!.availableStock).toBe(4)
    expect(
      api!.inventoryMovements.some((m) => m.productId === 'prod-1'),
    ).toBe(true)
    // 老路径不产生 SKU 流水
    expect(api!.inventoryMovements.some((m) => m.skuUnitId)).toBe(false)
  })

  it('单品行换货按 skuLines 回加旧 SKU 库存，并扣减新选老商品', async () => {
    render(<SalesDataProvider><Probe /></SalesDataProvider>)
    await act(async () => {})

    await act(async () => {
      api!.exchangeOrderItem('order-1', 'item-1', 'prod-1', 1, '换货', '店长')
    })

    // 旧行 item-1 回库：unit-1 +2→7、unit-2 +3→3
    expect(api!.skuUnits.find((u) => u.id === 'unit-1')!.availableStock).toBe(7)
    expect(api!.skuUnits.find((u) => u.id === 'unit-2')!.availableStock).toBe(3)
    // 新选老商品 prod-1 扣 1：3 → 2
    expect(api!.products.find((p) => p.id === 'prod-1')!.availableStock).toBe(2)
    const ord = api!.orders.find((o) => o.id === 'order-1')!
    expect(ord.status).toBe('换货中')
    expect(ord.exchangeRecords?.[0].oldSkuUnitIds).toEqual(['unit-1', 'unit-2'])
  })
})
