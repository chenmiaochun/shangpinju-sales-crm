import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LeadsPage } from './LeadsPage'

describe('LeadsPage customer intake', () => {
  it('captures quote, discount and business file metadata', () => {
    const onAddCustomers = vi.fn()
    const { container } = render(<LeadsPage customers={[]} onAddCustomers={onAddCustomers} />)

    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '林女士' } })
    fireEvent.change(screen.getByLabelText('电话'), { target: { value: '13800138000' } })
    fireEvent.change(screen.getByLabelText('负责人 *'), { target: { value: '陈婉珊' } })
    fireEvent.change(screen.getByLabelText('预算范围 *'), { target: { value: '5-8 万' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '初步报价金额 元' }), { target: { value: '58000' } })
    fireEvent.change(screen.getByLabelText('报价说明'), { target: { value: '客厅家具组合' } })
    fireEvent.change(screen.getByLabelText('优惠类型'), { target: { value: '节日活动' } })
    fireEvent.change(screen.getByLabelText('优惠详情'), { target: { value: '整单 95 折' } })

    const upload = container.querySelector<HTMLInputElement>('.business-upload input[type="file"]')
    expect(upload).not.toBeNull()
    fireEvent.change(upload!, { target: { files: [new File(['plan'], '户型图.pdf', { type: 'application/pdf' })] } })
    expect(screen.getByText('户型图.pdf')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '新增客户' }))

    const customer = onAddCustomers.mock.calls[0][0][0]
    expect(customer).toMatchObject({
      name: '林女士',
      initialQuote: 58000,
      expectedAmount: 58000,
      quoteDescription: '客厅家具组合',
      discountType: '节日活动',
      discountDetails: '整单 95 折',
    })
    expect(customer.businessFiles).toEqual([
      expect.objectContaining({ name: '户型图.pdf', type: 'application/pdf' }),
    ])
  })

  it('renders the compact follow-up data fields without legacy style fields', () => {
    render(<LeadsPage customers={[]} onAddCustomers={vi.fn()} />)

    expect(screen.getByText('跟进资料')).toBeTruthy()
    expect(screen.getByText('报价、优惠及客户资料登记')).toBeTruthy()
    expect(screen.getByText('支持 XLSX、XLS、UTF-8 CSV')).toBeTruthy()
    expect(screen.queryByLabelText('偏好风格')).toBeNull()
    expect(screen.queryByLabelText('关注点')).toBeNull()
  })
})
