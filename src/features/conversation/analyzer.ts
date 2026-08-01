import type { CustomerStage } from '../../types'

export interface ConversationEvidence {
  quote: string
  line: number
}

export interface ExtractedInsight {
  value: string
  evidence: ConversationEvidence[]
}

export type ConversationField =
  | 'budget' | 'products' | 'style' | 'renovationProgress' | 'delivery'
  | 'decisionMaker' | 'objections' | 'buyingSignals' | 'sentiment' | 'commitments'

export interface ConversationAnalysis {
  fields: Record<ConversationField, ExtractedInsight>
  summary: string
  blockers: string[]
  suggestedStage: CustomerStage
  nextTasks: string[]
  suggestedMessage: string
  evidenceCount: number
}

type Rule = { value: string; pattern: RegExp }

const RULES: Record<Exclude<ConversationField, 'budget' | 'sentiment'>, Rule[]> = {
  products: [
    { value: '全屋定制', pattern: /全屋定制|全屋柜/ }, { value: '衣柜', pattern: /衣柜|衣帽间/ },
    { value: '橱柜', pattern: /橱柜|厨房柜/ }, { value: '电视柜', pattern: /电视柜/ },
    { value: '书柜', pattern: /书柜|书房柜/ }, { value: '餐边柜', pattern: /餐边柜/ },
  ],
  style: [
    { value: '现代简约', pattern: /现代简约|简约风/ }, { value: '奶油风', pattern: /奶油风|奶油系/ },
    { value: '原木风', pattern: /原木风|原木色/ }, { value: '轻奢', pattern: /轻奢/ },
    { value: '新中式', pattern: /新中式|中式风/ }, { value: '北欧', pattern: /北欧/ },
  ],
  renovationProgress: [
    { value: '毛坯/待开工', pattern: /毛坯|还没开工|准备开工/ }, { value: '水电阶段', pattern: /水电/ },
    { value: '泥木阶段', pattern: /泥工|木工|贴砖/ }, { value: '油漆阶段', pattern: /油漆|刷漆/ },
    { value: '硬装完成', pattern: /硬装.*(?:完成|结束)|已经装完/ }, { value: '已量房', pattern: /量过房|已量房/ },
  ],
  delivery: [
    { value: '本月', pattern: /这个月|本月/ }, { value: '下月', pattern: /下个月|下月/ },
    { value: '年前', pattern: /年前/ }, { value: '尽快', pattern: /尽快|越快越好|着急|急着/ },
    { value: '指定日期', pattern: /\d{1,2}[月\/.-]\d{1,2}(?:日|号)?(?:前|之前|左右)?/ },
  ],
  decisionMaker: [
    { value: '本人决策', pattern: /我(?:自己)?定|我做主|我决定/ }, { value: '夫妻共同决策', pattern: /夫妻|两口子|我(?:和|跟)(?:老公|老婆|爱人)|我(?:老公|老婆|爱人).*(?:商量|决定)|和(?:老公|老婆|爱人).*(?:商量|决定)/ },
    { value: '家人参与决策', pattern: /父母|家里人|家人.*(?:商量|决定|看看)/ }, { value: '设计师参与', pattern: /设计师.*(?:确认|决定|看看)/ },
  ],
  objections: [
    { value: '价格偏高', pattern: /太贵|有点贵|价格高|超预算|便宜点|优惠/ }, { value: '担心环保', pattern: /环保|甲醛|气味/ },
    { value: '担心交期', pattern: /工期|交期|来不及|太慢/ }, { value: '仍在比价', pattern: /对比|比价|再看看|其他家|别家/ },
    { value: '方案待调整', pattern: /方案.*(?:改|调整)|不喜欢|不满意/ }, { value: '品质疑虑', pattern: /质量|五金|板材|耐用/ },
  ],
  buyingSignals: [
    { value: '询问价格/优惠', pattern: /多少钱|报价|价格|优惠|折扣/ }, { value: '询问交期', pattern: /多久能做|什么时候能装|交期|工期/ },
    { value: '预约到店', pattern: /到店|去你们店/ }, { value: '预约量尺', pattern: /量房|量尺|上门量/ }, { value: '索要方案/合同', pattern: /出方案|看方案|合同|下单/ },
    { value: '确认付款', pattern: /定金|付款|怎么付|刷卡|转账/ },
  ],
  commitments: [
    { value: '客户将回复/确认', pattern: /我.*(?:回复|确认|答复)|回头告诉你|晚点联系/ }, { value: '客户将到店', pattern: /我.*(?:到店|去店里)|周末.*(?:过去|到店)/ },
    { value: '销售需报价/发资料', pattern: /你.*(?:报价|发.*(?:方案|资料|案例|色卡))|麻烦(?:先)?发|请(?:先)?发/ }, { value: '销售需预约量房', pattern: /安排.*量房|约.*量房|上门量房/ },
  ],
}

const EMPTY: ExtractedInsight = { value: '未提及', evidence: [] }

function linesOf(text: string) {
  return text.split(/\r?\n/).map((raw, index) => ({ text: raw.trim(), line: index + 1 })).filter((line) => line.text)
}

function collect(text: string, rules: Rule[]): ExtractedInsight {
  const matches: { value: string; evidence: ConversationEvidence }[] = []
  for (const line of linesOf(text)) for (const rule of rules) {
    rule.pattern.lastIndex = 0
    if (rule.pattern.test(line.text) && !matches.some((item) => item.value === rule.value)) matches.push({ value: rule.value, evidence: { quote: line.text, line: line.line } })
  }
  return matches.length ? { value: matches.map((item) => item.value).join('、'), evidence: matches.map((item) => item.evidence) } : EMPTY
}

function extractBudget(text: string): ExtractedInsight {
  const patterns = [/(?:预算|控制在|大概|差不多|准备)[^\n，。；]{0,8}?((?:\d+(?:\.\d+)?)\s*(?:万|w|W|元)(?:\s*[-到至~～]\s*\d+(?:\.\d+)?\s*(?:万|w|W|元))?)/, /((?:\d+(?:\.\d+)?)\s*(?:万|w|W)\s*(?:左右|以内|上下))/]
  for (const line of linesOf(text)) for (const pattern of patterns) {
    const match = line.text.match(pattern)
    if (match) return { value: match[1].replace(/\s/g, '').replace(/[wW]/g, '万'), evidence: [{ quote: line.text, line: line.line }] }
  }
  return EMPTY
}

function extractSentiment(text: string): ExtractedInsight {
  const positive = /满意|喜欢|不错|可以|合适|期待|放心|认可|挺好/
  const negative = /不满|不喜欢|担心|顾虑|纠结|失望|太贵|着急|不行/
  const evidence = linesOf(text).filter((line) => positive.test(line.text) || negative.test(line.text)).map((line) => ({ quote: line.text, line: line.line }))
  const positiveCount = evidence.filter((item) => positive.test(item.quote)).length
  const negativeCount = evidence.filter((item) => negative.test(item.quote)).length
  const value = positiveCount > negativeCount ? '积极' : negativeCount > positiveCount ? '谨慎/负向' : evidence.length ? '中性偏谨慎' : '中性'
  return { value, evidence: evidence.slice(0, 3) }
}

function chooseStage(fields: ConversationAnalysis['fields']): CustomerStage {
  if (fields.buyingSignals.value.includes('确认付款')) return '已定金'
  if (fields.buyingSignals.value.includes('索要方案/合同')) return '方案设计'
  if (fields.buyingSignals.value.includes('预约量尺')) return '量尺'
  if (fields.buyingSignals.value.includes('预约到店')) return '到店'
  if (['budget', 'products', 'style', 'renovationProgress'].filter((key) => fields[key as ConversationField].evidence.length).length >= 2) return '需求确认'
  return '已初聊'
}

export function analyzeConversation(input: string): ConversationAnalysis {
  const text = input.trim()
  const fields = {
    budget: extractBudget(text), products: collect(text, RULES.products), style: collect(text, RULES.style),
    renovationProgress: collect(text, RULES.renovationProgress), delivery: collect(text, RULES.delivery),
    decisionMaker: collect(text, RULES.decisionMaker), objections: collect(text, RULES.objections),
    buyingSignals: collect(text, RULES.buyingSignals), sentiment: extractSentiment(text), commitments: collect(text, RULES.commitments),
  }
  if (!text) return { fields, summary: '暂无可分析的沟通内容。', blockers: [], suggestedStage: '新线索', nextTasks: [], suggestedMessage: '', evidenceCount: 0 }
  const known = (Object.entries(fields) as [ConversationField, ExtractedInsight][]).filter(([key, field]) => key !== 'sentiment' && field.evidence.length)
  const summaryParts = [fields.products.value !== '未提及' && `关注${fields.products.value}`, fields.budget.value !== '未提及' && `预算${fields.budget.value}`, fields.style.value !== '未提及' && `偏好${fields.style.value}`, fields.renovationProgress.value !== '未提及' && `装修处于${fields.renovationProgress.value}`].filter(Boolean)
  const blockers = fields.objections.evidence.length ? fields.objections.value.split('、') : []
  const nextTasks = [
    fields.commitments.evidence.length ? `兑现承诺：${fields.commitments.value}` : '确认客户下一次沟通时间',
    fields.budget.evidence.length ? null : '补充确认预算范围', fields.decisionMaker.evidence.length ? null : '确认参与决策的人员',
    blockers.length ? `针对“${blockers[0]}”准备回应与证明材料` : null,
  ].filter((item): item is string => Boolean(item))
  const focus = fields.products.value === '未提及' ? '您的定制需求' : fields.products.value
  const message = `您好，刚才沟通的${focus}需求我已记录。${blockers.length ? `关于您关心的“${blockers[0]}”，我会整理清楚方案和依据。` : '我会按您提到的需求整理下一步方案。'}稍后与您确认，您看方便吗？`
  return { fields, summary: summaryParts.length ? `${summaryParts.join('，')}。` : '已完成沟通记录整理，关键需求仍需进一步确认。', blockers, suggestedStage: chooseStage(fields), nextTasks, suggestedMessage: message, evidenceCount: known.reduce((sum, [, field]) => sum + field.evidence.length, 0) + fields.sentiment.evidence.length }
}
