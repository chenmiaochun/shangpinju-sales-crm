import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'manager', name: '陈店长', role: 'manager', active: true }, status: 'authenticated', notice: '', logout: vi.fn(), clearNotice: vi.fn() }) }))

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
}

describe('App routes', () => {
  it('renders the manager dashboard', () => {
    renderAt('/dashboard')
    expect(screen.getByRole('heading', { name: '经营总览' })).toBeTruthy()
  })

  it('opens notifications and system settings from the top bar', () => {
    renderAt('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: '消息提醒' }))
    expect(screen.getByRole('region', { name: '消息提醒' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '系统设置' }))
    const settings = screen.getByRole('region', { name: '系统设置' })
    expect(within(settings).getByRole('link', { name: /成员与权限/ })).toBeTruthy()
    expect(within(settings).getByRole('link', { name: /数据管理/ })).toBeTruthy()
  })

  it('opens the sidebar account menu with working account actions', () => {
    renderAt('/dashboard')
    const trigger = screen.getByRole('button', { name: '打开账号菜单' })
    fireEvent.click(trigger)

    const menu = screen.getByRole('menu', { name: '账号菜单' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(within(menu).getByRole('menuitem', { name: '系统设置' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: '成员与权限' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: '数据管理' })).toBeTruthy()
    expect(within(menu).getByRole('menuitem', { name: '退出登录' })).toBeTruthy()
  })

  it('renders the customer follow-up workspace', () => {
    renderAt('/customers')
    expect(screen.getByRole('heading', { name: '客户与跟进' })).toBeTruthy()
  })

  it('renders AI quality review', () => {
    renderAt('/quality')
    expect(screen.getByRole('heading', { name: '客户跟进质量与成交机会' })).toBeTruthy()
  })

  it('renders order delivery and after-sales lifecycle', () => {
    renderAt('/lifecycle')
    expect(screen.getByRole('heading', { name: '订单、交付与售后' })).toBeTruthy()
  })

  it.each([
    ['/tasks', '跟进任务中心'],
    ['/leads', '线索数据中心'],
    ['/insights', '从数据找到下一步增长'],
  ])('renders the phase two route %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  })

  it.each([
    ['/conversation', '把客户原话变成可执行跟进'],
    ['/sop', '家具销售 SOP'],
    ['/coaching', '让每次复盘都有数据依据'],
    ['/more', '全部功能'],
  ])('renders the phase three route %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  })

  it.each([
    ['/team', '成员账号管理'],
    ['/data-admin', '数据管理与接入中心'],
  ])('renders the phase four route %s', (path, heading) => {
    renderAt(path)
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
  })
})
