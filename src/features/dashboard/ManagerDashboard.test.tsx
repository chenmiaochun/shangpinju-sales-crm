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

  it('summarizes actual revenue, payments and post-sale opportunities', () => {
    const completed = [
      { ...customers[0], id: 'won-1', stage: '已成交' as const, dealAmount: 120000, paidAmount: 80000, marketingStatus: '可加购' as const },
      { ...customers[1], id: 'won-2', stage: '已成交' as const, expectedAmount: 60000, paidAmount: 60000, marketingStatus: '暂不营销' as const },
    ]
    const summary = getDashboardSummary(completed, now)

    expect(summary).toMatchObject({ completedCustomers: 2, revenueAmount: 180000, paidAmount: 140000, receivableAmount: 40000, averageOrderValue: 90000 })
    expect(summary.marketingCustomers.map((customer) => customer.id)).toEqual(['won-1'])
  })

  it('counts a deal registered during follow-up before final delivery completion', () => {
    const registered = [{ ...customers[0], stage: '已定金' as const, dealAmount: 98000, paidAmount: 20000, marketingStatus: '待回访' as const }]
    const summary = getDashboardSummary(registered, now)

    expect(summary).toMatchObject({ completedCustomers: 1, revenueAmount: 98000, paidAmount: 20000, receivableAmount: 78000, averageOrderValue: 98000 })
    expect(summary.marketingCustomers).toHaveLength(1)
  })
})
