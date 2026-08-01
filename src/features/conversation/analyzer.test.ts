import { describe, expect, it } from 'vitest'
import { analyzeConversation } from './analyzer'

describe('analyzeConversation', () => {
  it('extracts structured customer needs with deterministic rules', () => {
    const result = analyzeConversation(`客户：新房正在做水电，想做全屋定制，喜欢现代简约。\n客户：预算大概15万左右，希望下个月能装，担心工期来不及。\n客户：价格合适周末我和老公到店看方案，麻烦先发案例。`)
    expect(result.fields.budget.value).toBe('15万')
    expect(result.fields.products.value).toContain('全屋定制')
    expect(result.fields.style.value).toBe('现代简约')
    expect(result.fields.renovationProgress.value).toBe('水电阶段')
    expect(result.fields.delivery.value).toContain('下月')
    expect(result.fields.decisionMaker.value).toContain('夫妻共同决策')
    expect(result.fields.objections.value).toContain('担心交期')
    expect(result.fields.buyingSignals.value).toContain('预约到店')
    expect(result.fields.commitments.value).toContain('销售需报价/发资料')
    expect(result.suggestedStage).toBe('方案设计')
  })

  it('returns a safe empty result for blank text', () => {
    const result = analyzeConversation('   \n ')
    expect(result.summary).toBe('暂无可分析的沟通内容。')
    expect(result.evidenceCount).toBe(0)
    expect(result.nextTasks).toEqual([])
    expect(result.fields.budget).toEqual({ value: '未提及', evidence: [] })
  })

  it('distinguishes an on-site measuring appointment from a store visit', () => {
    const result = analyzeConversation('客户：周六可以安排师傅上门量尺。')
    expect(result.fields.buyingSignals.value).toContain('预约量尺')
    expect(result.suggestedStage).toBe('量尺')
  })

  it('keeps exact source lines as evidence', () => {
    const source = '销售：您比较关注什么？\n客户：我觉得价格有点贵，还要和家里人商量。'
    const result = analyzeConversation(source)
    expect(result.fields.objections.evidence).toEqual([{ quote: '客户：我觉得价格有点贵，还要和家里人商量。', line: 2 }])
    expect(result.fields.decisionMaker.evidence[0]).toEqual({ quote: '客户：我觉得价格有点贵，还要和家里人商量。', line: 2 })
  })
})
