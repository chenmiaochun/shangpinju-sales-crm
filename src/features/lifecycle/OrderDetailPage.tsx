import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, PackageCheck, Save } from "lucide-react";
import type { OrderItem, ProductCatalogItem, SalesOrder } from "../../types";
import {
  resolveItemFulfillment,
  summarizeOrderFulfillment,
} from "./order-fulfillment";
import "./order-detail-page.css";

interface Props {
  order: SalesOrder;
  products: ProductCatalogItem[];
  onBack: () => void;
  onSave: (changes: Partial<SalesOrder>) => void;
  onArrangeDelivery: () => void;
  onCollectBalance: () => void;
  onReturn: () => void;
  onExchange: () => void;
  onCancel: () => void;
  onAfterSales: () => void;
}
const money = (value: number) =>
  new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(
    value,
  );

export function OrderDetailPage({
  order,
  products,
  onBack,
  onSave,
  onArrangeDelivery,
  onCollectBalance,
  onReturn,
  onExchange,
  onCancel,
  onAfterSales,
}: Props) {
  const [draft, setDraft] = useState(order);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(order), [order]);
  const summary = useMemo(
    () => summarizeOrderFulfillment(draft, products),
    [draft, products],
  );
  const grouped = useMemo(
    () =>
      (draft.items ?? []).reduce<Record<string, OrderItem[]>>(
        (result, item) => {
          const product = products.find(
            (candidate) =>
              candidate.id === item.productId || candidate.sku === item.sku,
          );
          const category =
            product?.categoryLevel1 || product?.category || "其他商品";
          (result[category] ??= []).push(item);
          return result;
        },
        {},
      ),
    [draft.items, products],
  );
  const updateItem = (itemId: string, changes: Partial<OrderItem>) =>
    setDraft((current) => ({
      ...current,
      items: current.items?.map((item) =>
        item.id === itemId ? { ...item, ...changes } : item,
      ),
    }));
  const submit = () => {
    onSave({
      customerName: draft.customerName,
      contactPhone: draft.contactPhone,
      deliveryAddress: draft.deliveryAddress,
      signedAt: draft.signedAt,
      expectedDeliveryAt: draft.expectedDeliveryAt,
      note: draft.note,
      items: draft.items,
      updatedAt: new Date().toISOString(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };
  return (
    <section className="fulfillment-detail">
      <header className="fulfillment-detail__header">
        <button type="button" onClick={onBack}>
          <ArrowLeft />
          返回订单列表
        </button>
        <div>
          <span>订单详情 · {draft.status}</span>
          <h2>{draft.orderNo}</h2>
        </div>
        <div className={`fulfillment-summary ${summary.tone}`}>
          <strong>{summary.label}</strong>
          <small>{summary.detail}</small>
        </div>
      </header>
      <div className="order-basic-grid">
        <label>
          客户名称
          <input
            value={draft.customerName}
            onChange={(event) =>
              setDraft({ ...draft, customerName: event.target.value })
            }
          />
        </label>
        <label>
          联系方式
          <input
            value={draft.contactPhone ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, contactPhone: event.target.value })
            }
          />
        </label>
        <label className="wide">
          送货地址
          <input
            value={draft.deliveryAddress ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, deliveryAddress: event.target.value })
            }
          />
        </label>
        <label>
          开单日期
          <input
            type="date"
            value={draft.signedAt.slice(0, 10)}
            onChange={(event) =>
              setDraft({ ...draft, signedAt: event.target.value })
            }
          />
        </label>
        <label>
          送货日期
          <input
            type="date"
            value={draft.expectedDeliveryAt?.slice(0, 10) ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, expectedDeliveryAt: event.target.value })
            }
          />
        </label>
      </div>
      <section className="fulfillment-products">
        <header>
          <div>
            <h3>商品履约明细</h3>
            <span>库存按商品库实时判断；特殊颜色、尺寸可手动改为需订货。</span>
          </div>
          <span>{draft.items?.length ?? 0} 项商品</span>
        </header>
        {!draft.items?.length && (
          <div className="no-order-items">
            <PackageCheck />
            <span>该订单暂时没有商品明细</span>
          </div>
        )}
        {Object.entries(grouped).map(([category, items]) => (
          <div className="product-group" key={category}>
            <h4>
              {category}
              <small>{items.length} 项</small>
            </h4>
            <div className="fulfillment-product-table">
              <div className="fulfillment-product-row head">
                <span>商品 / 规格</span>
                <span>数量</span>
                <span>单价 / 金额</span>
                <span>库存状态</span>
                <span>预计到货</span>
                <span>操作</span>
              </div>
              {items.map((item) => {
                const product = products.find(
                  (entry) =>
                    entry.id === item.productId || entry.sku === item.sku,
                );
                const current =
                  product?.availableStock ?? item.availableStock ?? 0;
                const occupied = Math.min(
                  item.quantity,
                  product?.reservedStock ?? 0,
                );
                const free = Math.max(
                  0,
                  current - (product?.reservedStock ?? 0),
                );
                const resolved = resolveItemFulfillment(item, products);
                const selection = item.fulfillmentManual
                  ? item.fulfillmentStatus
                  : "自动判断";
                return (
                  <div
                    className={`fulfillment-product-row ${free < Math.max(0, item.quantity - (item.shippedQuantity ?? 0)) ? "stock-shortage" : ""}`}
                    key={item.id}
                  >
                    <span>
                      <b>{item.productName}</b>
                      <small>
                        {[
                          item.sku,
                          item.specification,
                          item.material,
                          item.color,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "规格未登记"}
                      </small>
                    </span>
                    <span>
                      {item.quantity} {item.unit || "件"}
                      <small>
                        已发 {item.shippedQuantity ?? 0} · 已签收{" "}
                        {item.signedQuantity ?? 0}
                      </small>
                    </span>
                    <span>
                      <b>{money(item.unitPrice)}</b>
                      <small>
                        小计 {money(item.quantity * item.unitPrice)}
                      </small>
                    </span>
                    <span>
                      <i
                        className={`stock-pill ${resolved.status === "现货" ? "available" : resolved.status === "需订货" ? "ordering" : "arrived"}`}
                      >
                        {resolved.status}
                      </i>
                      <small>
                        当前 {current} · 本单占用 {occupied} · 剩余可用 {free}
                      </small>
                    </span>
                    <span>
                      {resolved.status === "需订货" ? (
                        <input
                          aria-label={`${item.productName}预计到货时间`}
                          type="date"
                          value={item.expectedArrivalAt?.slice(0, 10) ?? ""}
                          onChange={(event) =>
                            updateItem(item.id, {
                              expectedArrivalAt: event.target.value,
                            })
                          }
                        />
                      ) : (
                        <small>无需等待</small>
                      )}
                    </span>
                    <span>
                      <select
                        aria-label={`${item.productName}库存状态`}
                        value={selection}
                        onChange={(event) => {
                          const value = event.target.value;
                          updateItem(
                            item.id,
                            value === "自动判断"
                              ? {
                                  fulfillmentManual: false,
                                  fulfillmentStatus: undefined,
                                  arrivedAt: undefined,
                                }
                              : {
                                  fulfillmentManual: true,
                                  fulfillmentStatus:
                                    value as OrderItem["fulfillmentStatus"],
                                  arrivedAt:
                                    value === "已到货待发货"
                                      ? new Date().toISOString()
                                      : undefined,
                                },
                          );
                        }}
                      >
                        <option>自动判断</option>
                        <option>现货</option>
                        <option>需订货</option>
                        <option>已到货待发货</option>
                      </select>
                      {resolved.status === "需订货" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, {
                              fulfillmentManual: true,
                              fulfillmentStatus: "已到货待发货",
                              arrivedAt: new Date().toISOString(),
                            })
                          }
                        >
                          <Check />
                          标记已到货
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
      <section className="order-detail-bottom">
        <div>
          <h3>金额汇总</h3>
          <dl>
            <div>
              <dt>商品金额</dt>
              <dd>
                {money(
                  (draft.items ?? []).reduce(
                    (sum, item) => sum + item.quantity * item.unitPrice,
                    0,
                  ),
                )}
              </dd>
            </div>
            <div>
              <dt>其他费用</dt>
              <dd>{money(draft.otherFee ?? 0)}</dd>
            </div>
            <div>
              <dt>订单总额</dt>
              <dd>{money(draft.contractAmount)}</dd>
            </div>
          </dl>
        </div>
        <label>
          订单备注
          <textarea
            rows={5}
            value={draft.note ?? ""}
            onChange={(event) =>
              setDraft({ ...draft, note: event.target.value })
            }
          />
        </label>
        <div>
          <h3>客户签名</h3>
          {draft.signatureFiles?.[0]?.dataUrl ? (
            <img src={draft.signatureFiles[0].dataUrl} alt="客户电子签名" />
          ) : (
            <p>尚未签名</p>
          )}
        </div>
      </section>
      <footer className="fulfillment-actions">
        <span>
          {saved
            ? "订单修改已保存"
            : "库存预留、发货、退换货都会记录库存流水。"}
        </span>
        <div>
          <button type="button" onClick={onReturn}>
            退货
          </button>
          <button type="button" onClick={onExchange}>
            换货
          </button>
          <button type="button" onClick={onAfterSales}>发起售后</button>
          <button type="button" onClick={onCollectBalance}>
            收尾款
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={draft.status === "已取消"}
          >
            取消订单
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={onArrangeDelivery}
          >
            安排发货
          </button>
          <button className="primary-button" type="button" onClick={submit}>
            <Save />
            保存更新订单
          </button>
        </div>
      </footer>
    </section>
  );
}
