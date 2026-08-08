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
  attachments?: CustomerFile[]
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
  communityName?: string
  communityDistrict?: string
  buildingRoom?: string
  houseLayout?: string
  houseArea?: number
  houseValueRange?: string
  visitPeriod?: string
  vehicleBrand?: string
  vehicleSeries?: string
  vehiclePriceRange?: string
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

export type OrderStatus = '草稿' | '待客户确认' | '待审核' | '已生效' | '待确认' | '已签约' | '备货中' | '生产中' | '部分齐货' | '已齐货' | '待送货' | '安装中' | '已验收' | '已关闭'
export type SupplyType = '现货' | '展厅样品' | '外采产品' | '定制生产'
export type SupplyDemandStatus = '待处理' | '已锁定' | '采购中' | '生产中' | '部分到货' | '已到货' | '已取消'

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
  material?: string
  color?: string
  dimensions?: string
  customRequirement?: string
  discountAmount?: number
  attachments?: CustomerFile[]
}

export interface ProductCatalogItem {
  id: string
  sku: string
  name: string
  specifications: string[]
  unitPrice: number
  supplyType: SupplyType
  availableStock: number
  reservedStock?: number
  category?: string
  categoryLevel1?: string
  categoryLevel2?: string
  categoryLevel3?: string
  costPrice?: number
  safetyStock?: number
  supplier?: string
  woodMaterial?: string
  woodGrade?: string
  finish?: string
  color?: string
  dimensions?: string
  customizable?: boolean
  qualityStandard?: string
}

export interface InventoryMovement {
  id: string
  productId: string
  sku: string
  productName: string
  type: '采购入库' | '销售出库' | '库存调整' | '退货入库' | '报损出库' | '调拨出库' | '调拨入库'
  quantity: number
  beforeStock: number
  afterStock: number
  note?: string
  operator: string
  createdAt: string
}

export interface Warehouse {
  id: string
  name: string
  type: '总仓' | '展厅仓' | '临时仓'
  active: boolean
}

export interface WarehouseStock {
  warehouseId: string
  productId: string
  quantity: number
  reservedQuantity: number
}

export type InventoryDocumentType = '到货入库' | '销售出库' | '客户退货' | '仓库调拨' | '盘点调整' | '破损报废'
export type InventoryDocumentStatus = '草稿' | '待审批' | '已批准' | '已过账' | '已取消' | '待执行' | '已完成'
export type InventoryQualityStatus = '免检' | '待验收' | '验收合格' | '部分合格' | '验收不合格'

export interface InventoryDocument {
  id: string
  documentNo: string
  type: InventoryDocumentType
  status: InventoryDocumentStatus
  productId: string
  sku: string
  productName: string
  quantity: number
  fromWarehouseId?: string
  toWarehouseId?: string
  relatedOrderNo?: string
  originalDocumentId?: string
  reversalDocumentId?: string
  qualityStatus?: InventoryQualityStatus
  acceptedQuantity?: number
  rejectedQuantity?: number
  note?: string
  operator: string
  createdAt: string
  submittedBy?: string
  approvedBy?: string
  postedBy?: string
  postingAt?: string
  cancelledBy?: string
  cancelledAt?: string
  cancellationReason?: string
  documentVersion?: number
  completedAt?: string
}

export interface ReplenishmentRequest {
  id: string
  requestNo: string
  productId: string
  sku: string
  productName: string
  quantity: number
  neededAt?: string
  reason: string
  requester: string
  status: '待审批' | '已批准' | '已驳回' | '已转采购'
  reviewer?: string
  reviewNote?: string
  createdAt: string
  updatedAt: string
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
  supplier?: string
  unitCost?: number
  orderedAt?: string
  expectedAt?: string
  receivedQuantity?: number
  rejectedQuantity?: number
  inspectionNote?: string
  receivedAt?: string
  payableStatus?: '未对账' | '待付款' | '部分付款' | '已付款'
  drawingVersion?: string
  drawingConfirmedAt?: string
  woodMaterial?: string
  color?: string
  dimensions?: string
  craftRequirement?: string
  productionProgress?: '资料待确认' | '已下厂' | '生产中' | '待质检' | '已发货' | '已到货'
  createdAt: string
  updatedAt: string
}
export type DeliveryStatus = '待排期' | '已排期' | '配送中' | '安装中' | '待验收' | '已完成'
export type DeliveryItemResult = '待确认' | '客户留下' | '退回仓库' | '客户留样' | '破损异常'
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
  receiptNo?: string
  attachments?: CustomerFile[]
  status?: '待财务确认' | '已确认' | '已驳回'
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
  contactPhone?: string
  deliveryAddress?: string
  quotationFiles?: CustomerFile[]
  requiredDeposit?: number
  discountAmount?: number
  discountReason?: string
  customerConfirmationNote?: string
  exceptionApproved?: boolean
  customerConfirmedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  activatedAt?: string
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
  orderItemIds?: string[]
  installer?: string
  acceptanceNote?: string
  handoverItems?: DeliveryHandoverItem[]
  settlementAmount?: number
  settlementStatus?: '无需结算' | '待补款' | '待退款' | '已结算'
  returnInspection?: '无需退回' | '待退回验收' | '已验收入库'
  completedAt?: string
  createdAt: string
  updatedAt: string
}

export interface DeliveryHandoverItem {
  id: string
  productId?: string
  productName: string
  specification?: string
  quantity: number
  unitPrice: number
  source: '原订单' | '备选商品'
  result: DeliveryItemResult
  resultNote?: string
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
