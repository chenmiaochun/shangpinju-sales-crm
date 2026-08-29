import { describe, expect, it } from 'vitest'
import type { Customer, FollowUp } from '../../types'
import { buildSalesInsights } from './insights'

const base = { phone:'1', salesperson:'小林', products:[], style:'', budget:'', renovationProgress:'', concerns:[] }
const customers: Customer[] = [
  { ...base, id:'c1', name:'甲', source:'小红书', products:['沙发','床垫'], stage:'已报价', intent:'高', expectedAmount:100000, lastContactAt:'2026-07-20', nextFollowUpAt:'2026-07-31', createdAt:'2026-07-15' },
  { ...base, id:'c2', name:'乙', source:'小红书', products:['沙发'], stage:'需求确认', intent:'中', expectedAmount:50000, lastContactAt:'2026-07-29', createdAt:'2026-07-25' },
  { ...base, id:'c3', name:'丙', source:'转介绍', stage:'已流失', intent:'低', expectedAmount:30000, lastContactAt:'2026-07-10', createdAt:'2026-06-01', lostReason:'价格偏高' },
]
const followUps: FollowUp[] = [
  { id:'f1', customerId:'c1', at:'2026-07-29', channel:'微信', content:'沟通', result:'已报价', nextAction:'电话确认', nextAt:'2026-07-31', salesperson:'小林' },
  { id:'f2', customerId:'c2', at:'2026-07-28', channel:'电话', content:'沟通', result:'', salesperson:'小林' },
]

describe('buildSalesInsights', () => {
  const now = new Date('2026-07-30T12:00:00+08:00')
  it('aggregates source quality, activity and stage risk', () => {
    const result = buildSalesInsights(customers, followUps, 30, now)
    expect(result.sources[0]).toMatchObject({ source:'小红书', leads:2, highIntent:1, amount:150000, highIntentRate:50 })
    expect(result.activity).toMatchObject({ total:2, activeCustomers:2, coverageRate:100, nextActionRate:50, resultRate:50, averagePerActiveCustomer:1 })
    expect(result.stageRisks.find((item) => item.stage === '已报价')).toMatchObject({ riskCustomers:1, amountAtRisk:100000 })
    expect(result.suggestions.some((item) => item.includes('下一步'))).toBe(true)
    expect(result.products[0]).toMatchObject({ product:'沙发', interestedCustomers:2, highIntent:1, highIntentRate:50, amount:150000, activityAdvice:'适合组合促销' })
    expect(result.suggestions.some((item) => item.includes('沙发'))).toBe(true)
  })
  it('groups lost reasons across all historical customers', () => {
    expect(buildSalesInsights(customers, followUps, 7, now).lostReasons[0]).toEqual({ reason:'价格偏高', count:1, amount:30000, share:100 })
  })
  it('returns valid zero metrics for empty input', () => {
    const result = buildSalesInsights([], [], 90, now)
    expect(result.trend).toHaveLength(6)
    expect(result.activity).toEqual({ total:0, activeCustomers:0, coverageRate:0, nextActionRate:0, resultRate:0, averagePerActiveCustomer:0 })
    expect(result.sources).toEqual([])
    expect(result.products).toEqual([])
    expect(result.suggestions).toEqual([])
  })
})
