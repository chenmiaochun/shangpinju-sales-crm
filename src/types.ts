export type CustomerStage =
  | "新线索"
  | "已初聊"
  | "需求确认"
  | "到店"
  | "量尺"
  | "方案设计"
  | "已报价"
  | "方案调整"
  | "已定金"
  | "生产交付"
  | "已成交"
  | "已流失";

export interface FollowUp {
  id: string;
  customerId: string;
  at: string;
  channel: "微信" | "电话" | "到店" | "量尺";
  content: string;
  result: string;
  nextAction?: string;
  nextAt?: string;
  salesperson: string;
  salespersonId?: string;
  attachments?: CustomerFile[];
}

export interface Customer {
  id: string;
  leadId?: string;
  campaignId?: string;
  contentId?: string;
  adGroup?: string;
  conversionSource?: string;
  appointmentAt?: string;
  arrivalStatus?: "未预约" | "已预约" | "已确认" | "已到店" | "爽约" | "已改期";
  productLines?: Array<"原创家具" | "整屋全案" | "雅兰睡眠">;
  experienceAssessment?: ExperienceAssessment;
  name: string;
  phone: string;
  source: string;
  salesperson: string;
  salespersonId?: string;
  createdBy?: string;
  createdById?: string;
  designer?: string;
  designerId?: string;
  referrerDesigner?: string;
  referrerDesignerId?: string;
  sourceService?: string;
  handoffStatus?: "待分配" | "待销售接收" | "已接收" | "已开始跟进";
  pendingSalesperson?: string;
  pendingSalespersonId?: string;
  handoffHistory?: CustomerHandoff[];
  stage: CustomerStage;
  intent: "高" | "中" | "低";
  expectedAmount: number;
  products: string[];
  style: string;
  budget: string;
  renovationProgress: string;
  concerns: string[];
  cityArea?: string;
  communityName?: string;
  communityDistrict?: string;
  buildingRoom?: string;
  houseLayout?: string;
  houseArea?: number;
  houseValueRange?: string;
  visitPeriod?: string;
  vehicleBrand?: string;
  vehicleSeries?: string;
  vehiclePriceRange?: string;
  licensePlate?: string;
  notes?: string;
  avatarDataUrl?: string;
  remarkImages?: CustomerRemarkImage[];
  initialQuote?: number;
  quoteDescription?: string;
  discountType?: string;
  discountDetails?: string;
  businessFiles?: CustomerFile[];
  lastContactAt: string;
  nextFollowUpAt?: string;
  createdAt: string;
  updatedAt?: string;
  lostReason?: string;
  dealAmount?: number;
  paidAmount?: number;
  dealDate?: string;
  deliveryDate?: string;
  dealProducts?: string[];
  marketingStatus?: "待回访" | "可加购" | "可转介绍" | "长期维护" | "暂不营销";
  marketingNextAt?: string;
  marketingNote?: string;
}

export type ExperienceStation =
  "家具与动线体验" | "重点空间诊断" | "全家睡眠体验";

export interface ExperienceAssessment {
  assessmentId: string;
  submittedAt: string;
  housingStage: "新房准备" | "装修进行中" | "已入住焕新" | "局部补购" | "其他";
  familyMembers: string[];
  focusSpaces: string[];
  painPoints: string[];
  moveInPlan?: string;
  sleepNeeds?: string[];
  preferredStations: ExperienceStation[];
  recommendedStations: ExperienceStation[];
  summary: string;
  status: "待体验" | "体验中" | "已完成";
}

export interface CustomerHandoff {
  id: string;
  fromName: string;
  toName: string;
  toId?: string;
  status: "待销售接收" | "已接收";
  summary: string;
  appointmentAt?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface CustomerFile {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  url?: string;
  category?: "报价图纸" | "签名回单" | "其他";
  uploadedAt?: string;
}

/**
 * 门店收款设置（2026-08-30）
 * 采用「官方静态收款码」方案：店长从微信支付商户平台 / 支付宝商家中心下载收款码图片上传，
 * 打印在销售单底部，客户签单后扫码自行输入金额付款。
 * 选择静态码而非动态支付码的原因：系统为局域网自用，无公网地址，收不到支付平台异步回调。
 * 后续若系统迁至公网并开通商户 API，可在不改动订单数据结构的前提下升级为动态带金额二维码。
 */
export interface BankAccount {
  bankName: string;       // 开户行，如 中国工商银行
  accountName: string;    // 户名
  accountNo: string;      // 卡号
}

export interface StorePaymentSettings {
  enabled: boolean;              // 是否在销售单上显示收款区块
  wechatQr?: CustomerFile;       // 微信商家收款码
  alipayQr?: CustomerFile;       // 支付宝商家收款码
  banks: BankAccount[];          // 多张银行卡（工行/农行等）
  payNote?: string;              // 自定义付款提示，留空用默认文案
  updatedAt?: string;
  updatedBy?: string;
}

export interface DesignTaskVersion {
  id: string;
  version: number;
  files: CustomerFile[];
  note: string;
  submittedAt: string;
  submittedBy: string;
}

export interface DesignTaskTimelineEvent {
  id: string;
  type: "任务创建" | "任务接收" | "提交成果" | "审核通过" | "退回修改" | "客户确认";
  at: string;
  operator: string;
  detail: string;
}

export interface CustomerRemarkImage {
  id: string;
  name: string;
  dataUrl: string;
}

export type DesignTaskStatus =
  "待分配" | "待接收" | "设计中" | "待销售确认" | "客户沟通中" | "修改中" | "已完成";
export type DesignTaskType =
  "平面布局" | "家具搭配" | "效果图" | "报价方案" | "方案修改" | "其他";

export interface DesignTask {
  id: string;
  customerId: string;
  customerName: string;
  salesperson: string;
  designerId: string;
  designerName: string;
  type: DesignTaskType;
  requirement: string;
  dueAt: string;
  priority: "普通" | "较急" | "紧急" | "特急";
  status: DesignTaskStatus;
  referenceFiles: CustomerFile[];
  solutionFiles: CustomerFile[];
  solutionNote?: string;
  feedback?: string;
  versions?: DesignTaskVersion[];
  timeline?: DesignTaskTimelineEvent[];
  acceptedAt?: string;
  completedAt?: string;
  confirmedBy?: string;
  assignedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | "草稿"
  | "待客户签名"
  | "已开单待签名"
  | "已签名已确认"
  | "待客户确认"
  | "待审核"
  | "已生效"
  | "待确认"
  | "已签约"
  | "备货中"
  | "生产中"
  | "部分齐货"
  | "已齐货"
  | "待送货"
  | "部分发货"
  | "全部发货"
  | "已签收"
  | "已收尾款"
  | "已完成"
  | "换货中"
  | "退货中"
  | "已取消"
  | "安装中"
  | "已验收"
  | "已关闭";
export type SupplyType = "现货" | "展厅样品" | "外采产品" | "定制生产";
export type SupplyDemandStatus =
  "待处理" | "已锁定" | "采购中" | "生产中" | "部分到货" | "已到货" | "已取消";

// 单品开单时展开的最小单位明细快照（不含成本，员工端安全）
export interface OrderSkuLine {
  skuUnitId: string;
  sku: string;
  componentId: string;
  componentName: string; // 主件名快照
  specSummary: string; // "尺寸:1.8m / 材质:黑胡桃"
  quantity: number; // 单套单品中该主件数量
  unitPrice: number; // SKU 售价快照（不含成本价）
  supplyType: SupplyType;
  optional: boolean; // 是否选配主件
  material?: string;
}

export interface OrderItem {
  id: string;
  productId?: string;
  sku?: string;
  productName: string;
  specification?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  supplyType: SupplyType;
  availableStock?: number;
  material?: string;
  color?: string;
  dimensions?: string;
  customRequirement?: string;
  lineNote?: string;
  fulfillmentStatus?: "现货" | "需订货" | "已到货待发货";
  fulfillmentManual?: boolean;
  expectedArrivalAt?: string;
  arrivedAt?: string;
  shippedQuantity?: number;
  signedQuantity?: number;
  discountAmount?: number;
  attachments?: CustomerFile[];
  // Phase 3：产品库单品开单联动
  configProductId?: string;
  configProductCode?: string; // SP-CT-001
  selections?: Record<string, Record<string, string>>; // 每个主件的规格选择
  skuLines?: OrderSkuLine[]; // 展开明细快照（生效时按此扣库存/生成需求）
  // Phase 4.2：套餐开单联动
  packageId?: string;
  packageCode?: string; // TC-001
  packageItems?: PackageOrderItem[]; // 套餐内单品分组快照（打印分组展示用）
  // 测试期销售开单页临时录入的标记（不进产品主库；店长后续清洗）
  isTemporary?: boolean;
}

// Phase 4.2：套餐行内每个单品的选配快照。
// 生效扣减不走本结构——顶层 skuLines 已按「单套用量 × 单品数量」乘好平铺。
export interface PackageOrderItem {
  productId: string;
  productCode: string;
  productName: string;
  quantity: number; // 该单品在套餐内的数量（餐椅×6）
  selections: Record<string, Record<string, string>>;
  unitPrice: number; // 该单品成品价快照
  skuLines: OrderSkuLine[]; // 单套组件快照（quantity 为单套用量）
}

export interface ProductCatalogItem {
  id: string;
  sku: string;
  name: string;
  specifications: string[];
  unitPrice: number;
  supplyType: SupplyType;
  availableStock: number;
  reservedStock?: number;
  category?: string;
  categoryLevel1?: string;
  categoryLevel2?: string;
  categoryLevel3?: string;
  costPrice?: number;
  safetyStock?: number;
  supplier?: string;
  woodMaterial?: string;
  woodGrade?: string;
  finish?: string;
  color?: string;
  dimensions?: string;
  customizable?: boolean;
  qualityStandard?: string;
}

export interface InventoryMovement {
  id: string;
  /** 老商品流水的产品 ID；SKU（最小单位）流水不填，见 skuUnitId */
  productId?: string;
  /** Phase 4.1：SKU（最小单位）流水的单位 ID，与 productId 互斥使用 */
  skuUnitId?: string;
  sku: string;
  productName: string;
  type:
    | "采购入库"
    | "销售出库"
    | "库存调整"
    | "退货入库"
    | "报损出库"
    | "调拨出库"
    | "调拨入库";
  quantity: number;
  beforeStock: number;
  afterStock: number;
  note?: string;
  operator: string;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  type: "总仓" | "展厅仓" | "临时仓";
  active: boolean;
}

export interface WarehouseStock {
  warehouseId: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
}

export type InventoryDocumentType =
  "到货入库" | "销售出库" | "客户退货" | "仓库调拨" | "盘点调整" | "破损报废";
export type InventoryDocumentStatus =
  "草稿" | "待审批" | "已批准" | "已过账" | "已取消" | "待执行" | "已完成";
export type InventoryQualityStatus =
  "免检" | "待验收" | "验收合格" | "部分合格" | "验收不合格";

export interface InventoryDocument {
  id: string;
  documentNo: string;
  type: InventoryDocumentType;
  status: InventoryDocumentStatus;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  relatedOrderNo?: string;
  originalDocumentId?: string;
  reversalDocumentId?: string;
  qualityStatus?: InventoryQualityStatus;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  note?: string;
  operator: string;
  createdAt: string;
  submittedBy?: string;
  approvedBy?: string;
  postedBy?: string;
  postingAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  documentVersion?: number;
  completedAt?: string;
}

export interface ReplenishmentRequest {
  id: string;
  requestNo: string;
  productId: string;
  sku: string;
  productName: string;
  quantity: number;
  neededAt?: string;
  reason: string;
  requester: string;
  status: "待审批" | "已批准" | "已驳回" | "已转采购";
  reviewer?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplyDemand {
  id: string;
  orderId: string;
  orderNo: string;
  customerId: string;
  customerName: string;
  orderItemId: string;
  productName: string;
  specification?: string;
  quantity: number;
  supplyType: SupplyType;
  demandType: "库存锁定" | "样品锁定" | "采购需求" | "生产需求";
  status: SupplyDemandStatus;
  supplier?: string;
  unitCost?: number;
  orderedAt?: string;
  expectedAt?: string;
  receivedQuantity?: number;
  rejectedQuantity?: number;
  inspectionNote?: string;
  receivedAt?: string;
  payableStatus?: "未对账" | "待付款" | "部分付款" | "已付款";
  drawingVersion?: string;
  drawingConfirmedAt?: string;
  woodMaterial?: string;
  color?: string;
  dimensions?: string;
  craftRequirement?: string;
  productionProgress?:
    "资料待确认" | "已下厂" | "生产中" | "待质检" | "已发货" | "已到货";
  // Phase 3：单品展开的最小单位级需求
  skuUnitId?: string;
  sku?: string;
  componentName?: string;
  createdAt: string;
  updatedAt: string;
}
export type DeliveryStatus =
  "待排期" | "已排期" | "配送中" | "安装中" | "待验收" | "已完成";
export type DeliveryItemResult =
  "待确认" | "客户留下" | "退回仓库" | "客户留样" | "破损异常";
export type AfterSalesStatus = "待受理" | "处理中" | "待客户确认" | "已完成" | "待联系" | "已联系待上门" | "已上门处理中" | "已解决" | "已关闭" | "需换货" | "需退货" | "需厂家支持";

export interface PaymentRecord {
  id: string;
  orderId: string;
  type: "定金" | "进度款" | "尾款" | "退款";
  amount: number;
  paidAt: string;
  method: "微信" | "支付宝" | "银行卡" | "银行转账" | "现金" | "其他";
  recordedBy: string;
  note?: string;
  receiptNo?: string;
  attachments?: CustomerFile[];
  status?: "待财务确认" | "已确认" | "已驳回";
}

export interface SalesOrder {
  id: string;
  orderNo: string;
  orderType?: "订货" | "现货" | "退货";
  urgent?: boolean; // 加急订单：客户时间紧急，需按库存卖，现货不足行红色警示
  customerId: string;
  customerName: string;
  salesperson: string;
  salespersonId?: string;
  collaborators: string[];
  products: string[];
  items?: OrderItem[];
  contractAmount: number;
  otherFee?: number;
  signedAt: string;
  expectedDeliveryAt?: string;
  deliveryReminderAt?: string;
  expectedDeliveryMonth?: string;
  status: OrderStatus;
  payments: PaymentRecord[];
  performanceRate: number;
  note?: string;
  contactPhone?: string;
  deliveryAddress?: string;
  opener?: string;
  follower?: string;
  deliveryPerson?: string;
  signatureFiles?: CustomerFile[];
  customerCopyGiven?: boolean;
  printedAt?: string;
  signatureUploadedAt?: string;
  returnRecords?: OrderReturnRecord[];
  exchangeRecords?: OrderExchangeRecord[];
  quotationFiles?: CustomerFile[];
  quoteValidUntil?: string; // 报价单有效期（4.3 报价单模式）；草稿即报价，可设有效期
  requiredDeposit?: number;
  // —— 价格结构（2026-08-30 调整）——
  // listTotal 订单总价 = 商品合计 + 其他费用，是给客户看的标价/订单价格
  // actualReceived 实收价 = 实际成交收款价，客户讲价后手动调整；默认等于订单总价
  // 两者的差额（让利）只做内部留痕，不在订单/客户联上以「优惠」字样出现
  listTotal?: number;
  actualReceived?: number;
  depositRate?: number; // 定金比例（%），默认 50
  discountAmount?: number; // 内部留痕：订单总价 - 实收价
  discountReason?: string;
  customerConfirmationNote?: string;
  exceptionApproved?: boolean;
  customerConfirmedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  activatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderReturnRecord {
  id: string;
  itemId: string;
  productId?: string;
  /** Phase 4.4：产品库单品/套餐行退货时记录涉及的 SKU 单位 id */
  skuUnitIds?: string[];
  productName: string;
  quantity: number;
  reason: string;
  refundAmount: number;
  createdAt: string;
  operator: string;
}

export interface OrderExchangeRecord {
  id: string;
  oldItemId: string;
  oldProductId?: string;
  /** Phase 4.4：换货旧行为产品库单品/套餐行时记录涉及的 SKU 单位 id */
  oldSkuUnitIds?: string[];
  oldProductName: string;
  newProductId: string;
  newProductName: string;
  quantity: number;
  reason: string;
  priceDifference: number;
  createdAt: string;
  operator: string;
}

export interface DeliveryTask {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  address: string;
  contactPhone: string;
  scheduledAt?: string;
  remindAt?: string;
  expectedDeliveryMonth?: string;
  status: DeliveryStatus;
  owner: string;
  ownerId?: string;
  orderItemIds?: string[];
  itemQuantities?: Record<string, number>;
  deliveryNo?: string;
  vehicleInfo?: string;
  logisticsInfo?: string;
  customerSignatureDataUrl?: string;
  signedAt?: string;
  installer?: string;
  acceptanceNote?: string;
  handoverItems?: DeliveryHandoverItem[];
  settlementAmount?: number;
  settlementStatus?: "无需结算" | "待补款" | "待退款" | "已结算";
  returnInspection?: "无需退回" | "待退回验收" | "已验收入库";
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryHandoverItem {
  id: string;
  productId?: string;
  productName: string;
  specification?: string;
  quantity: number;
  unitPrice: number;
  source: "原订单" | "备选商品";
  result: DeliveryItemResult;
  resultNote?: string;
}

export interface AfterSalesTicket {
  id: string;
  ticketNo?: string;
  orderId: string;
  customerId: string;
  customerName: string;
  source?: "系统订单" | "历史客户";
  contactPhone?: string;
  address?: string;
  productInfo?: string;
  /** Phase 4.4：结构化商品引用，与 productInfo 文本并存（老工单零迁移） */
  configProductId?: string;
  packageId?: string;
  orderItemId?: string;
  skuUnitIds?: string[];
  purchaseAt?: string;
  category: "补件" | "维修" | "安装调整" | "安装问题" | "质量问题" | "换货" | "退货" | "使用咨询" | "其他";
  description: string;
  priority: "紧急" | "普通";
  status: AfterSalesStatus;
  owner: string;
  dueAt?: string;
  result?: string;
  feedbackAt?: string;
  feedbackSource?: "电话" | "微信" | "到店" | "其他";
  feedbackPerson?: string;
  feedbackFiles?: CustomerFile[];
  contacted?: boolean;
  contactedAt?: string;
  contactMethod?: "电话" | "微信" | "上门";
  contactNote?: string;
  nextContactAt?: string;
  appointmentAt?: string;
  visitedAt?: string;
  visitor?: string;
  onsiteProblem?: string;
  solutionType?: "维修" | "换货" | "退货" | "补偿" | "其他";
  processNote?: string;
  onsiteFiles?: CustomerFile[];
  resolved?: boolean;
  resolvedAt?: string;
  resolution?: string;
  satisfaction?: "满意" | "一般" | "不满意";
  customerFeedback?: string;
  note?: string;
  timeline?: AfterSalesTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface AfterSalesTimelineEvent {
  id: string;
  type: "工单创建" | "首次联系客户" | "预约上门" | "上门处理" | "解决完成" | "客户确认" | "状态变更";
  at: string;
  operator: string;
  detail?: string;
}

// ===== 产品主数据体系（Phase 1 新增，不改动既有 ProductCatalogItem）=====

// 媒体文件（图片 / 附件统一）。存 URL 而非 base64，避免 app_state 单行 JSON 暴涨。
export interface MediaFile {
  id: string;
  name: string;
  type: string; // image/png、application/pdf…
  url: string; // 上传后地址（经服务端 uploads 上传）
  size?: number;
  phase?: 'before' | 'during' | 'after'; // 案例图改前/中/后轻量标记
  tag?: string; // 可选标签（如场景/系列），用于前端筛选与展示
}

// 产品媒体资料（挂在单品 / 套餐上）
export interface ProductMedia {
  images: MediaFile[]; // 多张主图/产品图（第一张为主图）
  dimensionImages?: MediaFile[]; // 尺寸图
  materialImages?: MediaFile[]; // 材质图
  colorImages?: MediaFile[]; // 颜色图
  installationDoc?: MediaFile[]; // 安装说明
  careDoc?: MediaFile[]; // 保养说明
  manualFiles?: MediaFile[]; // 产品手册 / 附件（PDF 等）
  qualityStandard?: string; // 质检标准（含水率、色差、结构标准）
  whiteBgImages?: MediaFile[]; // ① 白底图（标准产品照，目录/详情主图）
  sceneImages?: MediaFile[]; // ② 场景图（真实/模拟空间效果，客厅/餐厅/卧室）
  realShotImages?: MediaFile[]; // ④ 实拍图（客户真实居家 / 送货师傅回传，可筛选 approved）
}

// 第1层 大类
export interface ProductCategory {
  id: string;
  name: string; // 餐桌类 / 沙发类
  code: string; // 大类代码，如 CT（餐桌）/ SF（沙发）
  sort: number;
}

// 第1.5层 产品系列：大类下的中间归类层级（仅分组视图，不参与业务计算）
// 「公共/其他」为内置虚拟系列（builtin: true），每个大类自动拥有，不可删除
export interface ProductSeries {
  id: string;
  categoryId: string; // 属于哪个大类
  name: string; // 五福系列 / 尚品系列 / 公共/其他
  sort: number;
  builtin?: boolean; // 内置系列（公共/其他），不可删除
}

// 第3层 规格维度定义（挂在主件下，每个主件各自拥有）
export interface ComponentSpecDim {
  id: string;
  name: string; // 尺寸 / 款式 / 材质
  values: string[]; // 尺寸: ['1.6m','1.8m']；材质: ['白蜡木','黑胡桃']
}

// 第2层 主件
export interface ProductComponent {
  id: string;
  categoryId: string; // 属于哪个大类
  seriesId?: string; // 属于哪个产品系列；空 = 公共/其他（历史数据默认归公共/其他）
  code: string; // 短码，如 CTM / CTJ / ZP
  name: string; // 餐台面 / 餐台脚 / 转盘
  sort: number;
  specDims: ComponentSpecDim[];
}

// 第4层 最小单位 SKU（主件 × 规格取值，真正挂价格/成本/库存）
export interface SkuUnit {
  id: string;
  componentId: string;
  sku: string; // 自动生成：CTM-1.8M-HZW
  specValues: Record<string, string>; // { 尺寸:'1.8m', 材质:'黑胡桃' }
  unitPrice: number; // 售价
  costPrice: number; // 成本
  supplyType: SupplyType; // 现货/展厅样品/外采产品/定制生产
  availableStock: number;
  reservedStock: number;
  safetyStock: number;
  supplier?: string;
  image?: string; // 可选：材质/颜色特写图
  status: "上架" | "下架";
}

// 单品组合模板中的主件条目
export interface ConfigProductComponent {
  componentId: string;
  quantity: number; // 数量（餐脚 1 套、台面 1）
  optional: boolean; // 是否可选（转盘）
  locked?: Record<string, string>; // 锁定规格值 { 尺寸:'1.8m' }
  allowed?: Record<string, string[]>; // 开放规格值 { 材质:['黑胡桃','白蜡木'] }（不填=全部开放）
}

// 第5层 单品（老板手工精选组合，不直接存库存）
export interface ConfigProduct {
  id: string;
  categoryId: string;
  name: string; // 1.8m 黑胡桃圆餐桌
  code: string; // 自动生成：SP-CT-001
  /** 产品分组 ID：同名产品的不同尺寸/规格共享同一 groupId，目录按组聚合展示（一个产品一张卡） */
  groupId?: string;
  /** 规格展示值（如 1200*600*450 / 1.8米），详情页规格选择器与目录卡用 */
  specLabel?: string;
  description?: string; // 详情 / 卖点描述
  style?: string; // 风格：意式极简 / 新中式…
  series?: string; // 所属系列：五福沙发系列…
  materialDescription?: string; // 用材说明（谈单展示，如「北美黑胡桃木实木框架，环保木蜡油」）
  applicableSpace?: string[]; // 适用空间：客厅 / 餐厅 / 卧室…
  sortOrder: number; // 展示排序（越小越靠前）
  media?: ProductMedia; // 多图 / 尺寸图 / 材质图 / 安装保养 / 手册 / 质检标准
  components: ConfigProductComponent[]; // 组合模板
  adjustPrice: number; // 增减价（可正可负可 0）
  status: "上架" | "下架";
}

// 套餐中的单品条目
export interface PackageItem {
  productId: string; // 引用单品
  quantity: number; // 默认数量（餐桌×1）
  quantityOptions?: number[]; // 可选数量（餐椅 [4,6]）
  optional?: boolean;
}

// 第6层 套餐（单品组合，可配置数量）
export interface ProductPackage {
  id: string;
  name: string; // 餐厅套系
  code: string; // 自动生成：TC-001
  description?: string;
  sortOrder: number; // 展示排序
  media?: ProductMedia;
  items: PackageItem[];
  adjustPrice: number; // 套餐增减价
  status: "上架" | "下架";
}
