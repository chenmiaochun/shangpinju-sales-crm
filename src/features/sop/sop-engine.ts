import type { Customer, CustomerStage, FollowUp } from '../../types'

export type SopStageId = 'lead' | 'discovery' | 'visit' | 'revisit' | 'measure' | 'design' | 'quote' | 'revision' | 'deposit'
export type SopPath = 'retail-fast' | 'retail-followup' | 'custom'
export type SopItemKind = 'question' | 'action' | 'condition'

export interface SopChecklistItem {
  id: string
  kind: SopItemKind
  label: string
  evidence?: (customer: Customer, followUps: FollowUp[], text: string) => boolean
}

export interface SopStageDefinition {
  id: SopStageId
  name: string
  summary: string
  questions: string[]
  actions: string[]
  conditions: string[]
  risks: string[]
  script: string
  checklist: SopChecklistItem[]
}

export interface SopItemResult extends SopChecklistItem {
  completed: boolean
  source: 'stage' | 'data' | 'manual' | 'missing'
}

export interface SopStageResult extends SopStageDefinition {
  status: 'completed' | 'current' | 'upcoming'
  items: SopItemResult[]
  completedCount: number
  ready: boolean
}

export interface SopEvaluation {
  path: SopPath
  currentStageIndex: number
  currentStage: SopStageResult
  nextStage?: SopStageDefinition
  stages: SopStageResult[]
  readyForNextStage: boolean
  missingItems: SopItemResult[]
  actions: string[]
}

export type ManualConfirmations = Record<string, boolean>

const has = (value: string | string[] | undefined) => Array.isArray(value) ? value.length > 0 : Boolean(value?.trim())
const mentions = (text: string, words: string[]) => words.some((word) => text.includes(word))
const item = (id: string, kind: SopItemKind, label: string, evidence?: SopChecklistItem['evidence']): SopChecklistItem => ({ id, kind, label, evidence })

export const SOP_STAGES: SopStageDefinition[] = [
  {
    id: 'lead', name: '新线索', summary: '快速建立联系，判断线索真实性与首次沟通优先级。',
    questions: ['您目前想重点解决哪个空间？', '房子现在装修到什么阶段？', '方便怎么称呼，后续用微信还是电话联系？'],
    actions: ['核对联系方式与线索来源', '首次联系并约定下一次沟通', '记录意向等级与关注品类'],
    conditions: ['客户身份和联系方式有效', '已完成首次有效沟通', '有明确的下一步跟进安排'],
    risks: ['只发产品图，没有确认真实需求', '首次响应过慢导致客户转向竞品', '没有约定下次联系时间'],
    script: '您好，我是尚品居的家居顾问。先不急着推荐产品，我想用两分钟了解一下您的空间和装修进度，再帮您筛选真正合适的方案。',
    checklist: [
      item('lead-contact', 'question', '联系方式与称呼已确认', (c) => has(c.name) && has(c.phone)),
      item('lead-source', 'question', '线索来源已记录', (c) => has(c.source)),
      item('lead-first-contact', 'action', '已完成首次有效沟通', (_c, f) => f.length > 0),
      item('lead-next', 'condition', '已约定下一步跟进', (c, f) => Boolean(c.nextFollowUpAt || f.some((x) => x.nextAt || x.nextAction))),
    ],
  },
  {
    id: 'discovery', name: '需求确认', summary: '把审美偏好、生活方式、预算与决策关系问清楚。',
    questions: ['常住人口和主要生活习惯是什么？', '偏好的风格、材质和颜色有哪些？', '预算区间、入住节点和决策人分别是什么？'],
    actions: ['记录空间/品类清单', '确认预算与装修进度', '识别核心顾虑和共同决策人'],
    conditions: ['品类、风格、预算均已明确', '装修进度和时间节点可判断', '至少记录一个关键顾虑'],
    risks: ['把客户说的风格词直接当成完整需求', '回避预算导致后续方案失焦', '遗漏配偶或家人的决策影响'],
    script: '为了让方案一次更接近您的真实需要，我会把空间、使用习惯、喜欢与不喜欢、预算和时间分别问清楚。预算不是限制，而是帮我们把钱花在最值得的地方。',
    checklist: [
      item('discovery-products', 'question', '目标空间与品类已明确', (c) => has(c.products)),
      item('discovery-style', 'question', '风格偏好已记录', (c) => has(c.style)),
      item('discovery-budget', 'question', '预算区间已确认', (c) => has(c.budget) || c.expectedAmount > 0),
      item('discovery-progress', 'action', '装修进度已记录', (c) => has(c.renovationProgress)),
      item('discovery-concerns', 'condition', '关键顾虑已识别', (c) => has(c.concerns)),
      item('discovery-decision', 'condition', '共同决策人和入住节点已确认', (_c, _f, t) => mentions(t, ['决策人', '家人', '爱人', '入住', '婚期'])),
    ],
  },
  {
    id: 'visit', name: '到店体验', summary: '让客户体验产品、材质和坐感，确认真实偏好。',
    questions: ['到店时哪些家人会共同参与？', '本次最想体验哪些产品和材质？', '哪些尺寸、坐感或颜色是必须满足的？'],
    actions: ['预约到店时间并发送定位', '安排重点产品试坐试用与材质对比', '记录喜欢、不喜欢和待确认项目'],
    conditions: ['客户已完成到店体验', '意向产品与偏好进一步明确', '已约定成交、再次到店或量尺中的下一步'],
    risks: ['只带客户看产品，没有记录真实反馈', '一次展示过多导致客户难以决策', '离店前没有约定明确下一步'],
    script: '这次到店先集中体验您最关心的产品、坐感和材质。我会把喜欢与不喜欢分别记录，离店前再一起确认下一步是直接下单、再次到店，还是安排量尺。',
    checklist: [
      item('visit-booked', 'action', '到店时间已预约', (c, f, t) => Boolean(c.nextFollowUpAt) || f.some((x) => x.channel === '到店') || mentions(t, ['预约到店', '再次到店'])),
      item('visit-completed', 'action', '到店体验已完成', (_c, f) => f.some((x) => x.channel === '到店')),
      item('visit-preference', 'question', '产品体验反馈与偏好已记录', (c) => has(c.products)),
      item('visit-next', 'condition', '离店前已约定下一步', (c, f) => Boolean(c.nextFollowUpAt || f.some((x) => x.nextAt || x.nextAction))),
    ],
  },
  {
    id: 'revisit', name: '再次到店', summary: '围绕上次未决问题再次体验，推动成品家具成交。',
    questions: ['上次未确定的是产品、颜色、尺寸还是价格？', '这次还有哪位家人需要共同确认？', '满足哪些条件今天可以下单？'],
    actions: ['提前准备客户关注的产品和替代方案', '集中解决上次遗留异议', '现场确认产品、价格与送货时间'],
    conditions: ['关键决策人已参与', '产品与配置已确认', '可以进入报价成交'],
    risks: ['重复第一次到店内容，没有针对遗留问题', '仍未邀请共同决策人', '再次离店却没有确定决策期限'],
    script: '这次我们不重复看全部产品，重点把上次没有确定的颜色、尺寸和价格逐项解决。如果这几项都合适，今天就可以把产品和送货安排定下来。',
    checklist: [
      item('revisit-gap', 'question', '上次未决问题已列清楚'),
      item('revisit-decision', 'question', '共同决策人已参与', (_c, _f, t) => mentions(t, ['家人', '爱人', '决策人'])),
      item('revisit-completed', 'action', '再次到店体验已完成', (_c, f, t) => f.filter((x) => x.channel === '到店').length > 1 || mentions(t, ['再次到店', '二次到店'])),
      item('revisit-ready', 'condition', '产品配置与成交条件已确认'),
    ],
  },
  {
    id: 'measure', name: '上门量尺', summary: '单独完成现场测量，为定制设计建立准确输入。',
    questions: ['物业进场、门禁和测量时间有什么限制？', '墙体、梁柱、插座、踢脚线和通道有哪些约束？', '现场有哪些家具或设备需要保留？'],
    actions: ['单独预约上门量尺时间', '记录完整尺寸、照片和现场限制', '量尺后复述需求并确定方案时间'],
    conditions: ['上门量尺已经完成', '现场尺寸和照片资料完整', '资料可以交给设计师使用'],
    risks: ['把到店体验误当成已经量尺', '遗漏梁柱、插座或进场通道尺寸', '量尺资料没有及时交接设计师'],
    script: '量尺是独立的上门工作，不等同于到店。我们会把尺寸、梁柱、插座、通道和现场照片完整记录，确认无误后再交给设计师出方案。',
    checklist: [
      item('measure-booked', 'action', '上门量尺时间已预约', (c, f, t) => Boolean(c.nextFollowUpAt) || f.some((x) => x.channel === '量尺') || mentions(t, ['预约量尺', '上门量尺'])),
      item('measure-completed', 'action', '上门量尺已完成', (_c, f) => f.some((x) => x.channel === '量尺')),
      item('measure-records', 'condition', '尺寸、照片与现场限制已归档'),
      item('measure-handoff', 'condition', '量尺资料已交接设计师', (_c, _f, t) => mentions(t, ['交接设计', '设计师', '方案时间'])),
    ],
  },
  {
    id: 'design', name: '方案设计', summary: '把需求翻译为空间、产品、材质和预算可落地的组合。',
    questions: ['空间功能与视觉效果哪个优先？', '哪些产品必须保留，哪些可以替换？', '方案讲解时谁需要一起参加？'],
    actions: ['输出布局与产品组合', '校验尺寸、材质和预算', '预约完整方案讲解'],
    conditions: ['方案覆盖客户核心需求', '方案金额在预算逻辑内', '内部审核后可向客户讲解'],
    risks: ['追求效果图而忽略使用尺度', '单一方案没有取舍依据', '未在报价前解释材质差异'],
    script: '这版方案先解决您最在意的使用问题，再处理整体风格。每个选择我都会说明为什么、预算花在哪里，以及可以替换的备选项。',
    checklist: [
      item('design-layout', 'action', '布局与产品组合已完成', (_c, _f, t) => mentions(t, ['布局', '产品组合', '方案完成'])),
      item('design-check', 'action', '尺寸、材质与预算已内部校验'),
      item('design-needs', 'condition', '方案覆盖核心需求与顾虑', (c) => has(c.products) && has(c.style) && has(c.concerns)),
      item('design-review', 'condition', '方案讲解已预约', (_c, _f, t) => mentions(t, ['方案讲解', '看方案', '讲解时间'])),
    ],
  },
  {
    id: 'quote', name: '报价', summary: '透明呈现价值、配置与边界，让客户能够放心比较和决策。',
    questions: ['客户会拿哪些品牌或方案比较？', '价格、材质、交期中最在意哪一项？', '本轮决策还缺少谁的意见？'],
    actions: ['逐项讲解配置与价格', '说明服务、交付范围和有效期', '记录异议并约定反馈节点'],
    conditions: ['客户理解报价构成', '关键异议已记录', '明确下一次决策沟通时间'],
    risks: ['只发送报价单不做讲解', '过早打折削弱原创设计价值', '未说明不包含项和变更规则'],
    script: '我不只给您一个总价，会把产品、材质、工艺和服务逐项讲清楚。这样您比较时能看见真正的差异，也知道后续不会在哪些地方产生意外费用。',
    checklist: [
      item('quote-presented', 'action', '报价与配置已完整讲解', (_c, _f, t) => mentions(t, ['报价讲解', '讲解报价', '报价已发', '看过报价'])),
      item('quote-scope', 'question', '服务范围、交期与有效期已说明', (_c, _f, t) => mentions(t, ['交期', '有效期', '服务范围', '不包含'])),
      item('quote-objection', 'question', '价格/竞品/决策异议已记录', (c, _f, t) => has(c.concerns) || mentions(t, ['异议', '竞品', '比较'])),
      item('quote-next', 'condition', '已约定决策反馈节点', (c, f) => Boolean(c.nextFollowUpAt || f.some((x) => x.nextAt))),
    ],
  },
  {
    id: 'revision', name: '方案调整', summary: '围绕已确认的异议精准调整，避免无边界反复改稿。',
    questions: ['本轮必须调整的三项内容是什么？', '调整后预算和效果如何排序？', '满足哪些条件即可进入签约？'],
    actions: ['形成调整清单并确认边界', '提供有取舍依据的版本', '复核最终配置、金额与交期'],
    conditions: ['客户确认最终方案', '报价与配置版本一致', '定金和签约安排明确'],
    risks: ['没有调整清单导致反复改稿', '用降材质解决所有预算问题', '口头确认但未冻结最终版本'],
    script: '我们先把这轮必须调整的内容列成清单，再按使用、效果和预算排序。调整完成后一起确认最终版本，避免后续因为口径不同反复返工。',
    checklist: [
      item('revision-list', 'question', '调整清单与优先级已确认', (_c, _f, t) => mentions(t, ['调整清单', '调整项', '优先级'])),
      item('revision-version', 'action', '调整版方案与报价已同步', (_c, _f, t) => mentions(t, ['调整方案', '调整版', '新报价', '预算版本'])),
      item('revision-final', 'condition', '最终配置、金额和交期已复核'),
      item('revision-sign', 'condition', '客户确认可进入定金签约', (_c, _f, t) => mentions(t, ['确认方案', '签约', '定金'])),
    ],
  },
  {
    id: 'deposit', name: '成交交付', summary: '确认收款与订单，交接备货、送货和售后。',
    questions: ['合同主体、收货人与现场联系人是谁？', '交付、安装和验收节点如何安排？', '有哪些物业或进场限制需要提前处理？'],
    actions: ['确认合同、定金与最终图纸', '建立生产交付节点并责任到人', '同步安装、验收和售后说明'],
    conditions: ['定金到账且合同版本冻结', '生产交付资料完整', '客户清楚后续节点与联系人'],
    risks: ['收款后未及时冻结图纸', '销售承诺未写入交付资料', '安装前才发现现场不具备条件'],
    script: '定金确认后，我们会把最终图纸、配置、交期和现场条件全部冻结，并把每个节点的负责人和联系方式发给您，后续进度都按这份清单同步。',
    checklist: [
      item('deposit-paid', 'action', '定金到账并留存凭证', (_c, _f, t) => mentions(t, ['定金到账', '已付定金', '收款'])),
      item('deposit-contract', 'action', '合同、图纸与配置版本已冻结'),
      item('deposit-handoff', 'action', '生产交付资料已完成内部交接', (_c, _f, t) => mentions(t, ['生产交接', '交付资料', '下单生产'])),
      item('deposit-plan', 'condition', '客户已收到节点、联系人和验收说明'),
    ],
  },
]

const PATH_STAGE_IDS: Record<SopPath, SopStageId[]> = {
  'retail-fast': ['visit', 'quote', 'deposit'],
  'retail-followup': ['lead', 'discovery', 'visit', 'revisit', 'quote', 'deposit'],
  custom: ['lead', 'discovery', 'visit', 'measure', 'design', 'quote', 'revision', 'deposit'],
}

export function getSopStages(path: SopPath) {
  const ids = PATH_STAGE_IDS[path]
  return ids.map((id) => SOP_STAGES.find((stage) => stage.id === id)!)
}

export function inferSopPath(customer: Customer): SopPath {
  if (customer.stage === '量尺' || customer.stage === '方案设计' || customer.stage === '方案调整' || customer.products.some((product) => product.includes('定制'))) return 'custom'
  return customer.stage === '到店' || customer.stage === '已报价' || customer.stage === '已定金' || customer.stage === '生产交付' || customer.stage === '已成交' ? 'retail-fast' : 'retail-followup'
}

function targetStageId(customerStage: CustomerStage, path: SopPath): SopStageId {
  if (customerStage === '已定金' || customerStage === '生产交付' || customerStage === '已成交') return 'deposit'
  if (customerStage === '已报价') return 'quote'
  if (customerStage === '方案调整') return path === 'custom' ? 'revision' : 'quote'
  if (customerStage === '方案设计') return path === 'custom' ? 'design' : 'quote'
  if (customerStage === '量尺') return path === 'custom' ? 'measure' : 'visit'
  if (customerStage === '到店') return 'visit'
  if (customerStage === '需求确认') return path === 'retail-fast' ? 'visit' : 'discovery'
  return PATH_STAGE_IDS[path][0]
}

export function getManualStorageKey(customerId: string) {
  return `shangpinju:sales-sop:${customerId}`
}

export function evaluateSalesSop(customer: Customer, allFollowUps: FollowUp[], manual: ManualConfirmations = {}, path: SopPath = inferSopPath(customer)): SopEvaluation {
  const followUps = allFollowUps.filter((followUp) => followUp.customerId === customer.id)
  const evidenceText = followUps.flatMap((x) => [x.content, x.result, x.nextAction ?? '']).join(' ')
  const pathStages = getSopStages(path)
  const currentStageIndex = Math.max(0, pathStages.findIndex((stage) => stage.id === targetStageId(customer.stage, path)))
  const stages = pathStages.map((stage, index): SopStageResult => {
    const status = index < currentStageIndex ? 'completed' : index === currentStageIndex ? 'current' : 'upcoming'
    const items = stage.checklist.map((check): SopItemResult => {
      const inferred = Boolean(check.evidence?.(customer, followUps, evidenceText))
      const completed = status === 'completed' || inferred || Boolean(manual[check.id])
      return { ...check, completed, source: status === 'completed' ? 'stage' : inferred ? 'data' : manual[check.id] ? 'manual' : 'missing' }
    })
    return { ...stage, status, items, completedCount: items.filter((x) => x.completed).length, ready: items.every((x) => x.completed) }
  })
  const currentStage = stages[currentStageIndex]
  const missingItems = currentStage.items.filter((x) => !x.completed)
  const readyForNextStage = missingItems.length === 0
  return {
    path, currentStageIndex, currentStage, stages, readyForNextStage, missingItems,
    nextStage: pathStages[currentStageIndex + 1],
    actions: readyForNextStage
      ? [pathStages[currentStageIndex + 1] ? `推进至「${pathStages[currentStageIndex + 1].name}」并约定首个动作` : '完成生产交付交接并持续同步节点']
      : missingItems.map((x) => x.label),
  }
}
