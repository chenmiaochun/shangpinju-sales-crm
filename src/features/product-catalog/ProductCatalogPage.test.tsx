import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesDataProvider } from '../../store/SalesDataContext'
import { ProductCatalogPage } from './ProductCatalogPage'

// 4.5 产品目录页：渲染上架单品/套餐卡片、筛选、详情抽屉。成本不出现。
vi.mock('../../api/salesApi', () => ({
  salesApi: {
    getState: vi.fn(async () => {
      throw new Error('offline')
    }),
    getDesigners: vi.fn(async () => ({ designers: [] })),
    getSalespeople: vi.fn(async () => ({ salespeople: [] })),
    getDeliveryStaff: vi.fn(async () => ({ deliveryStaff: [] })),
    getAudit: vi.fn(async () => ({ items: [] })),
    getIntegrations: vi.fn(async () => ({ integrations: {} })),
    putState: vi.fn(),
  },
}))

const STORAGE_KEY = 'shangpinju.customer-followup.v1'

const categories = [{ id: 'cat-1', name: '餐桌类', code: 'CT', sort: 1 }]

const skuUnits = [
  {
    id: 'unit-1',
    componentId: 'comp-1',
    sku: 'CTM-1.8M-HZW',
    specValues: { 尺寸: '1.8m', 材质: '黑胡桃' },
    unitPrice: 6800,
    costPrice: 3000,
    supplyType: '现货' as const,
    availableStock: 5,
    reservedStock: 0,
    safetyStock: 1,
    status: '上架' as const,
  },
]

const configProducts = [
  {
    id: 'sp-1',
    categoryId: 'cat-1',
    name: '1.8m 黑胡桃圆餐桌',
    code: 'SP-CT-001',
    style: '意式极简',
    series: '五福系列',
    applicableSpace: ['餐厅'],
    sortOrder: 1,
    media: {
      images: [{ id: 'img-1', name: '主图', type: 'image/png', url: 'https://example.com/a.png' }],
      qualityStandard: '含水率 ≤ 12%，拼板色差 ΔE ≤ 3。',
    },
    components: [{ componentId: 'comp-1', quantity: 1, optional: false }],
    adjustPrice: 0,
    status: '上架' as const,
  },
  {
    id: 'sp-2',
    categoryId: 'cat-1',
    name: '1.6m 黑胡桃圆餐桌（下架）',
    code: 'SP-CT-002',
    sortOrder: 2,
    components: [{ componentId: 'comp-1', quantity: 1, optional: false }],
    adjustPrice: 0,
    status: '下架' as const,
  },
  {
    id: 'sp-3',
    categoryId: 'cat-1',
    name: '尚品系列餐边柜',
    code: 'SP-CB-001',
    style: '新中式',
    series: '尚品系列',
    applicableSpace: ['餐厅'],
    sortOrder: 3,
    media: {
      images: [{ id: 'img-3', name: '柜图', type: 'image/png', url: 'https://example.com/c.png' }],
    },
    components: [{ componentId: 'comp-1', quantity: 1, optional: false }],
    adjustPrice: 0,
    status: '上架' as const,
  },
]

const productPackages = [
  {
    id: 'pkg-1',
    name: '餐厅套系 A',
    code: 'TC-001',
    sortOrder: 1,
    media: {
      images: [{ id: 'img-2', name: '套系图', type: 'image/png', url: 'https://example.com/b.png' }],
    },
    items: [{ productId: 'sp-1', quantity: 1 }],
    adjustPrice: 0,
    status: '上架' as const,
  },
]

function seed() {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      customers: [],
      followUps: [],
      categories,
      skuUnits,
      configProducts,
      productPackages,
    }),
  )
}

function renderPage() {
  render(
    <SalesDataProvider>
      <ProductCatalogPage />
    </SalesDataProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  seed()
})

describe('ProductCatalogPage 4.5 产品目录', () => {
  it('只渲染上架单品与套餐卡片，下架商品被过滤，价格精确显示', async () => {
    await act(async () => {
      renderPage()
    })
    // 标题
    expect(screen.getByRole('heading', { name: '产品目录' })).toBeTruthy()
    // 上架单品 + 套餐出现
    expect(screen.getByText('1.8m 黑胡桃圆餐桌')).toBeTruthy()
    expect(screen.getByText('餐厅套系 A')).toBeTruthy()
    // 下架商品不出现
    expect(screen.queryByText('1.6m 黑胡桃圆餐桌（下架）')).toBeNull()
    // 上架单品 sp-3 出现
    expect(screen.getByText('尚品系列餐边柜')).toBeTruthy()
    // 精确价（¥6,800）至少 3 张卡
    expect(screen.getAllByText('¥6,800').length).toBeGreaterThanOrEqual(3)
    // 套餐出现「套餐」标签
    expect(screen.getAllByText('套餐').length).toBeGreaterThanOrEqual(1)
  })

  it('关键词搜索过滤卡片', async () => {
    await act(async () => {
      renderPage()
    })
    const search = screen.getByPlaceholderText('搜索名称 / 编码')
    await act(async () => {
      fireEvent.change(search, { target: { value: '餐厅套系' } })
    })
    expect(screen.queryByText('1.8m 黑胡桃圆餐桌')).toBeNull()
    expect(screen.getByText('餐厅套系 A')).toBeTruthy()
  })

  it('点击卡片打开详情抽屉，展示图文与质检标准', async () => {
    await act(async () => {
      renderPage()
    })
    const card = screen.getByText('1.8m 黑胡桃圆餐桌').closest('button')!
    await act(async () => {
      fireEvent.click(card)
    })
    expect(screen.getByRole('dialog', { name: '1.8m 黑胡桃圆餐桌 详情' })).toBeTruthy()
    expect(screen.getByText(/含水率/)).toBeTruthy()
    // 主图（卡片缩略图与抽屉主图都会渲染，至少其一为正确地址）
    const heroes = screen.getAllByAltText('1.8m 黑胡桃圆餐桌') as HTMLImageElement[]
    expect(heroes.some((img) => img.getAttribute('src') === 'https://example.com/a.png')).toBe(true)
  })

  it('按系列筛选', async () => {
    await act(async () => {
      renderPage()
    })
    const seriesSelect = screen.getByLabelText('按系列筛选') as HTMLSelectElement
    await act(async () => {
      fireEvent.change(seriesSelect, { target: { value: '五福系列' } })
    })
    // 单品 sp-1（五福系列）与套餐（引用 sp-1）出现
    expect(screen.getByText('1.8m 黑胡桃圆餐桌')).toBeTruthy()
    expect(screen.getByText('餐厅套系 A')).toBeTruthy()
    // 尚品系列单品被过滤
    expect(screen.queryByText('尚品系列餐边柜')).toBeNull()
  })
})
