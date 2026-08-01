import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { customers, followUps } from '../../data'
import { getDashboardSummary, ManagerDashboard } from './ManagerDashboard'

describe('ManagerDashboard', () => {
  const now = new Date('2026-07-30T12:00:00+08:00')

  it('aggregates active opportunities and risks from customer data', () => {
    const summary = getDashboardSummary(customers, now)

    expect(summary.activeCustomers).toBe(5)
    expect(summary.pipelineAmount).toBe(413000)
    expect(summary.highIntentCustomers).toBe(3)
    expect(summary.conversionRate).toBe(20)
    expect(summary.overdueCustomers.map((customer) => customer.id)).toEqual(['c1', 'c4'])
    expect(summary.staleCustomers.map((customer) => customer.id)).toEqual(['c3'])
  })

  it('renders the complete manager view from supplied data', () => {
    render(<ManagerDashboard customers={customers} followUps={followUps} now={now} />)

    expect(screen.getByRole('heading', { name: '经营总览' })).toBeInTheDocument()
    expect(screen.getByText('¥41.3万')).toBeInTheDocument()
    expect(screen.getByText('销售人员对比')).toBeInTheDocument()
    expect(screen.getByText('客户阶段分布')).toBeInTheDocument()
    expect(screen.getByText('刘先生')).toBeInTheDocument()
    expect(screen.getByText(/先处理 2 位逾期客户/)).toBeInTheDocument()
  })

  it('handles an empty dataset without invalid values', () => {
    render(<ManagerDashboard customers={[]} followUps={[]} now={now} />)

    expect(screen.getByText('待跟进 0 · 成交 0 · 流失 0')).toBeInTheDocument()
    expect(screen.getByText('暂无销售数据')).toBeInTheDocument()
    expect(screen.getByText('暂无阶段数据')).toBeInTheDocument()
    expect(screen.getByText('暂无风险客户')).toBeInTheDocument()
  })
})
