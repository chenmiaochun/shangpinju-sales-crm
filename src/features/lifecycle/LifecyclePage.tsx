import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  PackageCheck,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import type {
  AfterSalesTicket,
  Customer,
  DeliveryTask,
  OrderItem,
  PaymentRecord,
  ProductCatalogItem,
  SalesOrder,
  SupplyDemand,
} from "../../types";
import "./lifecycle.css";
import "./lifecycle-delivery.css";
import "./lifecycle-handover.css";
import { HandoverDialog } from "./HandoverDialog";
import { OrderDetailPage } from "./OrderDetailPage";
import {
  hasArrivalReminder,
  summarizeOrderFulfillment,
} from "./order-fulfillment";

type Tab = "订单与业绩" | "交付安装";

interface Props {
  customers: Customer[];
  orders: SalesOrder[];
  deliveryTasks: DeliveryTask[];
  products: ProductCatalogItem[];
  deliveryStaff?: { id: string; name: string }[];
  afterSalesTickets: AfterSalesTicket[];
  supplyDemands?: SupplyDemand[];
  activeUser: string;
  onUpdateOrder: (id: string, changes: Partial<SalesOrder>) => void;
  onAddPayment: (orderId: string, item: PaymentRecord) => void;
  onCancelOrder?: (orderId: string, operator: string) => void;
  onReturnItem?: (
    orderId: string,
    itemId: string,
    quantity: number,
    reason: string,
    operator: string,
  ) => void;
  onExchangeItem?: (
    orderId: string,
    itemId: string,
    newProductId: string,
    quantity: number,
    reason: string,
    operator: string,
  ) => void;
  onAddDelivery: (item: DeliveryTask) => void;
  onUpdateDelivery: (id: string, changes: Partial<DeliveryTask>) => void;
}

const money = (value: number) =>
  new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
const paid = (order: SalesOrder) =>
  order.payments.reduce(
    (sum, item) => sum + (item.type === "退款" ? -item.amount : item.amount),
    0,
  );
const id = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const INVENTORY_SYSTEM_URL = String(
  import.meta.env.VITE_INVENTORY_SYSTEM_URL || "",
);
const deliveryMonth = (task: DeliveryTask) =>
  task.expectedDeliveryMonth ?? task.scheduledAt?.slice(0, 7) ?? "待确认";
const monthLabel = (month: string) =>
  month === "待确认" ? month : month.replace("-", " 年 ") + " 月";
function externalOrderUrl(base: string, task: DeliveryTask) {
  if (!base) return "";
  try {
    const url = new URL(base);
    url.searchParams.set("orderId", task.orderId);
    url.searchParams.set("customerId", task.customerId);
    return url.toString();
  } catch {
    return "";
  }
}

export function LifecyclePage(props: Props) {
  const [tab, setTab] = useState<Tab>("订单与业绩");
  const [dialog, setDialog] = useState<
  | "payment"
  | "delivery"
  | "handover"
  | "return"
  | "exchange"
  | null
  >(null);
  const [orderFilter, setOrderFilter] = useState("全部");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState(
    props.orders[0]?.id ?? "",
  );
  const [detailOrderId, setDetailOrderId] = useState("");
  const [selectedDeliveryMonth, setSelectedDeliveryMonth] = useState("");
  const selectedOrder =
    props.orders.find((item) => item.id === selectedOrderId) ?? props.orders[0];
  const detailOrder = props.orders.find((item) => item.id === detailOrderId);
  const filteredOrders = useMemo(
    () =>
      props.orders.filter((order) => {
        if (orderFilter === "全部") return true;
        if (orderFilter === "待发货")
          return [
            "已签名已确认",
            "已齐货",
            "待送货",
            "备货中",
            "部分齐货",
          ].includes(order.status);
        if (orderFilter === "部分发货") return order.status === "部分发货";
        if (orderFilter === "已发货待签收") return order.status === "全部发货";
        if (orderFilter === "已签收待收尾款") return order.status === "已签收";
        if (orderFilter === "已完成")
          return ["已收尾款", "已完成", "已验收"].includes(order.status);
        return ["换货中", "退货中"].includes(order.status);
      }),
    [orderFilter, props.orders],
  );
  const totals = useMemo(
    () => ({
      contracts: props.orders.reduce(
        (sum, item) => sum + item.contractAmount,
        0,
      ),
      received: props.orders.reduce((sum, item) => sum + paid(item), 0),
      pendingDelivery: props.deliveryTasks.filter(
        (item) => item.status !== "已完成",
      ).length,
      openTickets: props.afterSalesTickets.filter(
        (item) => item.status !== "已完成",
      ).length,
    }),
    [props.afterSalesTickets, props.deliveryTasks, props.orders],
  );
  const deliveryMonths = useMemo(
    () =>
      Object.entries(
        props.deliveryTasks.reduce<Record<string, number>>((groups, task) => {
          const month = deliveryMonth(task);
          groups[month] = (groups[month] ?? 0) + 1;
          return groups;
        }, {}),
      ).sort(([left], [right]) => left.localeCompare(right)),
    [props.deliveryTasks],
  );
  const activeDeliveryMonth =
    selectedDeliveryMonth || deliveryMonths[0]?.[0] || "";
  const monthlyDeliveryTasks = useMemo(
    () =>
      props.deliveryTasks
        .filter((task) => deliveryMonth(task) === activeDeliveryMonth)
        .sort((left, right) =>
          (left.scheduledAt ?? left.remindAt ?? "").localeCompare(
            right.scheduledAt ?? right.remindAt ?? "",
          ),
        ),
    [activeDeliveryMonth, props.deliveryTasks],
  );
  const readyUnscheduledItems = (order: SalesOrder) => {
    const scheduled = new Set(
      props.deliveryTasks
        .filter((task) => task.orderId === order.id)
        .flatMap((task) => task.orderItemIds ?? []),
    );
    if (!order.items?.length) return [];
    return order.items.filter((item) => {
      if (scheduled.has(item.id)) return false;
      const demand = props.supplyDemands?.find(
        (entry) => entry.orderId === order.id && entry.orderItemId === item.id,
      );
      return !demand || ["已锁定", "已到货"].includes(demand.status);
    });
  };
  const pendingDeliveryOrders = useMemo(
    () =>
      props.orders.filter(
        (order) =>
          ["部分齐货", "已齐货", "待送货"].includes(order.status) &&
          (order.items?.length
            ? readyUnscheduledItems(order).length > 0
            : !props.deliveryTasks.some((task) => task.orderId === order.id)),
      ),
    [props.deliveryTasks, props.orders, props.supplyDemands],
  );

  return (
    <main className="lifecycle-page">
      <header className="lifecycle-header">
        <div>
          <p>成交履约</p>
          <h1>订单、交付与售后</h1>
          <span>
            本页只处理已创建订单的收款、交付和售后；新订单统一从“选品订单”创建。
          </span>
        </div>
        <a className="primary-button" href="#/orders">
          进入选品订单
        </a>
      </header>
      <section className="lifecycle-metrics" aria-label="成交履约指标">
        <article>
          <CircleDollarSign />
          <div>
            <span>合同金额</span>
            <strong>{money(totals.contracts)}</strong>
            <small>{props.orders.length} 笔订单</small>
          </div>
        </article>
        <article>
          <CheckCircle2 />
          <div>
            <span>已回款</span>
            <strong>{money(totals.received)}</strong>
            <small>
              待收 {money(Math.max(0, totals.contracts - totals.received))}
            </small>
          </div>
        </article>
        <article>
          <Truck />
          <div>
            <span>待交付安装</span>
            <strong>{totals.pendingDelivery}</strong>
            <small>按排期推进</small>
          </div>
        </article>
        <article>
          <Wrench />
          <div>
            <span>待处理售后</span>
            <strong>{totals.openTickets}</strong>
            <small>超期需店长介入</small>
          </div>
        </article>
      </section>
      <div className="lifecycle-tabs" role="tablist">
        {(["订单与业绩", "交付安装"] as Tab[]).map((item) => (
          <button
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "订单与业绩" && detailOrder && (
        <OrderDetailPage
          order={detailOrder}
          products={props.products}
          onBack={() => setDetailOrderId("")}
          onSave={(changes) => props.onUpdateOrder(detailOrder.id, changes)}
          onArrangeDelivery={() => setDialog("delivery")}
          onCollectBalance={() => setDialog("payment")}
          onReturn={() => setDialog("return")}
          onExchange={() => setDialog("exchange")}
          onCancel={() =>
            props.onCancelOrder?.(detailOrder.id, props.activeUser)
          }
          onAfterSales={() => { window.location.hash=`/after-sales?order=${encodeURIComponent(detailOrder.id)}` }}
        />
      )}
      {tab === "订单与业绩" && !detailOrder && (
        <section className="lifecycle-panel">
          <div className="panel-title">
            <div>
              <h2>成交订单</h2>
              <span>点击任意订单查看商品库存、预计到货时间和完整进度。</span>
            </div>
            {selectedOrder && (
              <button onClick={() => setDialog("payment")}>登记收款</button>
            )}
          </div>
          <div className="order-status-filters">
            {[
              "全部",
              "待发货",
              "部分发货",
              "已发货待签收",
              "已签收待收尾款",
              "已完成",
              "换货/退货中",
            ].map((filter) => (
              <button
                type="button"
                className={filter === orderFilter ? "active" : ""}
                onClick={() => setOrderFilter(filter)}
                key={filter}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="order-table">
            <div className="table-row table-head">
              <span>订单 / 客户</span>
              <span>负责人</span>
              <span>合同金额</span>
              <span>已回款</span>
              <span>业绩金额</span>
              <span>订单 / 备货状态</span>
            </div>
            {filteredOrders.map((order) => {
              const summary = summarizeOrderFulfillment(order, props.products);
              const reminder = hasArrivalReminder(order, props.products);
              return (
                <button
                  className={`table-row ${selectedOrder?.id === order.id ? "selected" : ""} ${reminder ? "arrival-reminder" : ""}`}
                  key={order.id}
                  onClick={() => {
                    setSelectedOrderId(order.id);
                    setDetailOrderId(order.id);
                  }}
                >
                  <span>
                    <b>{order.orderNo}</b>
                    <small>
                      {order.customerName} · {order.products.join("、")}
                    </small>
                    {reminder && (
                      <em>
                        <AlertTriangle />
                        预计到货临近或已逾期
                      </em>
                    )}
                  </span>
                  <span>{order.salesperson}</span>
                  <span>{money(order.contractAmount)}</span>
                  <span>{money(paid(order))}</span>
                  <span>
                    {money((paid(order) * order.performanceRate) / 100)}
                  </span>
                  <span>
                    <b>{order.status}</b>
                    <i className={`order-fulfillment-pill ${summary.tone}`}>
                      {summary.label}
                    </i>
                    <small>{summary.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {!props.orders.length && (
            <Empty
              icon={<PackageCheck />}
              title="还没有成交订单"
              detail="客户确认购买意向后，请前往选品订单创建。"
            />
          )}
          {selectedOrder && (
            <div className="order-detail">
              <div>
                <span>回款进度</span>
                <strong>
                  {Math.min(
                    100,
                    Math.round(
                      (paid(selectedOrder) / selectedOrder.contractAmount) *
                        100,
                    ),
                  )}
                  %
                </strong>
                <progress
                  max="100"
                  value={
                    (paid(selectedOrder) / selectedOrder.contractAmount) * 100
                  }
                />
              </div>
              <div>
                <span>业绩归属</span>
                <strong>{selectedOrder.salesperson}</strong>
                <small>计入比例 {selectedOrder.performanceRate}%</small>
              </div>
              <div>
                <span>预计交付</span>
                <strong>{selectedOrder.expectedDeliveryAt || "待排期"}</strong>
                <small>
                  {selectedOrder.collaborators.length
                    ? `协作：${selectedOrder.collaborators.join("、")}`
                    : "暂无协作人员"}
                </small>
              </div>
            </div>
          )}
        </section>
      )}
      {tab === "交付安装" && (
        <section className="lifecycle-panel">
          <div className="panel-title">
            <div>
              <h2>送货安装排期</h2>
              <span>
                先按月份查看售后工作量，再进入客户订单处理库存与送货详情。
              </span>
            </div>
          </div>
          {deliveryMonths.length > 0 && (
            <section className="delivery-months" aria-label="月度预计送货订单">
              {deliveryMonths.map(([month, count]) => (
                <button
                  type="button"
                  aria-pressed={activeDeliveryMonth === month}
                  className={activeDeliveryMonth === month ? "active" : ""}
                  key={month}
                  onClick={() => setSelectedDeliveryMonth(month)}
                >
                  <Truck />
                  <span>{monthLabel(month)}</span>
                  <strong>{count}</strong>
                  <small>客户 / 订单</small>
                </button>
              ))}
            </section>
          )}
          {monthlyDeliveryTasks.length > 0 && (
            <section className="monthly-delivery-list">
              <header>
                <div>
                  <h3>{monthLabel(activeDeliveryMonth)}送货客户清单</h3>
                  <span>共 {monthlyDeliveryTasks.length} 个交付任务</span>
                </div>
                <small>外部系统入口需在部署环境配置</small>
              </header>
              <div className="monthly-delivery-table">
                <div className="monthly-delivery-row monthly-delivery-head">
                  <span>客户 / 订单</span>
                  <span>产品</span>
                  <span>送货计划</span>
                  <span>负责人</span>
                  <span>状态</span>
                  <span>详情</span>
                </div>
                {monthlyDeliveryTasks.map((task) => {
                  const order = props.orders.find(
                    (item) => item.id === task.orderId,
                  );
                  const inventoryUrl = externalOrderUrl(
                    INVENTORY_SYSTEM_URL,
                    task,
                  );
                  return (
                    <div className="monthly-delivery-row" key={task.id}>
                      <span>
                        <b>{task.customerName}</b>
                        <small>
                          {task.contactPhone || "电话未登记"} ·{" "}
                          {order?.orderNo ?? task.orderId}
                        </small>
                      </span>
                      <span>{order?.products.join("、") || "产品待确认"}</span>
                      <span>
                        {task.scheduledAt?.replace("T", " ") ||
                          `${deliveryMonth(task)} · 日期待确认`}
                      </span>
                      <span>{task.owner || "待指派"}</span>
                      <span>
                        <i>{task.status}</i>
                      </span>
                      <span className="delivery-links">
                        <button
                          type="button"
                          onClick={() => {
                            if (order) {
                              setSelectedOrderId(order.id);
                              setDialog("delivery");
                            }
                          }}
                        >
                          安排交付
                        </button>
                        <a
                          href={`#/customers?customer=${encodeURIComponent(task.customerId)}`}
                        >
                          客户
                        </a>
                        {inventoryUrl ? (
                          <a
                            href={inventoryUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            库存
                            <ExternalLink />
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="尚未配置库存系统地址"
                          >
                            库存
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {!props.deliveryTasks.length && (
            <Empty
              icon={<Truck />}
              title="暂无交付任务"
              detail="选择成交订单后建立送货与安装排期。"
            />
          )}
        </section>
      )}
      {tab === "交付安装" && pendingDeliveryOrders.length > 0 && (
        <section className="pending-delivery-orders">
          <header>
            <div>
              <h2>待安排交付客户</h2>
              <span>
                已齐货可整单交付；部分齐货可选择本次已到商品分批交付。
              </span>
            </div>
          </header>
          <div>
            {pendingDeliveryOrders.map((order) => {
              const ready = readyUnscheduledItems(order);
              return (
                <article key={order.id}>
                  <span>
                    <b>{order.customerName}</b>
                    <small>
                      {order.orderNo} · {order.products.join("、")}
                    </small>
                  </span>
                  <span>
                    <i>{order.status}</i>
                    <small>
                      {order.status === "部分齐货"
                        ? `本次可交付 ${ready.length} 项`
                        : order.expectedDeliveryMonth
                          ? `${order.expectedDeliveryMonth} 预计送货`
                          : order.expectedDeliveryAt || "送货时间待确认"}
                    </small>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setDialog("delivery");
                    }}
                  >
                    {order.status === "部分齐货" ? "安排分批交付" : "安排交付"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}{" "}
      {tab === "交付安装" && props.deliveryTasks.length > 0 && (
        <section className="handover-board">
          <header>
            <div>
              <h2>配送交接</h2>
              <span>
                记录装车、客户留用、退回、留样和异常，所有商品有去向后才能完成。
              </span>
            </div>
          </header>
          <div>
            {props.deliveryTasks.map((task) => (
              <article key={task.id}>
                <span>
                  <b>{task.customerName}</b>
                  <small>
                    {props.orders.find((item) => item.id === task.orderId)
                      ?.orderNo ?? task.orderId}
                  </small>
                </span>
                <span>
                  <i>
                    {task.handoverItems?.length ??
                      task.orderItemIds?.length ??
                      0}
                  </i>{" "}
                  件装车明细
                </span>
                <span>{task.settlementStatus ?? "尚未交接"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeliveryId(task.id);
                    setDialog("handover");
                  }}
                >
                  {task.handoverItems?.length ? "继续处理" : "开始交接"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {dialog === "handover" &&
        (() => {
          const task = props.deliveryTasks.find(
            (item) => item.id === selectedDeliveryId,
          );
          const order = props.orders.find((item) => item.id === task?.orderId);
          return task && order ? (
            <HandoverDialog
              task={task}
              order={order}
              products={props.products}
              onClose={() => setDialog(null)}
              onSubmit={(changes) => {
                props.onUpdateDelivery(task.id, changes);
                setDialog(null);
              }}
            />
          ) : null;
        })()}
      {dialog === "payment" && selectedOrder && (
        <PaymentDialog
          order={selectedOrder}
          activeUser={props.activeUser}
          onClose={() => setDialog(null)}
          onSubmit={(payment) => {
            props.onAddPayment(selectedOrder.id, payment);
            setDialog(null);
          }}
        />
      )}
      {dialog === "delivery" && selectedOrder && (
        <DeliveryDialog
          order={selectedOrder}
          eligibleItems={
            readyUnscheduledItems(selectedOrder)
          }
          deliveryStaff={props.deliveryStaff ?? []}
          activeUser={props.activeUser}
          customer={props.customers.find(
            (item) => item.id === selectedOrder.customerId,
          )}
          onClose={() => setDialog(null)}
          onSubmit={(task) => {
            props.onAddDelivery(task);
            setDialog(null);
          }}
        />
      )}
      {(dialog === "return" || dialog === "exchange") && selectedOrder && (
        <OrderAdjustmentDialog
          mode={dialog}
          order={selectedOrder}
          products={props.products}
          onClose={() => setDialog(null)}
          onSubmit={(itemId, quantity, reason, newProductId) => {
            if (dialog === "return")
              props.onReturnItem?.(
                selectedOrder.id,
                itemId,
                quantity,
                reason,
                props.activeUser,
              );
            else if (newProductId)
              props.onExchangeItem?.(
                selectedOrder.id,
                itemId,
                newProductId,
                quantity,
                reason,
                props.activeUser,
              );
            setDialog(null);
          }}
        />
      )}
    </main>
  );
}

function Empty({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="lifecycle-empty">
      {icon}
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

function DialogShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="lifecycle-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="lifecycle-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button aria-label="关闭" onClick={onClose}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PaymentDialog({
  order,
  activeUser,
  onClose,
  onSubmit,
}: {
  order: SalesOrder;
  activeUser: string;
  onClose: () => void;
  onSubmit: (item: PaymentRecord) => void;
}) {
  const [amount, setAmount] = useState(
    Math.max(0, order.contractAmount - paid(order)),
  );
  const [type, setType] = useState<PaymentRecord["type"]>("定金");
  const [method, setMethod] = useState<PaymentRecord["method"]>("微信");
  return (
    <DialogShell title={`登记收款 · ${order.customerName}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            id: id("payment"),
            orderId: order.id,
            type,
            amount,
            paidAt: new Date().toISOString(),
            method,
            recordedBy: activeUser,
          });
        }}
      >
        <label>
          款项类型
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PaymentRecord["type"])}
          >
            <option>定金</option>
            <option>进度款</option>
            <option>尾款</option>
            <option>退款</option>
          </select>
        </label>
        <label>
          金额
          <input
            aria-label="收款金额"
            required
            min="1"
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <label>
          收款方式
          <select value={method} onChange={(e)=>setMethod(e.target.value as PaymentRecord["method"])}>
            <option>现金</option><option>微信</option><option>支付宝</option><option>银行卡</option><option>银行转账</option><option>其他</option>
          </select>
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button">确认登记</button>
        </footer>
      </form>
    </DialogShell>
  );
}

function DeliveryDialog({
  order,
  eligibleItems,
  deliveryStaff,
  customer,
  activeUser,
  onClose,
  onSubmit,
}: {
  order: SalesOrder;
  eligibleItems: OrderItem[];
  deliveryStaff: { id: string; name: string }[];
  customer?: Customer;
  activeUser: string;
  onClose: () => void;
  onSubmit: (item: DeliveryTask) => void;
}) {
  const [address, setAddress] = useState(
    order.deliveryAddress || customer?.cityArea || "",
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [owner, setOwner] = useState(deliveryStaff[0]?.name || activeUser);
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [logisticsInfo, setLogisticsInfo] = useState("");
  const [selectedIds, setSelectedIds] = useState(
    eligibleItems
      .filter((item) => (item.shippedQuantity ?? 0) < item.quantity)
      .map((item) => item.id),
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(
      eligibleItems.map((item) => [
        item.id,
        Math.max(0, item.quantity - (item.shippedQuantity ?? 0)),
      ]),
    ),
  );
  return (
    <DialogShell title={`安排发货 · ${order.customerName}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (eligibleItems.length && !selectedIds.length) return;
          const now = new Date().toISOString();
          const suffix = String(Date.now()).slice(-8);
          onSubmit({
            id: id("delivery"),
            deliveryNo: `FH${suffix}`,
            orderId: order.id,
            customerId: order.customerId,
            customerName: order.customerName,
            address,
            contactPhone: order.contactPhone || customer?.phone || "",
            orderItemIds: selectedIds,
            itemQuantities: Object.fromEntries(
              selectedIds.map((itemId) => [itemId, quantities[itemId] ?? 1]),
            ),
            vehicleInfo: vehicleInfo || undefined,
            logisticsInfo: logisticsInfo || undefined,
            scheduledAt: scheduledAt || now,
            expectedDeliveryMonth: order.expectedDeliveryMonth,
            status: "配送中",
            owner,
            createdAt: now,
            updatedAt: now,
          });
        }}
      >
        {eligibleItems.length > 0 && (
          <fieldset>
            <legend>本次发货商品（可多次部分发货）</legend>
            {eligibleItems.map((item) => {
              const remain = Math.max(
                0,
                item.quantity - (item.shippedQuantity ?? 0),
              );
              return (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    disabled={!remain}
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span>
                    {item.productName} · 待发 {remain}件
                  </span>
                  {selectedIds.includes(item.id) && (
                    <input
                      aria-label={`${item.productName}本次发货数量`}
                      type="number"
                      min="1"
                      max={remain}
                      value={quantities[item.id] ?? remain}
                      onChange={(event) =>
                        setQuantities({
                          ...quantities,
                          [item.id]: Number(event.target.value),
                        })
                      }
                    />
                  )}
                </label>
              );
            })}
          </fieldset>
        )}
        <label>
          发货日期
          <input
            required
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>
        <label>
          送货人员
          <select
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
          >
            {deliveryStaff.length ? (
              deliveryStaff.map((person) => (
                <option key={person.id}>{person.name}</option>
              ))
            ) : (
              <option>{activeUser}</option>
            )}
          </select>
        </label>
        <label>
          送货车辆
          <input
            value={vehicleInfo}
            onChange={(event) => setVehicleInfo(event.target.value)}
            placeholder="车牌号 / 车型"
          />
        </label>
        <label>
          物流信息
          <input
            value={logisticsInfo}
            onChange={(event) => setLogisticsInfo(event.target.value)}
            placeholder="物流公司 / 运单号（自送可不填）"
          />
        </label>
        <label>
          送货地址
          <input
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="primary-button"
            disabled={eligibleItems.length > 0 && !selectedIds.length}
          >
            生成发货单并确认发货
          </button>
        </footer>
      </form>
    </DialogShell>
  );
}

function OrderAdjustmentDialog({
  mode,
  order,
  products,
  onClose,
  onSubmit,
}: {
  mode: "return" | "exchange";
  order: SalesOrder;
  products: ProductCatalogItem[];
  onClose: () => void;
  onSubmit: (
    itemId: string,
    quantity: number,
    reason: string,
    newProductId?: string,
  ) => void;
}) {
  const items = order.items ?? [];
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [newProductId, setNewProductId] = useState(products[0]?.id ?? "");
  const old = items.find((item) => item.id === itemId);
  const next = products.find((item) => item.id === newProductId);
  const difference =
    mode === "exchange" && old && next
      ? (next.unitPrice - old.unitPrice) * quantity
      : 0;
  return (
    <DialogShell
      title={`${mode === "return" ? "退货" : "换货"}处理 · ${order.customerName}`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(itemId, quantity, reason, newProductId);
        }}
      >
        <label>
          原商品
          <select
            value={itemId}
            onChange={(event) => setItemId(event.target.value)}
          >
            {items.map((item) => (
              <option value={item.id} key={item.id}>
                {item.productName} · 已发/签收{" "}
                {item.signedQuantity ?? item.shippedQuantity ?? 0}
              </option>
            ))}
          </select>
        </label>
        <label>
          数量
          <input
            type="number"
            min="1"
            max={
              old?.signedQuantity ?? old?.shippedQuantity ?? old?.quantity ?? 1
            }
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </label>
        {mode === "exchange" && (
          <label>
            更换为
            <select
              value={newProductId}
              onChange={(event) => setNewProductId(event.target.value)}
            >
              {products.map((product) => (
                <option value={product.id} key={product.id}>
                  {product.name} · 可用{" "}
                  {Math.max(
                    0,
                    product.availableStock - (product.reservedStock ?? 0),
                  )}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {mode === "return" ? "退货" : "换货"}原因
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <p className="dialog-note">
          {mode === "return"
            ? `预计退款 ${money((old?.unitPrice ?? 0) * quantity)}`
            : `差价 ${difference >= 0 ? "补收" : "应退"} ${money(Math.abs(difference))}`}
          ；确认后自动写入库存流水和订单历史。
        </p>
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary-button">
            确认{mode === "return" ? "退货" : "换货"}
          </button>
        </footer>
      </form>
    </DialogShell>
  );
}
