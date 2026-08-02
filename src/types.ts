export type CustomerStage = '新线索' | '已初聊' | '需求确认' | '到店' | '量尺' | '方案设计' | '已报价' | '方案调整' | '已定金' | '生产交付' | '已成交' | '已流失'

export interface FollowUp {
  id: string
  customerId: string
  at: string
  channel: '微信' | '电话' | '到店' | '量尺'
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
  licensePlate?: string
  notes?: string
  avatarDataUrl?: string
  remarkImages?: CustomerRemarkImage[]
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

export interface CustomerRemarkImage {
  id: string
  name: string
  dataUrl: string
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

export type OrderStatus = '待确认' | '已签约' | '生产中' | '待送货' | '安装中' | '已验收' | '已关闭'
export type SupplyType = '现货' | '展厅样品' | '外采产品' | '定制生产'
export type SupplyDemandStatus = '待处理' | '已锁定' | '采购中' | '生产中' | '已到货' | '已取消'

export interface OrderItem {
  id: string
  productId?: string
  sku?: string
  productName: string
  specification?: string
  quantity: number
  unitPrice: number
  supplyType: SupplyType
  availableStock?: number
}

export interface ProductCatalogItem {
  id: string
  sku: string
  name: string
  specifications: string[]
  unitPrice: number
  supplyType: SupplyType
  availableStock: number
}

export interface SupplyDemand {
  id: string
  orderId: string
  orderNo: string
  customerId: string
  customerName: string
  orderItemId: string
  productName: string
  specification?: string
  quantity: number
  supplyType: SupplyType
  demandType: '库存锁定' | '样品锁定' | '采购需求' | '生产需求'
  status: SupplyDemandStatus
  expectedAt?: string
  createdAt: string
  updatedAt: string
}
export type DeliveryStatus = '待排期' | '已排期' | '配送中' | '安装中' | '待验收' | '已完成'
export type AfterSalesStatus = '待受理' | '处理中' | '待客户确认' | '已完成'

export interface PaymentRecord {
  id: string
  orderId: string
  type: '定金' | '进度款' | '尾款' | '退款'
  amount: number
  paidAt: string
  method: '微信' | '支付宝' | '银行转账' | '现金' | '其他'
  recordedBy: string
  note?: string
}

export interface SalesOrder {
  id: string
  orderNo: string
  customerId: string
  customerName: string
  salesperson: string
  salespersonId?: string
  collaborators: string[]
  products: string[]
  items?: OrderItem[]
  contractAmount: number
  signedAt: string
  expectedDeliveryAt?: string
  deliveryReminderAt?: string
  expectedDeliveryMonth?: string
  status: OrderStatus
  payments: PaymentRecord[]
  performanceRate: number
  note?: string
  createdAt: string
  updatedAt: string
}

export interface DeliveryTask {
  id: string
  orderId: string
  customerId: string
  customerName: string
  address: string
  contactPhone: string
  scheduledAt?: string
  remindAt?: string
  expectedDeliveryMonth?: string
  status: DeliveryStatus
  owner: string
  ownerId?: string
  installer?: string
  acceptanceNote?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface AfterSalesTicket {
  id: string
  orderId: string
  customerId: string
  customerName: string
  source?: '系统订单' | '历史客户'
  contactPhone?: string
  address?: string
  productInfo?: string
  purchaseAt?: string
  category: '补件' | '维修' | '安装调整' | '质量问题' | '使用咨询' | '其他'
  description: string
  priority: '紧急' | '普通'
  status: AfterSalesStatus
  owner: string
  dueAt?: string
  result?: string
  createdAt: string
  updatedAt: string
}
