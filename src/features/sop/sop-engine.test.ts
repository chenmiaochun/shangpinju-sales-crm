import { describe, expect, it } from 'vitest'
import type { Customer, FollowUp } from '../../types'
import { evaluateSalesSop, getSopStages, SOP_STAGES } from './sop-engine'

const customer: Customer = { id:'c1', name:'张女士', phone:'13800000000', source:'转介绍', salesperson:'林晓', stage:'需求确认', intent:'高', expectedAmount:86000, products:['客厅套系'], style:'现代原木', budget:'8-10万', renovationProgress:'硬装收尾', concerns:['交期'], lastContactAt:'2026-07-29', nextFollowUpAt:'2026-07-31', createdAt:'2026-07-12' }
const followUps: FollowUp[] = [{ id:'f1', customerId:'c1', at:'2026-07-29', channel:'微信', content:'客户与爱人共同决策，计划九月入住', result:'确认品类与预算', nextAction:'预约到店', nextAt:'2026-07-31', salesperson:'林晓' }]

describe('sales SOP engine', () => {
  it('defines fast retail, retail follow-up and custom paths', () => {
    expect(getSopStages('retail-fast').map((x) => x.name)).toEqual(['到店体验','报价','成交交付'])
    expect(getSopStages('retail-followup').map((x) => x.name)).toEqual(['新线索','需求确认','到店体验','再次到店','报价','成交交付'])
    expect(getSopStages('custom').map((x) => x.name)).toEqual(['新线索','需求确认','到店体验','上门量尺','方案设计','报价','方案调整','成交交付'])
    expect(SOP_STAGES.every((x) => x.questions.length && x.actions.length && x.conditions.length && x.risks.length && x.script)).toBe(true)
  })
  it('infers completed checklist items from customer fields and follow-up text', () => {
    const result = evaluateSalesSop(customer, followUps)
    expect(result.currentStage.name).toBe('需求确认')
    expect(result.currentStage.items.every((x) => x.completed)).toBe(true)
    expect(result.readyForNextStage).toBe(true)
    expect(result.actions[0]).toContain('到店体验')
  })
  it('returns missing actions and accepts manual confirmations', () => {
    const sparse = { ...customer, products:[], style:'', budget:'', expectedAmount:0, renovationProgress:'', concerns:[] }
    const first = evaluateSalesSop(sparse, [])
    expect(first.readyForNextStage).toBe(false)
    expect(first.actions).toContain('目标空间与品类已明确')
    const manual = Object.fromEntries(first.currentStage.items.map((x) => [x.id, true]))
    expect(evaluateSalesSop(sparse, [], manual).readyForNextStage).toBe(true)
  })
})
