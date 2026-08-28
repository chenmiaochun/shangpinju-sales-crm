import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { DesignTask } from '../../types'
import { DesignerWorkspacePage } from './DesignerWorkspacePage'

const now = new Date('2026-08-24T12:00:00+08:00')
const base: Omit<DesignTask, 'id' | 'customerName' | 'status' | 'dueAt'> = {
  customerId: 'c1', salesperson: '陈妙纯', designerId: 'designer-1', designerName: '郭予旭',
  type: '效果图', requirement: '完成客厅效果图', priority: '普通', referenceFiles: [], solutionFiles: [],
  createdAt: '2026-08-20T10:00:00+08:00', updatedAt: '2026-08-20T10:00:00+08:00',
}

describe('DesignerWorkspacePage', () => {
  it('shows only the signed-in designer tasks and dashboard counts', () => {
    const tasks: DesignTask[] = [
      { ...base, id: 'd1', customerName: '陈纯', status: '待接收', dueAt: '2026-08-25T10:00:00+08:00' },
      { ...base, id: 'd2', customerName: '张三', status: '设计中', dueAt: '2026-08-23T10:00:00+08:00' },
      { ...base, id: 'd3', customerName: '其他设计师客户', designerId: 'designer-2', designerName: '林设计师', status: '待接收', dueAt: '2026-08-25T10:00:00+08:00' },
    ]
    render(<DesignerWorkspacePage tasks={tasks} activeMember={{ id: 'designer-1', name: '郭予旭', role: 'designer', active: true }} onUpdateTask={() => {}} now={now} />)
    expect(screen.getByRole('heading', { name: '我的工作台' })).toBeInTheDocument()
    expect(screen.getByText('陈纯')).toBeInTheDocument()
    expect(screen.getByText('张三')).toBeInTheDocument()
    expect(screen.queryByText('其他设计师客户')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '已逾期' }))
    expect(screen.getByText('张三')).toBeInTheDocument()
    expect(screen.queryByText('陈纯')).not.toBeInTheDocument()
  })

  it('accepts a task and persists the status through the update callback', () => {
    const update = vi.fn()
    render(<DesignerWorkspacePage tasks={[{ ...base, id: 'd1', customerName: '陈纯', status: '待接收', dueAt: '2026-08-25T10:00:00+08:00' }]} activeMember={{ id: 'designer-1', name: '郭予旭', role: 'designer', active: true }} onUpdateTask={update} now={now} />)
    fireEvent.click(screen.getByRole('button', { name: '接收并开始设计' }))
    expect(update).toHaveBeenCalledWith('d1', expect.objectContaining({ status: '设计中', acceptedAt: expect.any(String), timeline: [expect.objectContaining({ type: '任务接收' })] }))
  })
})
