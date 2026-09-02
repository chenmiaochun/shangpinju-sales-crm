import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { salesApi } from '../../api/salesApi'
import { ChangePasswordDialog } from './ChangePasswordDialog'

vi.mock('../../api/salesApi', async () => {
  const actual = await vi.importActual<typeof import('../../api/salesApi')>('../../api/salesApi')
  return {
    ...actual,
    salesApi: {
      changePassword: vi.fn(async () => ({ ok: true })),
    },
  }
})

describe('ChangePasswordDialog', () => {
  beforeEach(() => {
    vi.mocked(salesApi.changePassword).mockClear()
    vi.mocked(salesApi.changePassword).mockResolvedValue({ ok: true })
  })

  it('校验两次新密码一致后才提交', async () => {
    render(<ChangePasswordDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('请输入当前使用的密码'), { target: { value: 'old-pass-1234' } })
    fireEvent.change(screen.getByPlaceholderText('6 位数字，或 10 位以上字符'), { target: { value: 'new-pass-5678' } })
    fireEvent.change(screen.getByPlaceholderText('再输入一次新密码'), { target: { value: 'new-pass-9999' } })
    fireEvent.click(screen.getByRole('button', { name: /确认修改/ }))
    await waitFor(() => expect(screen.getByText('两次输入的新密码不一致')).toBeTruthy())
    expect(salesApi.changePassword).not.toHaveBeenCalled()
  })

  it('拒绝弱密码', async () => {
    render(<ChangePasswordDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('请输入当前使用的密码'), { target: { value: 'old-pass-1234' } })
    fireEvent.change(screen.getByPlaceholderText('6 位数字，或 10 位以上字符'), { target: { value: '123' } })
    fireEvent.change(screen.getByPlaceholderText('再输入一次新密码'), { target: { value: '123' } })
    fireEvent.click(screen.getByRole('button', { name: /确认修改/ }))
    await waitFor(() => expect(screen.getByText('新密码需为 6 位数字，或 10 位以上字符')).toBeTruthy())
    expect(salesApi.changePassword).not.toHaveBeenCalled()
  })

  it('提交成功后提示其他设备需重新登录', async () => {
    render(<ChangePasswordDialog onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('请输入当前使用的密码'), { target: { value: 'old-pass-1234' } })
    fireEvent.change(screen.getByPlaceholderText('6 位数字，或 10 位以上字符'), { target: { value: '246810' } })
    fireEvent.change(screen.getByPlaceholderText('再输入一次新密码'), { target: { value: '246810' } })
    fireEvent.click(screen.getByRole('button', { name: /确认修改/ }))
    await waitFor(() => expect(screen.getByText('密码已修改')).toBeTruthy())
    expect(salesApi.changePassword).toHaveBeenCalledWith('old-pass-1234', '246810')
    expect(screen.getByText(/其他设备需要重新登录/)).toBeTruthy()
  })
})
