import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { customers, followUps } from '../../data'
import { CustomersPage, getCustomerCounts } from './CustomersPage'

afterEach(() => { window.location.hash = '' })

it('switches to the customer requested by a dashboard entry after a hash change', () => {
  window.location.hash = '/customers?customer=c1'
  const { rerender } = render(<CustomersPage customers={customers} followUps={followUps} onStateChange={vi.fn()} />)

  window.location.hash = '/customers?customer=c2'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  rerender(<CustomersPage customers={customers} followUps={followUps} onStateChange={vi.fn()} />)

  expect(screen.getByRole('heading', { name: customers.find((customer) => customer.id === 'c2')!.name })).toBeInTheDocument()
})

it('filters customers from a dashboard period metric', () => {
  window.location.hash = '/customers?period=leads&from=2026-07-01&to=2026-08-01'
  render(<CustomersPage customers={customers} followUps={followUps} onStateChange={vi.fn()} />)

  expect(screen.getByText(/新增线索/)).toBeInTheDocument()
  expect(screen.getByText(/共 4 位客户/)).toBeInTheDocument()
})

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

describe('dashboard drill-down filters', () => {
  it('opens the customer workspace with intent and scope filters from the URL', () => {
    window.location.hash = '/customers?scope=active&intent=%E9%AB%98&metric=high-intent'
    render(<CustomersPage customers={customers} followUps={followUps} onStateChange={vi.fn()} />)
    expect(screen.getByText(/经营分析筛选：/)).toHaveTextContent('全部在跟客户 · 高意向')
    expect(screen.getByLabelText('客户意向')).toHaveValue('高')
    expect(screen.getByRole('region', { name:'高意向客户明细' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name:'高意向客户客户清单' })).toBeInTheDocument()
  })
})

describe('CustomersPage design collaboration', () => {
  it('turns a pending next task into an executable action', () => {
    render(<CustomersPage customers={customers} followUps={followUps} onStateChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name:'执行并记录' }))

    expect(screen.getByRole('heading', { name:/执行任务 · 张女士/ })).toBeInTheDocument()
    expect((screen.getByLabelText('沟通内容') as HTMLTextAreaElement).value).toContain('执行任务：')
  })

  it('opens scheduling when the customer has no next task', () => {
    const unscheduled = [{ ...customers[0], nextFollowUpAt:undefined }]
    render(<CustomersPage customers={unscheduled} followUps={[]} onStateChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name:'安排下一步' }))

    expect(screen.getByRole('heading', { name:/安排下一步 · 张女士/ })).toBeInTheDocument()
  })

  it('lets the salesperson repeatedly enrich the customer profile', () => {
    const onStateChange = vi.fn()
    render(<CustomersPage customers={customers} followUps={followUps} onStateChange={onStateChange} />)
    fireEvent.click(screen.getByRole('button', { name:'编辑画像' }))
    fireEvent.change(screen.getByLabelText('意向产品'), { target:{ value:'沙发、床垫、窗帘' } })
    fireEvent.change(screen.getByLabelText('偏好风格'), { target:{ value:'中古原木' } })
    fireEvent.change(screen.getByLabelText('主要顾虑'), { target:{ value:'价格、交期、孩子安全' } })
    fireEvent.change(screen.getByLabelText('补充备注'), { target:{ value:'夫妻共同决策，需要周末一起确认' } })
    fireEvent.click(screen.getByRole('button', { name:'保存客户画像' }))

    expect(onStateChange.mock.calls[0][0].customers[0]).toMatchObject({ products:['沙发','床垫','窗帘'], style:'中古原木', concerns:['价格','交期','孩子安全'], notes:'夫妻共同决策，需要周末一起确认' })
  })

  it('saves multiple preset and custom next actions in one follow-up', () => {
    const onStateChange = vi.fn()
    render(<CustomersPage customers={customers} followUps={followUps} onStateChange={onStateChange} />)
    fireEvent.click(screen.getAllByRole('button', { name:'新增跟进' })[0])
    fireEvent.change(screen.getByLabelText('沟通内容'), { target:{ value:'沟通下一步安排' } })
    fireEvent.change(screen.getByLabelText('本次结果'), { target:{ value:'客户需要继续比较' } })
    fireEvent.click(screen.getByRole('checkbox', { name:'发送报价' }))
    fireEvent.click(screen.getByRole('checkbox', { name:'确认预算' }))
    fireEvent.click(screen.getByRole('checkbox', { name:'其他' }))
    fireEvent.change(screen.getByLabelText('其他特殊情况'), { target:{ value:'带木样上门确认颜色' } })
    fireEvent.click(screen.getByRole('button', { name:'保存跟进' }))
    expect(onStateChange.mock.calls[0][0].followUps[0]).toMatchObject({ nextAction:'发送报价、确认预算、带木样上门确认颜色' })
  })

  it('saves multiple preset communication details and optional supplements', () => {
    const onStateChange = vi.fn()
    render(<CustomersPage customers={customers} followUps={followUps} onStateChange={onStateChange} />)
    fireEvent.click(screen.getAllByRole('button', { name:'新增跟进' })[0])
    fireEvent.click(screen.getByRole('checkbox', { name:'了解产品需求' }))
    fireEvent.click(screen.getByRole('checkbox', { name:'确认客户预算' }))
    fireEvent.change(screen.getByLabelText('沟通内容'), { target:{ value:'偏好胡桃木色' } })
    fireEvent.click(screen.getByRole('checkbox', { name:'客户意向明确' }))
    fireEvent.click(screen.getByRole('checkbox', { name:'已发送资料' }))
    fireEvent.click(screen.getByRole('button', { name:'保存跟进' }))
    expect(onStateChange.mock.calls[0][0].followUps[0]).toMatchObject({ content:'了解产品需求；确认客户预算；偏好胡桃木色', result:'客户意向明确；已发送资料' })
  })

  it('keeps formal order entry out of customer follow-up', () => {
    const onStateChange=vi.fn();render(<CustomersPage customers={customers} followUps={followUps} onStateChange={onStateChange}/>)
    fireEvent.change(screen.getByLabelText('当前阶段'),{target:{value:'已成交'}})
    expect(screen.queryByLabelText('成交金额（元）*')).toBeNull()
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
