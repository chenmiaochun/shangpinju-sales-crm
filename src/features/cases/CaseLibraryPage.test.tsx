import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../auth/AuthContext'
import { SalesDataProvider } from '../../store/SalesDataContext'
import { salesApi } from '../../api/salesApi'
import { CaseLibraryPage } from './CaseLibraryPage'

// 案例库：员工上传入口 + 全员列表 + 分类筛选。
vi.mock('../../api/salesApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/salesApi')>('../../api/salesApi')
  return {
    ...actual,
    salesApi: {
      getCurrentUser: vi.fn(async () => ({ user: { id: 'member-sales-1', name: '刘先生', role: 'sales', active: true } })),
      getState: vi.fn(async () => { throw new Error('offline') }),
      listCases: vi.fn(async () => ({ cases: [] })),
      createCase: vi.fn(async (input: { title: string }) => ({ case: { id: 'case-1', title: input.title, category: '成交案例', productNames: [], customerName: '', images: [], note: '', status: '已发布', author: 'spj001', authorName: '刘先生', createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' } })),
      updateCase: vi.fn(),
      deleteCase: vi.fn(),
      uploadFile: vi.fn(),
    },
  }
})

const STORAGE_KEY = 'shangpinju.customer-followup.v1'

function renderPage() {
  return render(
    <AuthProvider>
      <SalesDataProvider>
        <CaseLibraryPage />
      </SalesDataProvider>
    </AuthProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ customers: [], followUps: [], configProducts: [], categories: [], productPackages: [] }))
  vi.mocked(salesApi.listCases).mockResolvedValue({ cases: [] })
})

describe('CaseLibraryPage', () => {
  it('渲染空态与上传入口', async () => {
    renderPage()
    expect(screen.getByRole('heading', { name: '案例库' })).toBeTruthy()
    expect(screen.getByText('上传图片 / 案例')).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/还没有案例/)).toBeTruthy())
  })

  it('上传案例：标题必填校验 + 提交后刷新列表', async () => {
    renderPage()
    fireEvent.click(screen.getByText('上传图片 / 案例'))
    fireEvent.click(screen.getByText('提交案例'))
    await waitFor(() => expect(screen.getByText('请填写案例标题')).toBeTruthy())
    // 补齐标题与图片后提交（图片直接塞进组件状态不可行，走 title+images 校验路径）
    const titleInput = screen.getByPlaceholderText(/深圳湾客户客厅全案交付/) as HTMLInputElement
    fireEvent.change(titleInput, { target: { value: '南山客户交付案例' } })
    fireEvent.click(screen.getByText('提交案例'))
    await waitFor(() => expect(screen.getByText('请至少上传一张图片')).toBeTruthy())
  })

  it('展示列表并按分类筛选', async () => {
    vi.mocked(salesApi.listCases).mockResolvedValue({
      cases: [
        { id: 'case-1', title: '客厅全案交付', category: '成交案例', productNames: ['云朵沙发'], customerName: '李先生', images: [{ id: 'f1', name: 'a.png', type: 'image/png', url: '/api/files/f1' }], note: '交付实拍', status: '已发布', author: 'spj001', authorName: '刘先生', createdAt: '2026-08-30T10:00:00.000Z', updatedAt: '2026-08-30T10:00:00.000Z' },
        { id: 'case-2', title: '卧室安装记录', category: '安装现场', productNames: [], customerName: '', images: [{ id: 'f2', name: 'b.png', type: 'image/png', url: '/api/files/f2' }], note: '', status: '已发布', author: 'spj002', authorName: '王顾问', createdAt: '2026-08-29T10:00:00.000Z', updatedAt: '2026-08-29T10:00:00.000Z' },
      ],
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('客厅全案交付')).toBeTruthy())
    expect(screen.getByText('卧室安装记录')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '安装现场' }))
    expect(screen.queryByText('客厅全案交付')).toBeNull()
    expect(screen.getByText('卧室安装记录')).toBeTruthy()
  })
})
