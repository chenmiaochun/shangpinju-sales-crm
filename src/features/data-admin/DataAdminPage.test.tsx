import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Customer, FollowUp } from '../../types'
import { createBackup } from './backup'
import { DataAdminPage } from './DataAdminPage'

vi.mock('../../store/SalesDataContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/SalesDataContext')>()
  return {
    ...actual,
    useSalesData: () => ({ paymentSettings: { enabled: false, banks: [] }, updatePaymentSettings: vi.fn() }),
  }
})

const customer: Customer = { id: 'c1', name: '张女士', phone: '13800000000', source: '到店', salesperson: '小林', stage: '需求确认', intent: '高', expectedAmount: 120000, products: ['衣柜'], style: '现代', budget: '10-15万', renovationProgress: '毛坯', concerns: [], lastContactAt: '2026-07-30T08:00:00Z', createdAt: '2026-07-01T08:00:00Z' }
const followUp: FollowUp = { id: 'f1', customerId: 'c1', at: '2026-07-30T08:00:00Z', channel: '微信', content: '确认需求', result: '待量房', salesperson: '小林' }

function setup(overrides = {}) {
  const onRestoreBackup = vi.fn()
  const onSaveIntegration = vi.fn()
  render(<DataAdminPage customers={[customer]} followUps={[followUp]} auditEvents={[]} connectionStatus="pending" onRestoreBackup={onRestoreBackup} integrationSettings={{ corpId: 'corp', agentId: '1001', secretConfigured: true }} onSaveIntegration={onSaveIntegration} {...overrides} />)
  return { onRestoreBackup, onSaveIntegration }
}

describe('DataAdminPage', () => {
  it('shows actual status and never echoes an existing secret', () => {
    setup()
    expect(screen.getAllByText('待验证').length).toBeGreaterThan(0)
    const secret = screen.getByLabelText('Secret')
    expect(secret).toHaveAttribute('type', 'password')
    expect(secret).toHaveValue('')
    expect(screen.queryByDisplayValue(/secret/i)).not.toBeInTheDocument()
  })

  it('previews and requires a second confirmation before restore', async () => {
    const { onRestoreBackup } = setup()
    const file = new File([JSON.stringify(createBackup([customer], [followUp]))], 'backup.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('选择备份文件'), { target: { files: [file] } })
    expect(await screen.findByText('文件校验通过')).toBeInTheDocument()
    expect(onRestoreBackup).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '准备恢复' }))
    expect(screen.getByText('恢复会替换当前数据，确认继续？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认恢复' }))
    await waitFor(() => expect(onRestoreBackup).toHaveBeenCalledTimes(1))
  })

  it('submits a newly entered secret then clears it', async () => {
    const { onSaveIntegration } = setup()
    const secret = screen.getByLabelText('Secret')
    fireEvent.change(secret, { target: { value: 'new-value' } })
    fireEvent.click(screen.getByRole('button', { name: '保存接入配置' }))
    await waitFor(() => expect(onSaveIntegration).toHaveBeenCalledWith({ corpId: 'corp', agentId: '1001', secret: 'new-value' }))
    expect(secret).toHaveValue('')
  })
})
