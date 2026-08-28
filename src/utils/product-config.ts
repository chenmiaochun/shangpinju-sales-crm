import type {
  ConfigProduct,
  ConfigProductComponent,
  OrderSkuLine,
  PackageOrderItem,
  ProductComponent,
  ProductPackage,
  SkuUnit,
  SupplyType,
} from "../types";

// 规格值 → 代码串：去除空白/标点并转大写，保留字母数字（含中文）。
// 说明：文档示例 CTM-1.8M-HZW 中的 HZW 为手工设定的拼音缩写代码；
// 系统建最小单位时可直接传入短代码作为 specValues，保证 SKU 可读、可扩展。
export function slugifyValue(value: string): string {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}.]/gu, "").toUpperCase();
}

// 最小单位 SKU：主件码 + 按规格维度顺序拼接规格值代码
export function buildSkuCode(
  componentCode: string,
  specValues: Record<string, string>,
  dimOrder: string[] = Object.keys(specValues),
): string {
  const parts = dimOrder
    .map((dim) => slugifyValue(specValues[dim] ?? ""))
    .filter(Boolean);
  return [componentCode, ...parts].join("-");
}

// 单品编码：SP-大类码-序号（序号取现有最大+1，保证唯一）
export function generateConfigProductCode(
  categoryCode: string,
  existingCodes: string[],
): string {
  const prefix = `SP-${categoryCode}-`;
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// 套餐编码：TC-序号
export function generatePackageCode(existingCodes: string[]): string {
  const prefix = "TC-";
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const n = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// 按 componentId + specValues 精确匹配最小单位
export function findSkuUnit(
  skuUnits: SkuUnit[],
  componentId: string,
  specValues: Record<string, string>,
): SkuUnit | undefined {
  return skuUnits.find(
    (u) => u.componentId === componentId && sameSpecValues(u.specValues, specValues),
  );
}

function sameSpecValues(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if ((a[k] ?? "") !== (b[k] ?? "")) return false;
  }
  return true;
}

// 单品标准价 = Σ(主件单价 × 数量) + 增减价（可选主件未选则不计入）
export function configProductPrice(
  product: ConfigProduct,
  skuUnits: SkuUnit[],
  selections: Record<string, Record<string, string>> = {},
): number {
  let total = 0;
  for (const comp of product.components) {
    if (comp.optional && !(comp.componentId in selections)) continue;
    const sel = selections[comp.componentId] ?? comp.locked ?? {};
    const unit = findSkuUnit(skuUnits, comp.componentId, sel);
    if (unit) total += unit.unitPrice * comp.quantity;
  }
  return total + product.adjustPrice;
}

export interface ExpandedUnit {
  skuUnit: SkuUnit;
  quantity: number;
  optional: boolean;
}

// 展开单品为最小单位明细（开单扣减用）。
// 可选主件未选则跳过；含「定制生产」主件也会列出，由调用方判断是否转生产需求单。
export function expandConfigProduct(
  product: ConfigProduct,
  skuUnits: SkuUnit[],
  selections: Record<string, Record<string, string>> = {},
): ExpandedUnit[] {
  const result: ExpandedUnit[] = [];
  for (const comp of product.components) {
    if (comp.optional && !(comp.componentId in selections)) continue;
    const sel = selections[comp.componentId] ?? comp.locked ?? {};
    const unit = findSkuUnit(skuUnits, comp.componentId, sel);
    if (unit) result.push({ skuUnit: unit, quantity: comp.quantity, optional: comp.optional });
  }
  return result;
}

// 套餐价 = Σ(单品标准价 × 数量) + 套餐增减价
// picks.included === false 的单品（可选未勾选）不计入。
export function packagePrice(
  pkg: ProductPackage,
  configProducts: ConfigProduct[],
  skuUnits: SkuUnit[],
  picks: Record<
    string,
    {
      selections?: Record<string, Record<string, string>>;
      quantity?: number;
      included?: boolean;
    }
  > = {},
): number {
  let total = 0;
  for (const item of pkg.items) {
    const pick = picks[item.productId] ?? {};
    if (pick.included === false) continue;
    const product = configProducts.find((p) => p.id === item.productId);
    if (!product) continue;
    const quantity = pick.quantity ?? item.quantity;
    const price = configProductPrice(product, skuUnits, pick.selections ?? {});
    total += price * quantity;
  }
  return total + pkg.adjustPrice;
}

// 按「主件 + 锁定/开放规格约束」匹配最小单位集合。
// locked[dim] 存在且非空 → 该维度必须等于该值；allowed[dim] 非空数组 → 该维度取值必须落在数组内；
// 两者皆未约束的维度允许任意取值。
export function matchingSkuUnits(
  skuUnits: SkuUnit[],
  componentId: string,
  locked?: Record<string, string>,
  allowed?: Record<string, string[]>,
): SkuUnit[] {
  return skuUnits.filter((u) => {
    if (u.componentId !== componentId) return false;
    for (const [dim, val] of Object.entries(u.specValues)) {
      const lockedVal = locked?.[dim];
      if (lockedVal != null && lockedVal !== "" && lockedVal !== val) return false;
      const allow = allowed?.[dim];
      if (allow && allow.length > 0 && !allow.includes(val)) return false;
    }
    return true;
  });
}

export interface PriceRange {
  min: number;
  max: number;
  exact: boolean; // 价格唯一确定（无开放维度且所有主件均已定价）
  unresolved: string[]; // 未能解析到最小单位的 componentId 列表
}

// 单品标准价区间：每个主件按其约束匹配最小单位，取最小/最大单价 × 数量；
// 含开放维度的主件会产生区间；无匹配最小单位的计入 unresolved。
// 与 configProductPrice 一致：可选主件（如转盘）不计入基础价，需客户勾选才计入。
export function configProductPriceRange(
  product: ConfigProduct,
  skuUnits: SkuUnit[],
): PriceRange {
  let min = 0;
  let max = 0;
  const unresolved: string[] = [];
  for (const comp of product.components) {
    if (comp.optional) continue;
    const units = matchingSkuUnits(
      skuUnits,
      comp.componentId,
      comp.locked,
      comp.allowed,
    );
    if (units.length === 0) {
      unresolved.push(comp.componentId);
      continue;
    }
    const prices = units.map((u) => u.unitPrice * comp.quantity);
    min += Math.min(...prices);
    max += Math.max(...prices);
  }
  min += product.adjustPrice;
  max += product.adjustPrice;
  return {
    min,
    max,
    exact: min === max && unresolved.length === 0,
    unresolved,
  };
}

// 套餐价区间：对每个单品取价区间 × 数量后累加。
export function packagePriceRange(
  pkg: ProductPackage,
  configProducts: ConfigProduct[],
  skuUnits: SkuUnit[],
): PriceRange {
  let min = 0;
  let max = 0;
  const unresolved: string[] = [];
  for (const item of pkg.items) {
    const product = configProducts.find((p) => p.id === item.productId);
    if (!product) {
      unresolved.push(item.productId);
      continue;
    }
    const r = configProductPriceRange(product, skuUnits);
    if (!r.exact) unresolved.push(item.productId);
    min += r.min * item.quantity;
    max += r.max * item.quantity;
  }
  min += pkg.adjustPrice;
  max += pkg.adjustPrice;
  return {
    min,
    max,
    exact: min === max && unresolved.length === 0,
    unresolved,
  };
}

// 编码唯一化：若 base 已存在，追加 -2 / -3 … 直到唯一。
export function ensureUniqueCode(base: string, existingCodes: string[]): string {
  if (!existingCodes.includes(base)) return base;
  let i = 2;
  while (existingCodes.includes(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

// ---------- Phase 3：销售开单联动 ----------

// 规格值字典 → 可读摘要："尺寸:1.8m / 材质:黑胡桃"
export function specSummary(specValues: Record<string, string>): string {
  return Object.entries(specValues)
    .filter(([, value]) => value)
    .map(([dim, value]) => `${dim}:${value}`)
    .join(" / ");
}

// 主件在某单品模板约束下的在售候选 SKU（按锁定/开放约束过滤，剔除下架）
export function componentSkuOptions(
  skuUnits: SkuUnit[],
  comp: ConfigProductComponent,
): SkuUnit[] {
  return matchingSkuUnits(skuUnits, comp.componentId, comp.locked, comp.allowed)
    .filter((u) => u.status === "上架");
}

// 展开单品为订单明细快照（开单用）。可选主件需出现在 selections 中才计入；
// 找不到匹配最小单位的主件计入 unresolved（调用方提示"规格未配齐"）。
// 返回的行不含成本价——员工端数据安全。
export function buildOrderSkuLines(
  product: ConfigProduct,
  components: ProductComponent[],
  skuUnits: SkuUnit[],
  selections: Record<string, Record<string, string>> = {},
): { lines: OrderSkuLine[]; unresolved: string[] } {
  const lines: OrderSkuLine[] = [];
  const unresolved: string[] = [];
  for (const comp of product.components) {
    if (comp.optional && !(comp.componentId in selections)) continue;
    const sel = selections[comp.componentId] ?? comp.locked ?? {};
    const unit = findSkuUnit(skuUnits, comp.componentId, sel);
    if (!unit) {
      unresolved.push(comp.componentId);
      continue;
    }
    const componentName =
      components.find((c) => c.id === comp.componentId)?.name ?? comp.componentId;
    lines.push({
      skuUnitId: unit.id,
      sku: unit.sku,
      componentId: comp.componentId,
      componentName,
      specSummary: specSummary(unit.specValues),
      quantity: comp.quantity,
      unitPrice: unit.unitPrice,
      supplyType: unit.supplyType,
      optional: comp.optional,
      material: unit.specValues["材质"] ?? unit.specValues["材料"],
    });
  }
  return { lines, unresolved };
}

export interface ConfigProductAvailability {
  stock: number; // 现货可售套数（必选现货主件的最小可用量；无现货约束时为 Infinity）
  hasCustom: boolean; // 含定制生产主件
  hasPurchase: boolean; // 含外采主件
  missingSku: boolean; // 有必选主件配不到在售最小单位
}

export function availableCount(u: SkuUnit): number {
  return Math.max(0, u.availableStock - (u.reservedStock ?? 0));
}

// 单品可售情况：按各必选主件的在售候选 SKU 汇总。
// 现货套数 = min(各必选主件 best 可用量)；定制/外采主件不限量（可接单后生产/采购）。
export function configProductAvailability(
  product: ConfigProduct,
  skuUnits: SkuUnit[],
): ConfigProductAvailability {
  let stock = Infinity;
  let hasCustom = false;
  let hasPurchase = false;
  let missingSku = false;
  for (const comp of product.components) {
    if (comp.optional) continue;
    const options = componentSkuOptions(skuUnits, comp);
    if (options.length === 0) {
      missingSku = true;
      continue;
    }
    const stockOptions = options.filter((u) =>
      ["现货", "展厅样品"].includes(u.supplyType),
    );
    if (stockOptions.length > 0) {
      const best = Math.max(...stockOptions.map(availableCount));
      stock = Math.min(stock, best);
    } else {
      if (options.some((u) => u.supplyType === "定制生产")) hasCustom = true;
      if (options.some((u) => u.supplyType === "外采产品")) hasPurchase = true;
    }
  }
  return { stock: stock === Infinity ? Number.MAX_SAFE_INTEGER : stock, hasCustom, hasPurchase, missingSku };
}

// 汇总单品行的整体供应类型：定制生产 > 外采产品 > 展厅样品 > 现货
export function aggregateSupplyType(lines: OrderSkuLine[]): SupplyType {
  if (lines.some((l) => l.supplyType === "定制生产")) return "定制生产";
  if (lines.some((l) => l.supplyType === "外采产品")) return "外采产品";
  if (lines.some((l) => l.supplyType === "展厅样品")) return "展厅样品";
  return "现货";
}

// 单品行规格摘要（购物车显示用）：取前两个已选主件的规格，过长省略
export function summarizeSkuLines(lines: OrderSkuLine[], max = 2): string {
  if (!lines.length) return "";
  const parts = lines.slice(0, max).map((l) => `${l.componentName} ${l.specSummary}`);
  const suffix = lines.length > max ? ` 等 ${lines.length} 项` : "";
  return parts.join("；") + suffix;
}

// ---------- Phase 4.2：套餐开单联动 ----------

// 套餐内某单品的选配：是否勾选（optional 项）、数量、单品内各主件规格
export interface PackagePick {
  included?: boolean;
  quantity?: number;
  selections?: Record<string, Record<string, string>>;
}

export type PackagePicks = Record<string, PackagePick>; // key = productId

// 展开套餐选配为订单快照：
// - packageItems：按单品分组（打印分组展示用），skuLines 为单套组件快照
// - skuLines：平铺到订单行顶层，quantity 已乘单品数量——
//   订单行 quantity 表示套餐套数，planSkuDemands 按现逻辑再乘套数即可，
//   履约模块无需感知套餐存在
// - unresolved：引用缺失或必选主件配不到在售规格的单品
export function buildPackageOrderItems(
  pkg: ProductPackage,
  configProducts: ConfigProduct[],
  components: ProductComponent[],
  skuUnits: SkuUnit[],
  picks: PackagePicks = {},
): {
  packageItems: PackageOrderItem[];
  skuLines: OrderSkuLine[];
  unresolved: string[];
} {
  const packageItems: PackageOrderItem[] = [];
  const skuLines: OrderSkuLine[] = [];
  const unresolved: string[] = [];
  for (const item of pkg.items) {
    const product = configProducts.find((p) => p.id === item.productId);
    if (!product) {
      unresolved.push(item.productId);
      continue;
    }
    const pick = picks[item.productId] ?? {};
    const included = item.optional ? pick.included === true : true;
    if (!included) continue;
    const quantity = pick.quantity ?? item.quantity;
    const selections = pick.selections ?? {};
    const built = buildOrderSkuLines(product, components, skuUnits, selections);
    if (built.unresolved.length) {
      unresolved.push(item.productId);
      continue;
    }
    packageItems.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity,
      selections,
      unitPrice: configProductPrice(product, skuUnits, selections),
      skuLines: built.lines,
    });
    // 平铺：单套用量 × 单品数量
    for (const line of built.lines) {
      skuLines.push({ ...line, quantity: line.quantity * quantity });
    }
  }
  return { packageItems, skuLines, unresolved };
}

// 套餐行规格摘要（购物车显示用）：每个单品「名称×数量」，取前两组，过长省略
export function summarizePackagePicks(items: PackageOrderItem[], max = 2): string {
  if (!items.length) return "";
  const parts = items
    .slice(0, max)
    .map((i) => `${i.productName}×${i.quantity}`);
  const suffix = items.length > max ? ` 等 ${items.length} 件单品` : "";
  return parts.join("；") + suffix;
}

// 套餐可售情况：各单品 availability 聚合（现货套数取最小，任一缺规格即 missing）
export function packageAvailability(
  pkg: ProductPackage,
  configProducts: ConfigProduct[],
  skuUnits: SkuUnit[],
): ConfigProductAvailability {
  let stock = Infinity;
  let hasCustom = false;
  let hasPurchase = false;
  let missingSku = false;
  for (const item of pkg.items) {
    const product = configProducts.find((p) => p.id === item.productId);
    if (!product) {
      missingSku = true;
      continue;
    }
    const avail = configProductAvailability(product, skuUnits);
    if (avail.missingSku) missingSku = true;
    if (avail.hasCustom) hasCustom = true;
    if (avail.hasPurchase) hasPurchase = true;
    stock = Math.min(stock, avail.stock);
  }
  return {
    stock: stock === Infinity ? Number.MAX_SAFE_INTEGER : stock,
    hasCustom,
    hasPurchase,
    missingSku,
  };
}
