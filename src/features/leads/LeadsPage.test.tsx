import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { LeadsPage } from './LeadsPage'

describe('LeadsPage customer intake', () => {
  it('shows the Excel row, customer and correction for every invalid import', async () => {
    const { container } = render(<LeadsPage customers={[]} onAddCustomers={vi.fn()} />)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['姓名', '负责人', '意向'],
      ['有效客户', '陈婉珊', '高'],
      ['傅记', '陈婉珊', '中高'],
      ['', '陈婉珊', '低'],
    ]), '客户')
    const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    const input = container.querySelector<HTMLInputElement>('.import-panel input[type="file"]')!
    fireEvent.change(input, { target: { files: [new File([bytes], '客户.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })] } })

    expect(await screen.findByText('2 行需要修改')).toBeTruthy()
    expect(screen.getByText('第 3 行')).toBeTruthy()
    expect(screen.getByText('傅记')).toBeTruthy()
    expect(screen.getByText('意向“中高”无效，请改为高、中或低')).toBeTruthy()
    expect(screen.getByText('第 4 行')).toBeTruthy()
    expect(screen.getByText('未填写姓名')).toBeTruthy()
    expect(screen.getByText('姓名必填')).toBeTruthy()
    expect(screen.getByText('修改 Excel 后重新选择文件')).toBeTruthy()
  })

  it('keeps vehicle fields together in plate, brand and series order', () => {
    render(<LeadsPage customers={[]} onAddCustomers={() => {}} />)
    const plate = screen.getByLabelText('车牌后五位')
    const brand = screen.getByLabelText('车辆品牌')
    const series = screen.getByLabelText('车辆系列')
    expect(plate.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(brand.compareDocumentPosition(series) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('按车牌、品牌、车系顺序登记')).toBeTruthy()
  })

  it('captures quote, discount and business file metadata', () => {
    const onAddCustomers = vi.fn()
    const { container } = render(<LeadsPage customers={[]} onAddCustomers={onAddCustomers} />)

    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '林女士' } })
    fireEvent.change(screen.getByLabelText('电话'), { target: { value: '13800138000' } })
    fireEvent.change(screen.getByLabelText('负责人 *'), { target: { value: '陈婉珊' } })
    fireEvent.change(screen.getByLabelText('预算范围'), { target: { value: '5-8 万' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: '初步报价金额 元' }), { target: { value: '58000' } })
    fireEvent.change(screen.getByLabelText('报价说明'), { target: { value: '客厅家具组合' } })
    fireEvent.change(screen.getByLabelText('优惠类型'), { target: { value: '节日活动' } })
    fireEvent.change(screen.getByLabelText('优惠详情'), { target: { value: '整单 95 折' } })

    const upload = container.querySelector<HTMLInputElement>('.business-upload input[type="file"]')
    expect(upload).not.toBeNull()
    fireEvent.change(upload!, { target: { files: [new File(['plan'], '户型图.pdf', { type: 'application/pdf' })] } })
    expect(screen.getByText('户型图.pdf')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '保存并进入客户跟进' }))

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
    expect(window.location.hash).toContain('/customers?customer=lead-')
  })

  it('allows an unknown budget and reports the actual required fields', () => {
    const onAddCustomers = vi.fn()
    render(<LeadsPage customers={[]} onAddCustomers={onAddCustomers} />)
    fireEvent.click(screen.getByRole('button', { name: '保存并进入客户跟进' }))
    expect(screen.getByRole('status').textContent).toContain('姓名、负责人')
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '陈女士' } })
    fireEvent.change(screen.getByLabelText('负责人 *'), { target: { value: '陈婉珊' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并进入客户跟进' }))
    expect(onAddCustomers.mock.calls[0][0][0]).toMatchObject({ name: '陈女士', budget: '待确认', expectedAmount: 0 })
  })

  it('renders the compact follow-up data fields without legacy style fields', () => {
    const { container } = render(<LeadsPage customers={[]} onAddCustomers={vi.fn()} />)

    expect(screen.getByText('跟进资料')).toBeTruthy()
    expect(screen.getByText('报价、优惠及客户资料登记')).toBeTruthy()
    expect(screen.getByText('支持 XLSX、XLS、UTF-8 CSV')).toBeTruthy()
    const productSelect = container.querySelector<HTMLDetailsElement>('.product-select')!
    fireEvent.click(productSelect.querySelector('summary')!)
    fireEvent.click(screen.getByLabelText('床垫'))
    fireEvent.click(screen.getByLabelText('床品'))
    fireEvent.click(screen.getByLabelText('软装饰品'))
    expect(productSelect.open).toBe(true)
    fireEvent.click(screen.getByRole('button', { name:'确定' }))
    expect(productSelect.open).toBe(false)
    expect(screen.getByText('床垫 | 床品 | 软装饰品')).toBeTruthy()
    expect(screen.queryByLabelText('偏好风格')).toBeNull()
    expect(screen.queryByLabelText('关注点')).toBeNull()
  })

  it('suggests vehicle series and stores its reference price', () => {
    const onAddCustomers = vi.fn()
    render(<LeadsPage customers={[]} onAddCustomers={onAddCustomers}/>)
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '林先生' } })
    fireEvent.change(screen.getByLabelText('负责人 *'), { target: { value: '陈婉珊' } })
    fireEvent.change(screen.getByLabelText('车辆品牌'), { target: { value: '宝马' } })
    fireEvent.change(screen.getByLabelText('车辆系列'), { target: { value: 'X5' } })
    expect(screen.getByText('参考新车价 62-80万')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '保存并进入客户跟进' }))
    expect(onAddCustomers.mock.calls[0][0][0]).toMatchObject({ vehicleBrand: '宝马', vehicleSeries: 'X5', vehiclePriceRange: '62-80万' })
  })

  it('links a community to its layouts and estimates the house value', () => {
    const onAddCustomers = vi.fn()
    render(<LeadsPage customers={[]} onAddCustomers={onAddCustomers}/>)
    fireEvent.change(screen.getByLabelText('姓名 *'), { target:{ value:'许女士' } })
    fireEvent.change(screen.getByLabelText('负责人 *'), { target:{ value:'陈婉珊' } })
    fireEvent.change(screen.getByLabelText('所在城市'), { target:{ value:'揭阳' } })
    fireEvent.change(screen.getByLabelText('小区名称'), { target:{ value:'jy-baoli' } })
    fireEvent.change(screen.getByLabelText('楼栋 / 房号'), { target:{ value:'8栋 1202' } })
    fireEvent.change(screen.getByLabelText('对应户型'), { target:{ value:'三房两厅' } })
    expect(screen.getByLabelText('建筑面积（㎡）')).toHaveProperty('value', '108')
    expect(screen.getByText('约 124-146 万元')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name:'保存并进入客户跟进' }))
    expect(onAddCustomers.mock.calls[0][0][0]).toMatchObject({ communityName:'保利锦城', communityDistrict:'榕城区', buildingRoom:'8栋 1202', houseLayout:'三房两厅', houseArea:108, houseValueRange:'约 124-146 万元' })
  })

  it('finds returning customers by license plate and stores the plate on new records', () => {
    const onAddCustomers = vi.fn()
    const existing = [{ id: 'returning-1', name: '黄先生', phone: '13900001111', licensePlate: '粤V12345', source: '门店自然到店', salesperson: '陈婉珊', stage: '到店' as const, intent: '中' as const, expectedAmount: 0, products: [], style: '', budget: '待确认', renovationProgress: '', concerns: [], lastContactAt: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01' }]
    render(<LeadsPage customers={existing} onAddCustomers={onAddCustomers}/>)

    expect(screen.getByLabelText('查找老客户').closest('aside')?.getAttribute('aria-label')).toBe('线索辅助工具')
    expect(screen.getByLabelText('查找老客户').closest('form')).toBeNull()
    fireEvent.change(screen.getByLabelText('查找老客户'), { target: { value: '粤v12345' } })
    expect(screen.getByText('黄先生')).toBeTruthy()
    expect(screen.getByText(/13900001111 · 粤V12345/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '陈女士' } })
    expect((screen.getByLabelText('车牌省份') as HTMLSelectElement).value).toBe('粤')
    expect((screen.getByLabelText('车牌字母') as HTMLSelectElement).value).toBe('V')
    expect(Array.from((screen.getByLabelText('车牌字母') as HTMLSelectElement).options).slice(0, 3).map((option) => option.value)).toEqual(['V', 'U', 'D'])
    fireEvent.change(screen.getByLabelText('车牌字母'), { target: { value: 'B' } })
    fireEvent.change(screen.getByLabelText('车牌后五位'), { target: { value: '88888' } })
    fireEvent.change(screen.getByLabelText('负责人 *'), { target: { value: '陈婉珊' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并进入客户跟进' }))
    expect(onAddCustomers.mock.calls[0][0][0].licensePlate).toBe('粤B88888')
  })
})
