export type CustomerStage = '新线索' | '已初聊' | '需求确认' | '到店/量房' | '方案设计' | '已报价' | '方案调整' | '已定金' | '生产交付' | '已成交' | '已流失'

export interface FollowUp {
  id: string
  customerId: string
  at: string
  channel: '微信' | '电话' | '到店' | '量房'
  content: string
  result: string
  nextAction?: string
  nextAt?: string
  salesperson: string
  salespersonId?: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  source: string
  salesperson: string
  salespersonId?: string
  designer?: string
  designerId?: string
  sourceService?: string
  handoffStatus?: '待分配' | '待销售接收' | '已接收' | '已开始跟进'
  pendingSalesperson?: string
  pendingSalespersonId?: string
  handoffHistory?: CustomerHandoff[]
  stage: CustomerStage
  intent: '高' | '中' | '低'
  expectedAmount: number
  products: string[]
  style: string
  budget: string
  renovationProgress: string
  concerns: string[]
  cityArea?: string
  visitPeriod?: string
  vehicleBrand?: string
  notes?: string
  avatarDataUrl?: string
  initialQuote?: number
  quoteDescription?: string
  discountType?: string
  discountDetails?: string
  businessFiles?: CustomerFile[]
  lastContactAt: string
  nextFollowUpAt?: string
  createdAt: string
  lostReason?: string
  dealAmount?: number
  paidAmount?: number
  dealDate?: string
  deliveryDate?: string
  dealProducts?: string[]
  marketingStatus?: '待回访' | '可加购' | '可转介绍' | '长期维护' | '暂不营销'
  marketingNextAt?: string
  marketingNote?: string
}

export interface CustomerHandoff {
  id: string
  fromName: string
  toName: string
  toId?: string
  status: '待销售接收' | '已接收'
  summary: string
  appointmentAt?: string
  createdAt: string
  acceptedAt?: string
}

export interface CustomerFile {
  id: string
  name: string
  type: string
  size: number
}

export type DesignTaskStatus = '待接收' | '设计中' | '待销售确认' | '客户沟通中' | '修改中' | '已完成'
export type DesignTaskType = '平面布局' | '家具搭配' | '效果图' | '报价方案' | '方案修改' | '其他'

export interface DesignTask {
  id: string
  customerId: string
  customerName: string
  salesperson: string
  designerId: string
  designerName: string
  type: DesignTaskType
  requirement: string
  dueAt: string
  priority: '普通' | '紧急'
  status: DesignTaskStatus
  referenceFiles: CustomerFile[]
  solutionFiles: CustomerFile[]
  solutionNote?: string
  feedback?: string
  createdAt: string
  updatedAt: string
}
