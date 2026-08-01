import type { Customer, FollowUp } from '../../types'

export type QualityDimension =
  | '成交意向'
  | '需求成熟度'
  | '关系活跃度'
  | '跟进健康度'

export interface ScoreEvidence {
  label: string
  impact: number
  detail: string
}

export interface DimensionScore {
  name: QualityDimension
  score: number
  summary: string
  evidence: ScoreEvidence[]
}

export interface SuggestedAction {
  priority: '高' | '中' | '低'
  action: string
  reason: string
}

export interface QualityReport {
  customerId: string
  overallScore: number
  dimensions: Record<QualityDimension, DimensionScore>
  risks: string[]
  missingInformation: string[]
  nextActions: SuggestedAction[]
  scripts: string[]
}

const STAGE_SCORE: Record<string, number> = {
  新线索: 20,
  已初联: 30,
  需求确认: 45,
  到店: 52,
  量尺: 62,
  方案设计: 65,
  已报价: 75,
  方案调整: 72,
  已定金: 92,
  生产交付: 96,
  已成交: 100,
  已流失: 0,
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

function daysBetween(earlier: string, later: Date) {
  return Math.floor((later.getTime() - new Date(earlier).getTime()) / 86_400_000)
}

function dimension(
  name: QualityDimension,
  base: number,
  evidence: ScoreEvidence[],
): DimensionScore {
  const score = clamp(base + evidence.reduce((sum, item) => sum + item.impact, 0))
  return {
    name,
    score,
    summary: score >= 80 ? '表现良好' : score >= 60 ? '需要持续推进' : '需要重点改善',
    evidence,
  }
}

function hasText(value: string | undefined) {
  return Boolean(value?.trim())
}

export function scoreCustomer(
  customer: Customer,
  followUps: FollowUp[],
  now: Date = new Date(),
): QualityReport {
  const history = followUps
    .filter((item) => item.customerId === customer.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  const latest = history[0]
  const inactiveDays = Math.max(0, daysBetween(customer.lastContactAt, now))
  const nextAt = customer.nextFollowUpAt ? new Date(customer.nextFollowUpAt) : undefined
  const isOverdue = Boolean(nextAt && nextAt.getTime() < now.getTime())

  const intentEvidence: ScoreEvidence[] = [
    { label: '客户阶段', impact: STAGE_SCORE[customer.stage] ?? 20, detail: `当前处于“${customer.stage}”阶段` },
    { label: '人工意向', impact: customer.intent === '高' ? 15 : customer.intent === '中' ? 5 : -10, detail: `销售标注意向为“${customer.intent}”` },
    { label: '预计金额', impact: customer.expectedAmount > 0 ? 5 : -5, detail: customer.expectedAmount > 0 ? `已登记预计金额 ¥${customer.expectedAmount.toLocaleString('zh-CN')}` : '未登记预计金额' },
  ]
  const intent = dimension('成交意向', 0, intentEvidence)

  const maturityEvidence: ScoreEvidence[] = [
    { label: '产品范围', impact: customer.products.length ? 20 : 0, detail: customer.products.length ? `已明确 ${customer.products.join('、')}` : '尚未明确意向产品' },
    { label: '风格偏好', impact: hasText(customer.style) ? 15 : 0, detail: hasText(customer.style) ? `偏好 ${customer.style}` : '尚未记录风格偏好' },
    { label: '预算', impact: hasText(customer.budget) ? 25 : 0, detail: hasText(customer.budget) ? `预算为 ${customer.budget}` : '尚未记录预算' },
    { label: '装修进度', impact: hasText(customer.renovationProgress) ? 20 : 0, detail: hasText(customer.renovationProgress) ? `当前 ${customer.renovationProgress}` : '尚未记录装修进度' },
    { label: '核心顾虑', impact: customer.concerns.length ? 20 : 0, detail: customer.concerns.length ? `已识别 ${customer.concerns.join('、')}` : '尚未识别核心顾虑' },
  ]
  const maturity = dimension('需求成熟度', 0, maturityEvidence)

  const activityEvidence: ScoreEvidence[] = [
    { label: '最近联系', impact: inactiveDays <= 2 ? 35 : inactiveDays <= 7 ? 20 : inactiveDays <= 14 ? 5 : -15, detail: inactiveDays === 0 ? '今天有联系' : `距最近联系 ${inactiveDays} 天` },
    { label: '跟进次数', impact: Math.min(30, history.length * 10), detail: `系统中有 ${history.length} 条跟进记录` },
    { label: '有效结果', impact: history.some((item) => hasText(item.result)) ? 20 : 0, detail: history.some((item) => hasText(item.result)) ? '最近跟进已记录结果' : '跟进未沉淀结果' },
    { label: '后续约定', impact: nextAt ? 15 : 0, detail: nextAt ? `已约定 ${nextAt.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '尚无下次联系时间' },
  ]
  const activity = dimension('关系活跃度', 20, activityEvidence)

  const healthEvidence: ScoreEvidence[] = [
    { label: '跟进时效', impact: isOverdue ? -35 : nextAt ? 20 : -15, detail: isOverdue ? '下次跟进已逾期' : nextAt ? '下次跟进仍在计划内' : '未安排下次跟进' },
    { label: '行动明确度', impact: hasText(latest?.nextAction) ? 25 : -10, detail: hasText(latest?.nextAction) ? `下一步：${latest?.nextAction}` : '最近记录没有下一步行动' },
    { label: '联系间隔', impact: inactiveDays <= 7 ? 20 : inactiveDays <= 14 ? 5 : -20, detail: inactiveDays <= 7 ? '联系节奏正常' : `已连续 ${inactiveDays} 天未联系` },
    { label: '记录完整度', impact: latest && hasText(latest.content) && hasText(latest.result) ? 15 : 0, detail: latest && hasText(latest.content) && hasText(latest.result) ? '最近记录包含沟通内容和结果' : '最近跟进记录不完整' },
  ]
  const health = dimension('跟进健康度', 35, healthEvidence)

  const missingInformation = [
    !customer.products.length && '意向产品',
    !hasText(customer.style) && '风格偏好',
    !hasText(customer.budget) && '预算范围',
    !hasText(customer.renovationProgress) && '装修进度',
    !customer.concerns.length && '核心顾虑',
    !nextAt && '下次跟进时间',
    !hasText(latest?.nextAction) && '明确的下一步行动',
  ].filter((item): item is string => Boolean(item))

  const risks = [
    isOverdue && `跟进已逾期，原计划为 ${nextAt?.toLocaleString('zh-CN')}`,
    inactiveDays > 7 && `客户已 ${inactiveDays} 天未互动，存在降温风险`,
    customer.concerns.includes('预算超出') && '客户明确反馈预算超出，方案可能失去竞争力',
    customer.concerns.includes('价格对比') && '客户正在比价，需强化差异价值',
    customer.stage === '已流失' && '客户已标记流失，应先确认是否具备重启条件',
    missingInformation.length >= 3 && `关键信息缺失 ${missingInformation.length} 项，判断依据不足`,
  ].filter((item): item is string => Boolean(item))

  const nextActions: SuggestedAction[] = []
  if (isOverdue) nextActions.push({ priority: '高', action: '立即联系客户并重新确认时间', reason: '原跟进计划已逾期' })
  if (missingInformation.length) nextActions.push({ priority: '高', action: `补齐：${missingInformation.slice(0, 3).join('、')}`, reason: '完善成交判断所需信息' })
  if (customer.concerns.length) nextActions.push({ priority: '中', action: `针对“${customer.concerns[0]}”提供一项可验证方案`, reason: '先处理客户最明确的阻力' })
  if (!isOverdue && nextAt) nextActions.push({ priority: '中', action: `按计划在 ${nextAt.toLocaleString('zh-CN')} 跟进`, reason: '保持已约定的联系节奏' })
  if (!nextActions.length) nextActions.push({ priority: '低', action: '确认交付体验并邀请转介绍', reason: '当前跟进状态稳定' })

  const salutation = customer.name || '您好'
  const concernText = customer.concerns[0] ? `您之前关注的“${customer.concerns[0]}”` : '您关注的方案细节'
  const scripts = [
    `${salutation}，您好，我是${customer.salesperson}。关于${concernText}，我整理了一份更具体的对比和解决方案，想占用您 5 分钟确认一下，今天下午还是明天上午方便？`,
    `${salutation}，结合您目前的${customer.renovationProgress || '装修进度'}和${customer.budget || '预算计划'}，我建议下一步先把${customer.products[0] || '产品范围'}确认下来，避免后续方案反复。您看我先发两个可选方向给您？`,
  ]

  const dimensions = { 成交意向: intent, 需求成熟度: maturity, 关系活跃度: activity, 跟进健康度: health }
  return {
    customerId: customer.id,
    overallScore: clamp((intent.score + maturity.score + activity.score + health.score) / 4),
    dimensions,
    risks,
    missingInformation,
    nextActions,
    scripts,
  }
}

export function scoreCustomers(customers: Customer[], followUps: FollowUp[], now: Date = new Date()) {
  return customers.map((customer) => ({ customer, report: scoreCustomer(customer, followUps, now) }))
}
