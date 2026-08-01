import { describe, expect, it } from 'vitest'
import type { Customer, DesignTask, FollowUp } from '../types'
import { removeFormerDemoEmployees } from './SalesDataContext'

describe('sales data cleanup', () => {
  it('removes former demo employees and their related records', () => {
    const base: Omit<Customer, 'id' | 'name' | 'salesperson'> = { phone: '', source: '导入', stage: '新线索', intent: '中', expectedAmount: 0, products: [], style: '', budget: '', renovationProgress: '', concerns: [], lastContactAt: '2026-08-01', createdAt: '2026-08-01' }
    const customers = [
      { ...base, id: 'real', name: '真实客户', salesperson: '陈婉珊' },
      { ...base, id: 'demo', name: '演示客户', salesperson: '周然' },
    ]
    const followUps = [
      { id: 'f-real', customerId: 'real', salesperson: '陈婉珊' },
      { id: 'f-demo', customerId: 'demo', salesperson: '周然' },
    ] as FollowUp[]
    const designTasks = [
      { id: 'd-real', customerId: 'real', salesperson: '陈婉珊' },
      { id: 'd-demo', customerId: 'demo', salesperson: '周然' },
    ] as DesignTask[]

    expect(removeFormerDemoEmployees({ customers, followUps, designTasks, orders: [], deliveryTasks: [], afterSalesTickets: [], supplyDemands: [] })).toMatchObject({
      customers: [{ id: 'real' }], followUps: [{ id: 'f-real' }], designTasks: [{ id: 'd-real' }],
    })
  })

  it('migrates legacy combined visit stages and measuring channels', () => {
    const customer = { id: 'legacy', name: '旧客户', salesperson: '陈婉珊', stage: '到店/量房' } as unknown as Customer
    const followUp = { id: 'legacy-followup', customerId: 'legacy', salesperson: '陈婉珊', channel: '量房' } as unknown as FollowUp
    const migrated = removeFormerDemoEmployees({ customers: [customer], followUps: [followUp], designTasks: [], orders: [], deliveryTasks: [], afterSalesTickets: [], supplyDemands: [] })
    expect(migrated.customers[0].stage).toBe('到店')
    expect(migrated.followUps[0].channel).toBe('量尺')
  })
})
