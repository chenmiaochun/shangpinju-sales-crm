import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { customers, followUps } from '../../data'
import { SalesSopPage } from './SalesSopPage'
import { getManualStorageKey } from './sop-engine'

describe('SalesSopPage', () => {
  beforeEach(() => localStorage.clear())
  it('renders the selected customer stage, guidance and all stages', () => {
    render(<SalesSopPage customers={customers} followUps={followUps} />)
    expect(screen.getByRole('heading', { name:'家具销售 SOP' })).toBeInTheDocument()
    expect(screen.getByText('当前阶段 · 2/3')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name:'报价' })).toBeInTheDocument()
    expect(screen.getByText('成品当场成交作业手册')).toBeInTheDocument()
    expect(screen.getAllByText('成交交付').length).toBeGreaterThan(0)
  })
  it('switches customer and persists manual confirmations', () => {
    render(<SalesSopPage customers={customers} followUps={followUps} />)
    fireEvent.change(screen.getByLabelText('选择客户'), { target:{ value:'c2' } })
    fireEvent.click(screen.getByRole('button', { name:/量尺定制/ }))
    expect(screen.getByText('当前阶段 · 3/8')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name:'销售阶段' })).getByRole('button', { name:/上门量尺/ }))
    const checkbox = screen.getByRole('checkbox', { name:/尺寸、照片与现场限制已归档/ })
    fireEvent.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(JSON.parse(localStorage.getItem(getManualStorageKey('c2')) ?? '{}')).toMatchObject({ 'measure-records':true })
  })
  it('switches paths and lets users open a separate stage from the stage track', () => {
    render(<SalesSopPage customers={customers} followUps={followUps} />)
    fireEvent.click(screen.getByRole('button', { name:/量尺定制/ }))
    expect(screen.getByText('量尺定制作业手册')).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('navigation', { name:'销售阶段' })).getByRole('button', { name:/上门量尺/ }))
    expect(screen.getByText('查看阶段 · 4/8')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name:'上门量尺' })).toBeInTheDocument()
    expect(screen.getAllByText('量尺是独立的上门工作，不等同于到店。', { exact:false }).length).toBeGreaterThan(0)
  })
  it('shows a useful empty state', () => {
    render(<SalesSopPage customers={[]} followUps={[]} />)
    expect(screen.getByText('录入客户后即可按阶段检查销售动作。')).toBeInTheDocument()
  })
})
