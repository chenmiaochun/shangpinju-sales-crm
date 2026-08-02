import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SalesDataProvider, useSalesData } from './SalesDataContext'

vi.mock('../api/salesApi', () => ({
  salesApi: {
    getState: vi.fn(async () => { throw new Error('offline') }),
    getDesigners: vi.fn(async () => ({ designers: [{ id: 'designer-1', name: '陈设计师' }] })),
    getSalespeople: vi.fn(async () => ({ salespeople: [{ id: 'sales-1', name: '吴销售' }] })),
    getDeliveryStaff: vi.fn(async () => ({ deliveryStaff: [] })),
    getAudit: vi.fn(async () => ({ items: [] })),
    getIntegrations: vi.fn(async () => ({ integrations: {} })),
    putState: vi.fn(),
  },
}))

function DirectoryProbe() {
  const { designers, salespeople, serverStatus } = useSalesData()
  return <div><span>{salespeople.map((item) => item.name).join('、')}</span><span>{designers.map((item) => item.name).join('、')}</span><span>{serverStatus}</span></div>
}

describe('employee assignment directories', () => {
  it('loads salespeople and designers even when shared state is offline', async () => {
    render(<SalesDataProvider><DirectoryProbe/></SalesDataProvider>)
    expect(await screen.findByText('吴销售')).toBeTruthy()
    expect(await screen.findByText('陈设计师')).toBeTruthy()
    expect(await screen.findByText('offline')).toBeTruthy()
  })
})
