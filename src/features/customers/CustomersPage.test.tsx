import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { customers, followUps } from '../../data'
import { CustomersPage, getCustomerCounts } from './CustomersPage'

describe('customer counts', () => {
  it('removes completed and lost customers from active and pending counts', () => {
    const items = [
      { ...customers[0], id: 'active', stage: '需求确认' as const, nextFollowUpAt: '2026-08-03T10:00:00Z' },
      { ...customers[0], id: 'won', stage: '已成交' as const, nextFollowUpAt: '2026-08-03T10:00:00Z' },
      { ...customers[0], id: 'lost', stage: '已流失' as const, nextFollowUpAt: '2026-08-03T10:00:00Z' },
    ]
    expect(getCustomerCounts(items)).toEqual({ total: 3, active: 1, completed: 1, lost: 1, pending: 1 })
  })
})

describe('CustomersPage design collaboration', () => {
  it('registers a structured order from the customer follow-up workspace', () => {
    const onRegisterDeal = vi.fn()
    render(<CustomersPage customers={customers} followUps={followUps} onStateChange={vi.fn()} onRegisterDeal={onRegisterDeal} />)
    fireEvent.change(screen.getByLabelText('当前阶段'), { target: { value: '已成交' } })
    fireEvent.change(screen.getByLabelText('成交金额（元）*'), { target: { value: '128000' } })
    fireEvent.change(screen.getByLabelText('已收款（元）'), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText('产品名称 1'), { target: { value: '白蜡木沙发' } })
    fireEvent.change(screen.getByLabelText('规格 1'), { target: { value: '三人位 / 胡桃色' } })
    fireEvent.change(screen.getByLabelText('供应方式 1'), { target: { value: '定制生产' } })
    fireEvent.click(screen.getByRole('button', { name: '确认成交并生成订单' }))
    expect(onRegisterDeal).toHaveBeenCalledWith(expect.objectContaining({ contractAmount: 128000, deposit: 20000, items: expect.arrayContaining([expect.objectContaining({ productName: '白蜡木沙发', specification: '三人位 / 胡桃色', quantity: 1, supplyType: '定制生产' })]) }))
  })

  it('creates a designer task while saving a follow-up', () => {
    const onAddDesignTask = vi.fn()
    const onStateChange = vi.fn()
    render(<CustomersPage customers={customers} followUps={followUps} designers={[{ id:'designer-1', name:'陈设计师' }]} onStateChange={onStateChange} onAddDesignTask={onAddDesignTask} />)

    fireEvent.click(screen.getAllByRole('button', { name:'新增跟进' })[0])
    fireEvent.change(screen.getByLabelText('沟通内容'), { target:{ value:'客户需要客厅效果图' } })
    fireEvent.change(screen.getByLabelText('本次结果'), { target:{ value:'安排设计支持' } })
    fireEvent.click(screen.getByLabelText('需要设计师协助'))
    fireEvent.change(screen.getByLabelText('指派设计师 *'), { target:{ value:'designer-1' } })
    fireEvent.change(screen.getByLabelText('任务类型 *'), { target:{ value:'效果图' } })
    fireEvent.change(screen.getByLabelText('计划完成时间 *'), { target:{ value:'2026-08-03T18:00' } })
    fireEvent.change(screen.getByLabelText('设计任务要求 *'), { target:{ value:'按现场尺寸完成客厅效果图' } })
    fireEvent.click(screen.getByRole('button', { name:'保存跟进' }))

    expect(onStateChange).toHaveBeenCalled()
    expect(onAddDesignTask).toHaveBeenCalledWith(expect.objectContaining({ customerId:'c1', designerId:'designer-1', designerName:'陈设计师', type:'效果图', requirement:'按现场尺寸完成客厅效果图', status:'待接收' }))
  })

  it('records a customer-service handoff to a salesperson', () => {
    const onStateChange = vi.fn()
    render(<CustomersPage customers={customers} followUps={followUps} salespeople={[{ id:'sales-2', name:'吴销售' }]} activeMember={{ id:'service-1', name:'小陈客服', role:'operations', active:true }} onStateChange={onStateChange} />)
    fireEvent.click(screen.getByRole('button', { name:'转交销售' }))
    fireEvent.change(screen.getByLabelText('接收销售 *'), { target:{ value:'sales-2' } })
    fireEvent.change(screen.getByLabelText('交接摘要 *'), { target:{ value:'线上咨询沙发，预算五万元，周六到店' } })
    fireEvent.click(screen.getByRole('button', { name:'确认转交' }))
    const state = onStateChange.mock.calls[0][0]
    expect(state.customers.find((item: { id:string }) => item.id === 'c1')).toMatchObject({ sourceService:'小陈客服', handoffStatus:'待销售接收', pendingSalesperson:'吴销售', pendingSalespersonId:'sales-2', handoffHistory:[expect.objectContaining({ fromName:'小陈客服', toName:'吴销售', summary:'线上咨询沙发，预算五万元，周六到店' })] })
  })

  it('switches ownership when the assigned salesperson accepts', () => {
    const onStateChange = vi.fn()
    const pending = [{ ...customers[0], sourceService:'小陈客服', handoffStatus:'待销售接收' as const, pendingSalesperson:'吴销售', pendingSalespersonId:'sales-2', handoffHistory:[{ id:'h1', fromName:'小陈客服', toName:'吴销售', toId:'sales-2', status:'待销售接收' as const, summary:'已邀约到店', createdAt:'2026-07-31T10:00:00Z' }] }]
    render(<CustomersPage customers={pending} followUps={[]} activeMember={{ id:'sales-2', name:'吴销售', role:'sales', active:true }} onStateChange={onStateChange} />)
    fireEvent.click(screen.getByRole('button', { name:'接收客户' }))
    expect(onStateChange.mock.calls[0][0].customers[0]).toMatchObject({ salesperson:'吴销售', salespersonId:'sales-2', handoffStatus:'已接收', pendingSalesperson:undefined, handoffHistory:[expect.objectContaining({ status:'已接收' })] })
  })
})
