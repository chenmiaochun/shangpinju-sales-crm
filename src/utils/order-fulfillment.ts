import type { SalesOrder, SupplyDemand, SupplyType } from "../types";

// Phase 3：单品订单生效（审核通过）时的履约计划。
// 把订单明细中的 skuLines 快照展开为「最小单位级」供货需求：
// - 现货/展厅样品 → 生成库存/样品锁定需求，并锁定对应最小单位 reservedStock
// - 外采产品 → 采购需求（待处理）
// - 定制生产 → 生产需求单（待处理，不扣库存）
// 老商品行（无 skuLines）不走本模块，保持原有整行需求逻辑。

export interface SkuDemandPlan {
  demand: Omit<SupplyDemand, "orderId" | "orderNo" | "customerId" | "customerName" | "expectedAt" | "createdAt" | "updatedAt">;
  lockSkuUnitId: string; // 需要锁定库存的最小单位（仅现货/展厅样品）
  lockQuantity: number;
}

const DEMAND_PLAN: Record<SupplyType, { demandType: SupplyDemand["demandType"]; lockedStatus: SupplyDemand["status"] }> = {
  现货: { demandType: "库存锁定", lockedStatus: "已锁定" },
  展厅样品: { demandType: "样品锁定", lockedStatus: "已锁定" },
  外采产品: { demandType: "采购需求", lockedStatus: "待处理" },
  定制生产: { demandType: "生产需求", lockedStatus: "待处理" },
};

export interface SkuPlanContext {
  // skuUnitId → 当前可用量（availableStock - reservedStock）
  availableOf: (skuUnitId: string) => number;
}

// 展开单品订单的履约计划（纯函数，供 activateOrder 与单元测试使用）
export function planSkuDemands(
  order: Pick<SalesOrder, "id" | "items">,
  context: SkuPlanContext,
): SkuDemandPlan[] {
  const plans: SkuDemandPlan[] = [];
  for (const item of order.items ?? []) {
    if (!item.skuLines?.length) continue;
    for (let lineIndex = 0; lineIndex < item.skuLines.length; lineIndex += 1) {
      const line = item.skuLines[lineIndex];
      const quantity = line.quantity * item.quantity;
      const plan = DEMAND_PLAN[line.supplyType];
      const lockable = ["现货", "展厅样品"].includes(line.supplyType);
      const canLock = !lockable || context.availableOf(line.skuUnitId) >= quantity;
      plans.push({
        demand: {
          id: `supply-${order.id}-${item.id}-${lineIndex}`,
          orderItemId: item.id,
          productName: `${item.productName} · ${line.componentName}`,
          specification: line.specSummary,
          quantity,
          supplyType: line.supplyType,
          demandType: plan.demandType,
          status: canLock ? plan.lockedStatus : "待处理",
          skuUnitId: line.skuUnitId,
          sku: line.sku,
          componentName: line.componentName,
          woodMaterial: line.material,
          craftRequirement: item.customRequirement,
          productionProgress:
            line.supplyType === "定制生产" ? "资料待确认" : undefined,
        },
        lockSkuUnitId: lockable ? line.skuUnitId : "",
        lockQuantity: lockable ? quantity : 0,
      });
    }
  }
  return plans;
}
