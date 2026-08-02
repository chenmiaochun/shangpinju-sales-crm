import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamAccessPage } from './TeamAccessPage'

const accounts = [{ id: 'a1', username: 'manager', name: '陈店长', role: 'manager' as const, active: true, mustChangePassword: false }]
vi.mock('../../api/salesApi', () => ({ salesApi: {
  isStaticDemo: true,
  staticTestPassword: '123456',
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
    expect(await screen.findByText('当前是外网离线测试模式')).toBeInTheDocument()
    expect(screen.getByText(/spj001 至 spj005/)).toHaveTextContent('123456')
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

  it('supports multiple positions for one employee', async () => {
    render(<TeamAccessPage />)
    fireEvent.click(await screen.findByRole('button', { name:'新增账号' }))
    expect(screen.getByRole('combobox', { name:/主岗位/ })).toHaveValue('sales')
    expect(screen.getByRole('checkbox', { name:'设计师' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name:'售后' })).toBeInTheDocument()
    expect(screen.getByText(/权限与主岗位合并/)).toBeInTheDocument()
  })

})
