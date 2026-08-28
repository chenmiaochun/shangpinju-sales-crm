import { describe, it, expect } from "vitest";
import type {
  ConfigProduct,
  ProductComponent,
  ProductPackage,
  SkuUnit,
} from "../types";
import {
  aggregateSupplyType,
  buildOrderSkuLines,
  buildPackageOrderItems,
  buildSkuCode,
  componentSkuOptions,
  configProductAvailability,
  configProductPrice,
  configProductPriceRange,
  ensureUniqueCode,
  expandConfigProduct,
  findSkuUnit,
  generateConfigProductCode,
  generatePackageCode,
  matchingSkuUnits,
  packageAvailability,
  packagePrice,
  packagePriceRange,
  slugifyValue,
  specSummary,
  summarizePackagePicks,
  summarizeSkuLines,
} from "./product-config";

const skuUnits: SkuUnit[] = [
  {
    id: "sku-ctm",
    componentId: "comp-ctm",
    sku: "CTM-1.8M-HZW",
    specValues: { 尺寸: "1.8m", 材质: "HZW" },
    unitPrice: 5000,
    costPrice: 3000,
    supplyType: "现货",
    availableStock: 10,
    reservedStock: 0,
    safetyStock: 2,
    status: "上架",
  },
  {
    id: "sku-ctj",
    componentId: "comp-ctj",
    sku: "CTJ-1.8M-ZJ-HZW",
    specValues: { 尺寸: "1.8m", 款式: "ZJ", 材质: "HZW" },
    unitPrice: 2000,
    costPrice: 1200,
    supplyType: "现货",
    availableStock: 8,
    reservedStock: 0,
    safetyStock: 2,
    status: "上架",
  },
  {
    id: "sku-zp",
    componentId: "comp-zp",
    sku: "ZP-1.2M-YSB",
    specValues: { 尺寸: "1.2m", 材质: "YSB" },
    unitPrice: 1500,
    costPrice: 800,
    supplyType: "现货",
    availableStock: 5,
    reservedStock: 0,
    safetyStock: 1,
    status: "上架",
  },
  {
    id: "sku-chair",
    componentId: "comp-chair",
    sku: "CHA-STD",
    specValues: {},
    unitPrice: 800,
    costPrice: 400,
    supplyType: "现货",
    availableStock: 20,
    reservedStock: 0,
    safetyStock: 4,
    status: "上架",
  },
];

const tableProduct: ConfigProduct = {
  id: "prod-table",
  categoryId: "cat-ct",
  name: "1.8m 黑胡桃圆餐桌",
  code: "SP-CT-001",
  sortOrder: 1,
  components: [
    {
      componentId: "comp-ctm",
      quantity: 1,
      optional: false,
      locked: { 尺寸: "1.8m", 材质: "HZW" },
    },
    {
      componentId: "comp-ctj",
      quantity: 1,
      optional: false,
      locked: { 尺寸: "1.8m", 款式: "ZJ", 材质: "HZW" },
    },
    { componentId: "comp-zp", quantity: 1, optional: true },
  ],
  adjustPrice: -200,
  status: "上架",
};

const chairProduct: ConfigProduct = {
  id: "prod-chair",
  categoryId: "cat-ct",
  name: "餐椅",
  code: "SP-CT-002",
  sortOrder: 2,
  components: [{ componentId: "comp-chair", quantity: 1, optional: false }],
  adjustPrice: 0,
  status: "上架",
};

const components: ProductComponent[] = [
  {
    id: "comp-ctm",
    categoryId: "cat-ct",
    code: "CTM",
    name: "台面",
    sort: 1,
    specDims: [{ id: "d1", name: "尺寸", values: ["1.8m"] }],
  },
  {
    id: "comp-ctj",
    categoryId: "cat-ct",
    code: "CTJ",
    name: "台脚",
    sort: 2,
    specDims: [{ id: "d2", name: "尺寸", values: ["1.8m"] }],
  },
  {
    id: "comp-zp",
    categoryId: "cat-ct",
    code: "ZP",
    name: "转盘",
    sort: 3,
    specDims: [{ id: "d3", name: "尺寸", values: ["1.2m"] }],
  },
];

// 定制主件（不扣库存，开单转生产需求单）
const customSkuUnits: SkuUnit[] = [
  {
    id: "sku-ctm-custom",
    componentId: "comp-ctm",
    sku: "CTM-2.0M-KEZHI",
    specValues: { 尺寸: "2.0m", 材质: "定制" },
    unitPrice: 6800,
    costPrice: 4200,
    supplyType: "定制生产",
    availableStock: 0,
    reservedStock: 0,
    safetyStock: 0,
    status: "上架",
  },
];

// 仅含定制主件的单品（台面锁定为定制规格）
const customOnlyProduct: ConfigProduct = {
  id: "prod-custom",
  categoryId: "cat-ct",
  name: "2.0m 定制台面餐桌",
  code: "SP-CT-003",
  sortOrder: 3,
  components: [
    {
      componentId: "comp-ctm",
      quantity: 1,
      optional: false,
      locked: { 尺寸: "2.0m", 材质: "定制" },
    },
  ],
  adjustPrice: 0,
  status: "上架",
};

const diningPackage: ProductPackage = {
  id: "pkg-dining",
  name: "餐厅套系",
  code: "TC-001",
  sortOrder: 1,
  items: [
    { productId: "prod-table", quantity: 1 },
    { productId: "prod-chair", quantity: 4, quantityOptions: [4, 6] },
  ],
  adjustPrice: -500,
  status: "上架",
};

describe("slugifyValue / buildSkuCode", () => {
  it("slugifies spec values", () => {
    expect(slugifyValue("1.8m")).toBe("1.8M");
    expect(slugifyValue("黑胡桃")).toBe("黑胡桃");
  });
  it("builds sku code from component code + dims", () => {
    expect(
      buildSkuCode("CTM", { 尺寸: "1.8m", 材质: "HZW" }, ["尺寸", "材质"]),
    ).toBe("CTM-1.8M-HZW");
    expect(
      buildSkuCode("CTJ", { 尺寸: "1.8m", 款式: "ZJ", 材质: "HZW" }, [
        "尺寸",
        "款式",
        "材质",
      ]),
    ).toBe("CTJ-1.8M-ZJ-HZW");
  });
});

describe("generateConfigProductCode / generatePackageCode", () => {
  it("increments config product seq", () => {
    expect(generateConfigProductCode("CT", ["SP-CT-001", "SP-CT-002"])).toBe(
      "SP-CT-003",
    );
    expect(generateConfigProductCode("SF", [])).toBe("SP-SF-001");
  });
  it("increments package seq", () => {
    expect(generatePackageCode(["TC-001", "TC-005"])).toBe("TC-006");
    expect(generatePackageCode([])).toBe("TC-001");
  });
});

describe("findSkuUnit", () => {
  it("matches by component + spec values", () => {
    const found = findSkuUnit(skuUnits, "comp-ctm", { 尺寸: "1.8m", 材质: "HZW" });
    expect(found?.id).toBe("sku-ctm");
    expect(findSkuUnit(skuUnits, "comp-ctm", { 尺寸: "1.6m" })).toBeUndefined();
  });
});

describe("configProductPrice", () => {
  it("sums locked components + adjustPrice (optional unselected excluded)", () => {
    // 5000 + 2000 - 200 = 6800
    expect(configProductPrice(tableProduct, skuUnits)).toBe(6800);
  });
  it("includes selected optional component", () => {
    // 6800 + 1500 = 8300
    expect(
      configProductPrice(tableProduct, skuUnits, {
        "comp-zp": { 尺寸: "1.2m", 材质: "YSB" },
      }),
    ).toBe(8300);
  });
});

describe("expandConfigProduct", () => {
  it("expands non-optional only when optional unselected", () => {
    const expanded = expandConfigProduct(tableProduct, skuUnits);
    expect(expanded.map((e) => e.skuUnit.id)).toEqual(["sku-ctm", "sku-ctj"]);
  });
  it("expands optional when selected", () => {
    const expanded = expandConfigProduct(tableProduct, skuUnits, {
      "comp-zp": { 尺寸: "1.2m", 材质: "YSB" },
    });
    expect(expanded.map((e) => e.skuUnit.id)).toEqual([
      "sku-ctm",
      "sku-ctj",
      "sku-zp",
    ]);
    expect(expanded.find((e) => e.skuUnit.id === "sku-zp")?.optional).toBe(true);
  });
});

describe("packagePrice", () => {
  it("sums product prices by quantity + package adjust", () => {
    // table 6800*1 + chair 800*4 - 500 = 9500
    const total = packagePrice(
      diningPackage,
      [tableProduct, chairProduct],
      skuUnits,
    );
    expect(total).toBe(9500);
  });
  it("respects per-item quantity picks", () => {
    // table 6800 + chair 800*6 - 500 = 11100
    const total = packagePrice(
      diningPackage,
      [tableProduct, chairProduct],
      skuUnits,
      { "prod-chair": { quantity: 6 } },
    );
    expect(total).toBe(11100);
  });
  it("excludes items not included in picks", () => {
    // 未勾选餐椅：6800 - 500 = 6300
    const total = packagePrice(
      diningPackage,
      [tableProduct, chairProduct],
      skuUnits,
      { "prod-chair": { included: false } },
    );
    expect(total).toBe(6300);
  });
});

describe("matchingSkuUnits", () => {
  it("matches by locked + allowed constraints", () => {
    // 仅 1.8m 黑胡桃 的台面
    const locked = matchingSkuUnits(skuUnits, "comp-ctm", { 尺寸: "1.8m", 材质: "HZW" });
    expect(locked.map((u) => u.id)).toEqual(["sku-ctm"]);
    // 开放材质为 HZW 时，只应匹配 HZW 款
    const allowed = matchingSkuUnits(skuUnits, "comp-ctm", { 尺寸: "1.8m" }, { 材质: ["HZW"] });
    expect(allowed.map((u) => u.id)).toEqual(["sku-ctm"]);
    // 未约束任何维度 → 全部主件命中
    expect(matchingSkuUnits(skuUnits, "comp-ctm")).toHaveLength(1);
  });
});

describe("configProductPriceRange", () => {
  it("returns exact price when all components locked", () => {
    const r = configProductPriceRange(tableProduct, skuUnits);
    expect(r.exact).toBe(true);
    expect(r.min).toBe(6800);
    expect(r.max).toBe(6800);
    expect(r.unresolved).toHaveLength(0);
  });
  it("returns a range when a component has open specs", () => {
    const open: ConfigProduct = {
      ...tableProduct,
      components: [
        {
          componentId: "comp-ctm",
          quantity: 1,
          optional: false,
          locked: { 尺寸: "1.8m" },
          allowed: { 材质: ["HZW"] },
        },
      ],
    };
    const r = configProductPriceRange(open, skuUnits);
    expect(r.exact).toBe(true);
    expect(r.min).toBe(r.max);
    const missing = configProductPriceRange(
      { ...tableProduct, components: [{ componentId: "comp-missing", quantity: 1, optional: false }] },
      skuUnits,
    );
    expect(missing.unresolved).toContain("comp-missing");
    expect(missing.exact).toBe(false);
  });
});

describe("packagePriceRange", () => {
  it("sums item ranges by quantity", () => {
    const r = packagePriceRange(diningPackage, [tableProduct, chairProduct], skuUnits);
    expect(r.exact).toBe(true);
    expect(r.min).toBe(9500);
    expect(r.max).toBe(9500);
  });
});

describe("ensureUniqueCode", () => {
  it("keeps code when free, appends suffix on collision", () => {
    expect(ensureUniqueCode("SP-CT-001", ["SP-CT-001"])).toBe("SP-CT-001-2");
    expect(ensureUniqueCode("SP-CT-001", ["SP-CT-001", "SP-CT-001-2"])).toBe("SP-CT-001-3");
    expect(ensureUniqueCode("TC-001", [])).toBe("TC-001");
  });
});

// ---------- Phase 3：销售开单联动 ----------

describe("specSummary", () => {
  it("joins non-empty spec values with dim labels", () => {
    expect(specSummary({ 尺寸: "1.8m", 材质: "黑胡桃" })).toBe("尺寸:1.8m / 材质:黑胡桃");
    expect(specSummary({ 尺寸: "1.8m", 材质: "" })).toBe("尺寸:1.8m");
  });
});

describe("componentSkuOptions", () => {
  it("filters by locked/allowed constraints and on-sale status", () => {
    const all = [...skuUnits, ...customSkuUnits];
    // 台面锁定现货规格（1.8m/HZW）→ 只匹配现货 SKU
    expect(componentSkuOptions(all, tableProduct.components[0])).toHaveLength(1);
    // 台面锁定定制规格（2.0m/定制）→ 只匹配定制 SKU
    expect(componentSkuOptions(all, customOnlyProduct.components[0])).toHaveLength(1);
    // 定制 SKU 下架后 → 无在售选项
    const offShelf = all.map((u) => (u.id === "sku-ctm-custom" ? { ...u, status: "下架" as const } : u));
    expect(componentSkuOptions(offShelf, customOnlyProduct.components[0])).toHaveLength(0);
  });
});

describe("buildOrderSkuLines", () => {
  it("expands required components and skips unselected optional ones", () => {
    const { lines, unresolved } = buildOrderSkuLines(tableProduct, components, skuUnits);
    expect(unresolved).toEqual([]);
    expect(lines.map((l) => l.componentName)).toEqual(["台面", "台脚"]);
    expect(lines[0]).toMatchObject({
      skuUnitId: "sku-ctm",
      sku: "CTM-1.8M-HZW",
      quantity: 1,
      unitPrice: 5000,
      supplyType: "现货",
      optional: false,
    });
    expect(lines.every((l) => !("costPrice" in l))).toBe(true);
  });

  it("includes optional component when picked in selections", () => {
    const { lines } = buildOrderSkuLines(tableProduct, components, skuUnits, {
      "comp-zp": { 尺寸: "1.2m", 材质: "YSB" },
    });
    expect(lines.map((l) => l.componentName)).toEqual(["台面", "台脚", "转盘"]);
    expect(lines[2].optional).toBe(true);
  });

  it("records unresolved when no sku matches the selection", () => {
    const { lines, unresolved } = buildOrderSkuLines(tableProduct, components, skuUnits, {
      "comp-ctm": { 尺寸: "2.2m" },
    });
    expect(unresolved).toEqual(["comp-ctm"]);
    expect(lines.map((l) => l.componentName)).toEqual(["台脚"]);
  });

  it("carries custom supply type for made-to-order sku", () => {
    const { lines } = buildOrderSkuLines(tableProduct, components, customSkuUnits, {
      "comp-ctm": { 尺寸: "2.0m", 材质: "定制" },
    });
    expect(lines.find((l) => l.componentName === "台面")?.supplyType).toBe("定制生产");
  });
});

describe("configProductAvailability", () => {
  it("takes min stock across required in-stock components", () => {
    const avail = configProductAvailability(tableProduct, skuUnits);
    expect(avail.stock).toBe(Math.min(10, 8));
    expect(avail.hasCustom).toBe(false);
    expect(avail.missingSku).toBe(false);
  });

  it("flags custom / purchase / missing when no stockable options", () => {
    const avail = configProductAvailability(customOnlyProduct, customSkuUnits);
    expect(avail.hasCustom).toBe(true);
    expect(avail.stock).toBe(Number.MAX_SAFE_INTEGER); // 定制不限可售套数
    // 台面锁定现货规格但库存表里只有另一规格 → 配不到在售最小单位
    const mismatch = configProductAvailability(
      { ...customOnlyProduct, components: [{ ...customOnlyProduct.components[0], locked: { 尺寸: "2.4m" } }] },
      customSkuUnits,
    );
    expect(mismatch.missingSku).toBe(true);
  });
});

describe("aggregateSupplyType", () => {
  it("prefers custom > purchase > sample > stock", () => {
    const line = (supplyType: SkuUnit["supplyType"]) => ({
      skuUnitId: "x",
      sku: "x",
      componentId: "c",
      componentName: "c",
      specSummary: "",
      quantity: 1,
      unitPrice: 0,
      supplyType,
      optional: false,
    });
    expect(aggregateSupplyType([line("现货"), line("定制生产")])).toBe("定制生产");
    expect(aggregateSupplyType([line("现货"), line("外采产品")])).toBe("外采产品");
    expect(aggregateSupplyType([line("现货"), line("展厅样品")])).toBe("展厅样品");
    expect(aggregateSupplyType([line("现货")])).toBe("现货");
  });
});

describe("summarizeSkuLines", () => {
  it("joins first two component summaries with ellipsis suffix", () => {
    const { lines } = buildOrderSkuLines(tableProduct, components, skuUnits, {
      "comp-zp": { 尺寸: "1.2m", 材质: "YSB" },
    });
    const text = summarizeSkuLines(lines);
    expect(text).toContain("台面");
    expect(text).toContain("等 3 项");
  });
});

// ---------- Phase 4.2：套餐开单联动 ----------

describe("buildPackageOrderItems", () => {
  it("flattens sku lines with quantity = per-set usage × product quantity", () => {
    const { packageItems, skuLines, unresolved } = buildPackageOrderItems(
      diningPackage,
      [tableProduct, chairProduct],
      components,
      skuUnits,
    );
    expect(unresolved).toEqual([]);
    expect(packageItems).toHaveLength(2);
    expect(packageItems[0]).toMatchObject({
      productId: "prod-table",
      productCode: "SP-CT-001",
      quantity: 1,
      unitPrice: 6800,
    });
    expect(packageItems[1]).toMatchObject({
      productId: "prod-chair",
      quantity: 4,
      unitPrice: 800,
    });
    // 平铺：椅身 = 单套用量 1 × 餐椅数量 4；packageItems 内保持单套快照
    const chairLine = skuLines.find((l) => l.skuUnitId === "sku-chair");
    expect(chairLine?.quantity).toBe(4);
    expect(packageItems[1].skuLines[0].quantity).toBe(1);
    // 数据安全：行快照不含成本价
    expect(skuLines.every((l) => !("costPrice" in l))).toBe(true);
  });

  it("applies quantity picks to both group snapshot and flattened lines", () => {
    const { packageItems, skuLines } = buildPackageOrderItems(
      diningPackage,
      [tableProduct, chairProduct],
      components,
      skuUnits,
      { "prod-chair": { quantity: 6 } },
    );
    expect(packageItems.find((p) => p.productId === "prod-chair")?.quantity).toBe(6);
    expect(skuLines.find((l) => l.skuUnitId === "sku-chair")?.quantity).toBe(6);
  });

  it("skips optional items when not included in picks", () => {
    const optionalPkg: ProductPackage = {
      ...diningPackage,
      items: [
        { productId: "prod-table", quantity: 1 },
        { productId: "prod-chair", quantity: 4, optional: true },
      ],
    };
    const { packageItems, skuLines, unresolved } = buildPackageOrderItems(
      optionalPkg,
      [tableProduct, chairProduct],
      components,
      skuUnits,
      { "prod-chair": { included: false } },
    );
    expect(unresolved).toEqual([]);
    expect(packageItems.map((p) => p.productId)).toEqual(["prod-table"]);
    expect(skuLines.every((l) => l.skuUnitId !== "sku-chair")).toBe(true);
  });

  it("records unresolved for dangling product refs and unmatched required specs", () => {
    // 套餐引用了不存在的单品
    const dangling: ProductPackage = {
      ...diningPackage,
      items: [{ productId: "prod-gone", quantity: 1 }],
    };
    const r1 = buildPackageOrderItems(dangling, [tableProduct], components, skuUnits);
    expect(r1.unresolved).toEqual(["prod-gone"]);
    expect(r1.skuLines).toHaveLength(0);
    expect(r1.packageItems).toHaveLength(0);
    // 必选主件被选成无匹配规格
    const r2 = buildPackageOrderItems(
      diningPackage,
      [tableProduct, chairProduct],
      components,
      skuUnits,
      { "prod-table": { selections: { "comp-ctm": { 尺寸: "2.2m" } } } },
    );
    expect(r2.unresolved).toContain("prod-table");
    expect(r2.packageItems.map((p) => p.productId)).toEqual(["prod-chair"]);
  });
});

describe("packageAvailability", () => {
  it("takes min stock across member products", () => {
    const avail = packageAvailability(
      diningPackage,
      [tableProduct, chairProduct],
      skuUnits,
    );
    // 餐桌单品 min(10, 8) = 8；餐椅 20 → 套餐取最小 8
    expect(avail.stock).toBe(8);
    expect(avail.missingSku).toBe(false);
    expect(avail.hasCustom).toBe(false);
  });

  it("flags custom members and dangling references", () => {
    const withCustom = packageAvailability(
      { ...diningPackage, items: [{ productId: "prod-custom", quantity: 1 }] },
      [customOnlyProduct],
      customSkuUnits,
    );
    expect(withCustom.hasCustom).toBe(true);
    expect(withCustom.stock).toBe(Number.MAX_SAFE_INTEGER);
    const dangling = packageAvailability(
      { ...diningPackage, items: [{ productId: "prod-gone", quantity: 1 }] },
      [],
      skuUnits,
    );
    expect(dangling.missingSku).toBe(true);
  });
});

describe("summarizePackagePicks", () => {
  it("joins product names with quantities and ellipsis suffix", () => {
    const { packageItems } = buildPackageOrderItems(
      diningPackage,
      [tableProduct, chairProduct],
      components,
      skuUnits,
    );
    expect(summarizePackagePicks(packageItems)).toBe("1.8m 黑胡桃圆餐桌×1；餐椅×4");
    expect(summarizePackagePicks([...packageItems, packageItems[1]])).toContain(
      "等 3 件单品",
    );
  });
});

