import { describe, it, expect } from "vitest";
import type { OrderItem, OrderSkuLine, SalesOrder } from "../types";
import { planSkuDemands } from "./order-fulfillment";

const skuLine = (overrides: Partial<OrderSkuLine>): OrderSkuLine => ({
  skuUnitId: "sku-1",
  sku: "CTM-1.8M-HZW",
  componentId: "comp-ctm",
  componentName: "台面",
  specSummary: "尺寸:1.8m / 材质:黑胡桃",
  quantity: 1,
  unitPrice: 5000,
  supplyType: "现货" as const,
  optional: false,
  ...overrides,
});

const item = (overrides: Partial<OrderItem>): OrderItem => ({
  id: "item-1",
  productName: "1.8m 黑胡桃圆餐桌",
  quantity: 2,
  unitPrice: 6800,
  supplyType: "现货",
  ...overrides,
});

const order = (items: OrderItem[]): SalesOrder => ({
  id: "order-1",
  orderNo: "NO.0000001",
  customerId: "c1",
  customerName: "陈女士",
  salesperson: "小林",
  collaborators: [],
  products: [],
  items,
  contractAmount: 13600,
  signedAt: "2026-08-26",
  status: "待审核",
  payments: [],
  performanceRate: 100,
  createdAt: "2026-08-26",
  updatedAt: "2026-08-26",
});

describe("planSkuDemands", () => {
  it("multiplies sku line quantity by order item quantity", () => {
    const plans = planSkuDemands(
      order([
        item({ skuLines: [skuLine({ quantity: 1 }), skuLine({ skuUnitId: "sku-2", sku: "CTJ-X", componentName: "台脚", quantity: 1 })] }),
      ]),
      { availableOf: () => 100 },
    );
    expect(plans).toHaveLength(2);
    expect(plans[0].demand.quantity).toBe(2); // 1 × 订单数量 2
    expect(plans[0].demand.productName).toBe("1.8m 黑胡桃圆餐桌 · 台面");
    expect(plans[0].demand.specification).toBe("尺寸:1.8m / 材质:黑胡桃");
  });

  it("locks stock for in-stock lines when availability covers the need", () => {
    const plans = planSkuDemands(
      order([item({ skuLines: [skuLine({})] })]),
      { availableOf: () => 5 },
    );
    expect(plans[0].demand.demandType).toBe("库存锁定");
    expect(plans[0].demand.status).toBe("已锁定");
    expect(plans[0].lockSkuUnitId).toBe("sku-1");
    expect(plans[0].lockQuantity).toBe(2);
  });

  it("falls back to pending when stock is insufficient", () => {
    const plans = planSkuDemands(
      order([item({ skuLines: [skuLine({})] })]),
      { availableOf: () => 1 },
    );
    expect(plans[0].demand.status).toBe("待处理");
    expect(plans[0].lockQuantity).toBe(2); // 计划仍会锁定（上层按 min 截断）
  });

  it("maps custom lines to production demands without locking stock", () => {
    const plans = planSkuDemands(
      order([
        item({
          supplyType: "定制生产",
          customRequirement: "桌面做圆角",
          skuLines: [skuLine({ supplyType: "定制生产", skuUnitId: "sku-c" })],
        }),
      ]),
      { availableOf: () => 0 },
    );
    expect(plans[0].demand.demandType).toBe("生产需求");
    expect(plans[0].demand.status).toBe("待处理");
    expect(plans[0].demand.productionProgress).toBe("资料待确认");
    expect(plans[0].demand.craftRequirement).toBe("桌面做圆角");
    expect(plans[0].lockSkuUnitId).toBe("");
    expect(plans[0].lockQuantity).toBe(0);
  });

  it("maps purchase lines to purchase demands", () => {
    const plans = planSkuDemands(
      order([item({ skuLines: [skuLine({ supplyType: "外采产品" })] })]),
      { availableOf: () => 0 },
    );
    expect(plans[0].demand.demandType).toBe("采购需求");
    expect(plans[0].lockSkuUnitId).toBe("");
  });

  it("skips legacy items without skuLines and aggregates same sku locks", () => {
    const plans = planSkuDemands(
      order([
        item({ id: "legacy", skuLines: undefined }),
        item({
          id: "cfg-1",
          skuLines: [skuLine({})],
        }),
        item({
          id: "cfg-2",
          skuLines: [skuLine({ skuUnitId: "sku-1", componentName: "台面(备用)" })],
        }),
      ]),
      { availableOf: () => 50 },
    );
    expect(plans).toHaveLength(2);
    const totalLock = plans
      .filter((p) => p.lockSkuUnitId === "sku-1")
      .reduce((sum, p) => sum + p.lockQuantity, 0);
    expect(totalLock).toBe(4); // 两行各锁 2
  });
});
