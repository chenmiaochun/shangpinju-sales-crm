import type { Customer, FollowUp } from './types'

export const customers: Customer[] = [
  { id: 'c1', name: '张女士', phone: '138****6218', source: '小红书', salesperson: '林晓', stage: '已报价', intent: '高', expectedAmount: 86000, products: ['客厅套系', '餐边柜'], style: '现代原木', budget: '8-10万', renovationProgress: '硬装收尾', concerns: ['价格对比', '交期'], lastContactAt: '2026-07-29T15:20:00+08:00', nextFollowUpAt: '2026-07-30T10:30:00+08:00', createdAt: '2026-07-12' },
  { id: 'c2', name: '王先生', phone: '186****0936', source: '老客转介绍', salesperson: '周然', stage: '到店', intent: '高', expectedAmount: 128000, products: ['全屋家具'], style: '中古', budget: '12万左右', renovationProgress: '水电施工', concerns: ['尺寸方案'], lastContactAt: '2026-07-28T11:00:00+08:00', nextFollowUpAt: '2026-07-31T14:00:00+08:00', createdAt: '2026-07-19' },
  { id: 'c3', name: '陈女士', phone: '159****7702', source: '自然到店', salesperson: '林晓', stage: '需求确认', intent: '中', expectedAmount: 36000, products: ['沙发', '茶几'], style: '奶油风', budget: '3-4万', renovationProgress: '准备开工', concerns: ['家人意见'], lastContactAt: '2026-07-23T18:10:00+08:00', createdAt: '2026-07-20' },
  { id: 'c4', name: '刘先生', phone: '177****4815', source: '视频号', salesperson: '周然', stage: '方案调整', intent: '中', expectedAmount: 65000, products: ['卧室套系'], style: '极简', budget: '6万', renovationProgress: '木工阶段', concerns: ['材质', '预算超出'], lastContactAt: '2026-07-26T09:40:00+08:00', nextFollowUpAt: '2026-07-29T16:00:00+08:00', createdAt: '2026-07-03' },
  { id: 'c5', name: '赵女士', phone: '133****2057', source: '大众点评', salesperson: '何静', stage: '已定金', intent: '高', expectedAmount: 98000, products: ['全屋家具'], style: '现代轻奢', budget: '10万', renovationProgress: '油漆阶段', concerns: ['交付时间'], lastContactAt: '2026-07-29T12:00:00+08:00', nextFollowUpAt: '2026-08-03T09:30:00+08:00', createdAt: '2026-06-18' },
]

export const followUps: FollowUp[] = [
  { id: 'f1', customerId: 'c1', at: '2026-07-29T15:20:00+08:00', channel: '微信', content: '客户看过报价，正在和另一家比较，重点关注餐边柜材质和整体交期。', result: '已发送材质细节与交期说明', nextAction: '确认竞品差异和最终决策人', nextAt: '2026-07-30T10:30:00+08:00', salesperson: '林晓' },
  { id: 'f2', customerId: 'c2', at: '2026-07-28T11:00:00+08:00', channel: '电话', content: '确认本周完成水电，客户希望现场评估电视墙和餐厅尺寸。', result: '预约上门量尺', nextAction: '携带材质样板量尺', nextAt: '2026-07-31T14:00:00+08:00', salesperson: '周然' },
  { id: 'f3', customerId: 'c4', at: '2026-07-26T09:40:00+08:00', channel: '微信', content: '客户认为主卧方案超预算，希望调整材质。', result: '答应提供两个预算版本', nextAction: '发送调整方案', nextAt: '2026-07-29T16:00:00+08:00', salesperson: '周然' },
]
