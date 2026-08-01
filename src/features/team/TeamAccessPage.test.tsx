import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamAccessPage } from './TeamAccessPage'

const accounts = [{ id: 'a1', username: 'manager', name: '陈店长', role: 'manager' as const, active: true, mustChangePassword: false }]
vi.mock('../../api/salesApi', () => ({ salesApi: {
  getAccounts: vi.fn(async () => ({ accounts })),
  createAccount: vi.fn(async (input) => ({ account: { id: 'a2', ...input, active: true, mustChangePassword: true } })),
  updateAccount: vi.fn(async (id, input) => ({ account: { ...accounts[0], ...input, id } })),
  deleteAccount: vi.fn(async () => undefined),
  setAccountActive: vi.fn(async (id, active) => ({ account: { ...accounts[0], id, active } })),
  resetAccountPassword: vi.fn(async () => ({ ok: true })),
} }))

describe('TeamAccessPage', () => {
  beforeEach(() => window.localStorage.clear())

  it('renders secure account management and employee permission settings', async () => {
    render(<TeamAccessPage storageKey="team-test" />)
    expect(await screen.findByText('账号由服务端安全管理')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '员工权限设置' })).toBeInTheDocument()
    expect(screen.getByText('店长固定拥有全部权限')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '本人客户' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '售后 0' })).toBeInTheDocument()
  })

  it('can disable an account', async () => {
    render(<TeamAccessPage />)
    fireEvent.click(await screen.findByRole('button', { name: '禁用' }))
    expect(await screen.findByText('禁用')).toBeInTheDocument()
  })

  it('supports a sales and designer dual identity', async () => {
    render(<TeamAccessPage />)
    fireEvent.click(await screen.findByRole('button', { name:'新增账号' }))
    expect(screen.getByRole('checkbox', { name:/同时承担设计师职责/ })).toBeInTheDocument()
    expect(screen.getByText('该账号既可负责销售客户，也可接收设计协作任务')).toBeInTheDocument()
  })

})
