import type { Customer, CustomerStage, FollowUp } from '../../types'

const DAY = 86_400_000
const WINDOW_DAYS = 7
const CLOSED = new Set<CustomerStage>(['已成交', '已流失'])
const STAGES: CustomerStage[] = ['新线索', '已初聊', '需求确认', '到店', '量尺', '方案设计', '已报价', '方案调整', '已定金', '生产交付', '已成交', '已流失']

export interface RateMetric {
  value: number
  numerator: number
  denominator: number
  explanation: string
}

export interface CoachingCase {
  customerId: string
  customerName: string
  stage: CustomerStage
  amount: number
  reason: string
}

export interface SalespersonCoaching {
  salesperson: string
  customerCount: number
  followUpCount: number
  opportunityAmount: number
  riskCustomerCount: number
  timelyRate: RateMetric
  effectiveRecordRate: RateMetric
  nextPlanRate: RateMetric
  stageHealthRate: RateMetric
  score: number
  scoreExplanation: string
  lowData: boolean
  excellentCases: CoachingCase[]
  reviewCases: CoachingCase[]
  suggestions: string[]
  trainingTasks: string[]
}

export interface CoachingReport {
  windowDays: number
  members: SalespersonCoaching[]
  team: SalespersonCoaching
}

const time = (value?: string) => {
  const parsed = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}
const percent = (numerator: number, denominator: number) => denominator ? Math.round(numerator / denominator * 100) : 0
const metric = (numerator: number, denominator: number, explanation: string): RateMetric => ({ value: percent(numerator, denominator), numerator, denominator, explanation })

function analyzePerson(salesperson: string, customers: Customer[], followUps: FollowUp[], now: Date): SalespersonCoaching {
  const nowTime = now.getTime()
  const start = nowTime - WINDOW_DAYS * DAY
  const ownedCustomers = salesperson === '团队总览' ? customers : customers.filter((item) => item.salesperson === salesperson)
  const customerIds = new Set(ownedCustomers.map((item) => item.id))
  const recentFollowUps = followUps.filter((item) => customerIds.has(item.customerId) && time(item.at) >= start && time(item.at) <= nowTime)
  const active = ownedCustomers.filter((item) => !CLOSED.has(item.stage))

  const dueCustomers = active.filter((item) => {
    const due = time(item.nextFollowUpAt)
    return due > 0 && due >= start && due <= nowTime
  })
  const timelyCustomers = dueCustomers.filter((customer) => recentFollowUps.some((item) => item.customerId === customer.id && time(item.at) <= time(customer.nextFollowUpAt) + DAY))
  const effective = recentFollowUps.filter((item) => item.content.trim().length >= 10 && item.result.trim().length >= 4)
  const planned = recentFollowUps.filter((item) => Boolean(item.nextAction?.trim()) && time(item.nextAt) > 0)
  const healthy = active.filter((customer) => {
    const idleDays = (nowTime - time(customer.lastContactAt)) / DAY
    const hasRecentProgress = recentFollowUps.some((item) => item.customerId === customer.id && item.result.trim().length >= 4)
    const hasFuturePlan = time(customer.nextFollowUpAt) >= nowTime || recentFollowUps.some((item) => item.customerId === customer.id && time(item.nextAt) >= nowTime)
    return idleDays <= 7 && (hasRecentProgress || hasFuturePlan)
  })
  const risks = active.filter((item) => nowTime - time(item.lastContactAt) > 7 * DAY || (time(item.nextFollowUpAt) > 0 && time(item.nextFollowUpAt) < nowTime - DAY))

  const timelyRate = metric(timelyCustomers.length, dueCustomers.length, '近7天到期客户中，在计划时间后24小时内完成跟进的客户')
  const effectiveRecordRate = metric(effective.length, recentFollowUps.length, '近7天记录中，内容不少于10字且结果不少于4字的记录')
  const nextPlanRate = metric(planned.length, recentFollowUps.length, '近7天记录中，同时填写下一步动作和执行时间的记录')
  const stageHealthRate = metric(healthy.length, active.length, '在跟客户中，7天内有联系且有推进结果或未来计划的客户')
  const score = Math.round(timelyRate.value * .3 + effectiveRecordRate.value * .25 + nextPlanRate.value * .25 + stageHealthRate.value * .2)

  const excellentCases = active.filter((customer) => {
    const records = recentFollowUps.filter((item) => item.customerId === customer.id)
    return records.some((item) => item.content.trim().length >= 10 && item.result.trim().length >= 4 && item.nextAction?.trim() && time(item.nextAt) >= nowTime)
  }).slice(0, 3).map((customer) => ({ customerId: customer.id, customerName: customer.name, stage: customer.stage, amount: customer.expectedAmount, reason: '记录完整，已有明确结果和后续动作' }))

  const reviewCases = risks.sort((a, b) => b.expectedAmount - a.expectedAmount).slice(0, 4).map((customer) => ({
    customerId: customer.id, customerName: customer.name, stage: customer.stage, amount: customer.expectedAmount,
    reason: nowTime - time(customer.lastContactAt) > 7 * DAY ? `已${Math.floor((nowTime - time(customer.lastContactAt)) / DAY)}天未联系` : '下一次跟进已逾期',
  }))

  const suggestions: string[] = []
  if (timelyRate.denominator && timelyRate.value < 80) suggestions.push(`优先清理 ${timelyRate.denominator - timelyRate.numerator} 个未及时触达的到期客户，每日下班前核对计划。`)
  if (effectiveRecordRate.denominator && effectiveRecordRate.value < 80) suggestions.push('使用“客户反馈 - 判断 - 结果”结构补全跟进记录，避免只记沟通动作。')
  if (nextPlanRate.denominator && nextPlanRate.value < 80) suggestions.push('每次沟通结束前确认下一动作、负责人和具体时间，并同步写入记录。')
  if (stageHealthRate.denominator && stageHealthRate.value < 80) suggestions.push(`逐一复盘 ${stageHealthRate.denominator - stageHealthRate.numerator} 个阶段不健康商机，明确卡点或及时降级。`)
  if (!suggestions.length && active.length) suggestions.push('当前基础动作稳定，建议复盘优秀案例并复制其提问与推进方式。')
  if (!ownedCustomers.length) suggestions.push('当前无归属客户，分配线索后再生成针对性辅导建议。')

  const trainingTasks = [
    effectiveRecordRate.value < 80 ? '本周抽检5条跟进记录，按完整记录模板重写' : '分享1条完整跟进记录，讲解判断依据',
    timelyRate.value < 80 ? '连续5个工作日完成当日到期客户清零' : '为3个高意向客户设置提前量明确的跟进计划',
    stageHealthRate.value < 80 ? '选择2个停滞商机完成一次角色扮演复盘' : '整理1个阶段推进案例供团队演练',
  ]

  return {
    salesperson, customerCount: ownedCustomers.length, followUpCount: recentFollowUps.length,
    opportunityAmount: active.reduce((sum, item) => sum + item.expectedAmount, 0), riskCustomerCount: risks.length,
    timelyRate, effectiveRecordRate, nextPlanRate, stageHealthRate, score,
    scoreExplanation: `及时跟进 ${timelyRate.value}% × 30% + 有效记录 ${effectiveRecordRate.value}% × 25% + 下一步计划 ${nextPlanRate.value}% × 25% + 阶段健康 ${stageHealthRate.value}% × 20% = ${score}分`,
    lowData: ownedCustomers.length < 3 || recentFollowUps.length < 3,
    excellentCases, reviewCases, suggestions, trainingTasks,
  }
}

export function buildCoachingReport(customers: Customer[], followUps: FollowUp[], now = new Date()): CoachingReport {
  const names = [...new Set([...customers.map((item) => item.salesperson), ...followUps.map((item) => item.salesperson)])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const members = names.map((name) => analyzePerson(name, customers, followUps, now)).sort((a, b) => b.score - a.score || b.opportunityAmount - a.opportunityAmount)
  return { windowDays: WINDOW_DAYS, members, team: analyzePerson('团队总览', customers, followUps, now) }
}

export function formatCoachingMoney(amount: number) {
  return amount >= 10_000 ? `${Number((amount / 10_000).toFixed(1))}万` : amount.toLocaleString('zh-CN')
}
