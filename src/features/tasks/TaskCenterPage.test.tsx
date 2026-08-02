import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { customers, followUps } from '../../data'
import { TaskCenterPage } from './TaskCenterPage'
import type { DesignTask } from '../../types'

afterEach(() => { window.location.hash = '' })

describe('TaskCenterPage', () => {
  const now = new Date('2026-07-30T12:00:00+08:00')
  it('renders categories and actionable customer details', () => {
    render(<TaskCenterPage customers={customers} followUps={followUps} onCompleteTask={() => {}} now={now} />)
    expect(screen.getByRole('heading', { name:'跟进任务中心' })).toBeInTheDocument()
    expect(screen.getByText('张女士')).toBeInTheDocument()
    expect(screen.getByText(/预计成交\s*[¥￥]86,000/)).toBeInTheDocument()
    expect(screen.getByText('已报价')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name:/逾期/ }))
    expect(screen.getByText('超期 1 天')).toBeInTheDocument()
  })

  it('opens today and overdue tasks from the header summary', () => {
    render(<TaskCenterPage customers={customers} followUps={followUps} onCompleteTask={() => {}} now={now} />)
    const summary = screen.getByRole('button', { name:/今日待处理/ })
    fireEvent.click(summary)
    expect(summary).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('超期 1 天')).toBeInTheDocument()
    expect(screen.getByText('张女士')).toBeInTheDocument()
  })

  it('submits a completed task as a FollowUp', () => {
    const complete = vi.fn()
    render(<TaskCenterPage customers={customers} followUps={followUps} onCompleteTask={complete} now={now} />)
    fireEvent.click(screen.getByRole('button', { name:'完成跟进' }))
    fireEvent.change(screen.getByLabelText('沟通内容'), { target:{ value:'客户确认方案细节' } })
    fireEvent.change(screen.getByLabelText('跟进结果'), { target:{ value:'等待最终确认' } })
    fireEvent.click(screen.getByRole('checkbox', { name:'发送设计方案' }))
    fireEvent.click(screen.getByRole('checkbox', { name:'确认签约时间' }))
    fireEvent.click(screen.getByRole('button', { name:/确认完成/ }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ customerId:'c1', salesperson:'林晓', channel:'微信', content:'客户确认方案细节', result:'等待最终确认', nextAction:'发送设计方案、确认签约时间', at:now.toISOString() }))
  })

  it('supports a custom next action', () => {
    const complete = vi.fn()
    render(<TaskCenterPage customers={customers} followUps={followUps} onCompleteTask={complete} now={now} />)
    fireEvent.click(screen.getByRole('button', { name:'完成跟进' }))
    fireEvent.change(screen.getByLabelText('沟通内容'), { target:{ value:'客户有特殊时间安排' } })
    fireEvent.change(screen.getByLabelText('跟进结果'), { target:{ value:'等待家人共同确认' } })
    fireEvent.click(screen.getByRole('checkbox', { name:'其他' }))
    fireEvent.change(screen.getByLabelText('其他特殊情况'), { target:{ value:'周日与客户家人视频确认' } })
    fireEvent.click(screen.getByRole('button', { name:/确认完成/ }))
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ nextAction:'周日与客户家人视频确认' }))
  })

  it('focuses the customer requested from the customer workspace', () => {
    window.location.hash = '/tasks?customer=c4'
    render(<TaskCenterPage customers={customers} followUps={followUps} onCompleteTask={() => {}} now={now} />)

    expect(screen.getByText(/已定位客户：刘先生/)).toBeInTheDocument()
    expect(screen.getByText('超期 1 天')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name:'查看全部任务' }))
    expect(screen.queryByText(/已定位客户/)).not.toBeInTheDocument()
  })

  it('lets an assigned designer submit solution files for sales review', () => {
    const update = vi.fn()
    const designTask: DesignTask = { id:'d1', customerId:'c1', customerName:'张女士', salesperson:'林晓', designerId:'designer-1', designerName:'陈设计师', type:'效果图', requirement:'完成客厅效果图', dueAt:'2026-08-01T10:00:00+08:00', priority:'紧急', status:'设计中', referenceFiles:[], solutionFiles:[], createdAt:now.toISOString(), updatedAt:now.toISOString() }
    const { container } = render(<TaskCenterPage customers={customers} followUps={followUps} designTasks={[designTask]} activeMember={{ id:'designer-1', name:'陈设计师', role:'designer', active:true }} onCompleteTask={() => {}} onUpdateDesignTask={update} now={now} />)
    fireEvent.click(screen.getByRole('button', { name:/设计协作/ }))
    expect(screen.getByText('完成客厅效果图')).toBeInTheDocument()
    const upload = container.querySelector<HTMLInputElement>('#solution-d1')!
    fireEvent.change(upload, { target:{ files:[new File(['pdf'], '客厅方案V1.pdf', { type:'application/pdf' })] } })
    fireEvent.change(screen.getByPlaceholderText('方案说明'), { target:{ value:'首版效果图' } })
    fireEvent.click(screen.getByRole('button', { name:'提交销售确认' }))
    expect(update).toHaveBeenCalledWith('d1', expect.objectContaining({ status:'待销售确认', solutionNote:'首版效果图', solutionFiles:[expect.objectContaining({ name:'客厅方案V1.pdf' })] }))
  })
})
