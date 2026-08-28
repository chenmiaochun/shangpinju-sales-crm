import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  ConfigProduct,
  OrderItem,
  ProductComponent,
  ProductPackage,
  SkuUnit,
} from "../../types";
import {
  aggregateSupplyType,
  availableCount,
  buildPackageOrderItems,
  componentSkuOptions,
  configProductPrice,
  packagePrice,
  specSummary,
  summarizePackagePicks,
} from "../../utils/product-config";

const money = (value: number) =>
  `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Props = {
  pkg: ProductPackage;
  configProducts: ConfigProduct[];
  components: ProductComponent[];
  skuUnits: SkuUnit[];
  // 老板/采购/财务（cost.view）可见组件单价与套餐增减价；员工只看单品成品价与套餐合计
  showPricing?: boolean;
  onClose: () => void;
  onConfirm: (item: OrderItem) => void;
};

interface ProductChoice {
  included: boolean;
  quantity: number;
  skuChoices: Record<string, string>; // componentId → skuUnitId
}

// 套餐选配对话框：逐单品勾选/定数量/选规格，实时套餐价。
// 员工端（showPricing=false）可见各单品成品价小计与套餐合计价，
// 不可见组件单价与套餐增减价（组件层价格，cost.view 门控）。
export function PackagePicker({
  pkg,
  configProducts,
  components,
  skuUnits,
  showPricing = false,
  onClose,
  onConfirm,
}: Props) {
  const [choices, setChoices] = useState<Record<string, ProductChoice>>(() => {
    const init: Record<string, ProductChoice> = {};
    for (const item of pkg.items) {
      const product = configProducts.find((p) => p.id === item.productId);
      const skuChoices: Record<string, string> = {};
      if (product) {
        for (const comp of product.components) {
          const options = componentSkuOptions(skuUnits, comp);
          skuChoices[comp.componentId] = options[0]?.id ?? "";
        }
      }
      init[item.productId] = {
        included: !item.optional,
        quantity: item.quantity,
        skuChoices,
      };
    }
    return init;
  });

  // 卡片数据：单品 + 主件行
  const cards = pkg.items.map((item) => {
    const product = configProducts.find((p) => p.id === item.productId);
    const rows = (product?.components ?? []).map((comp) => {
      const options = componentSkuOptions(skuUnits, comp);
      const componentName =
        components.find((c) => c.id === comp.componentId)?.name ??
        comp.componentId;
      return { comp, options, componentName };
    });
    return { item, product, rows };
  });

  // picks → buildPackageOrderItems
  const picks = useMemo(() => {
    const result: Record<
      string,
      { included?: boolean; quantity?: number; selections?: Record<string, Record<string, string>> }
    > = {};
    for (const { item, rows } of cards) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const choice = choices[item.productId] ?? { included: !item.optional, quantity: item.quantity, skuChoices: {} };
      const selections: Record<string, Record<string, string>> = {};
      for (const { comp } of rows) {
        const unitId = choice.skuChoices[comp.componentId];
        if (!choice.included || !unitId) continue;
        const unit = skuUnits.find((u) => u.id === unitId);
        if (unit) selections[comp.componentId] = unit.specValues;
      }
      result[item.productId] = {
        included: choice.included,
        quantity: choice.quantity,
        selections,
      };
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, skuUnits]);

  const built = useMemo(
    () => buildPackageOrderItems(pkg, configProducts, components, skuUnits, picks),
    [pkg, configProducts, components, skuUnits, picks],
  );

  const price = packagePrice(pkg, configProducts, skuUnits, picks);
  const componentSum = built.skuLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  // 可售提示：按已选单品的现货主件聚合
  const stockableLines = built.skuLines.filter((line) =>
    ["现货", "展厅样品"].includes(line.supplyType),
  );
  const minStock = stockableLines.length
    ? Math.min(
        ...stockableLines.map(
          (line) =>
            availableCount(
              skuUnits.find((u) => u.id === line.skuUnitId) ?? {
                availableStock: 0,
                reservedStock: 0,
              } as SkuUnit,
            ),
        ),
      )
    : Number.POSITIVE_INFINITY;
  const hasCustom = built.skuLines.some((line) => line.supplyType === "定制生产");
  const hasPurchase = built.skuLines.some((line) => line.supplyType === "外采产品");

  const missingRequired = cards.some(
    ({ item, rows }) =>
      !item.optional &&
      choices[item.productId]?.included !== false &&
      rows.some((row) => !row.comp.optional && row.options.length === 0),
  );
  const includedNoSku = cards.some(({ item, rows }) => {
    const choice = choices[item.productId];
    if (!choice?.included) return false;
    return rows.some(
      (row) =>
        !row.comp.optional &&
        !choice.skuChoices[row.comp.componentId],
    );
  });
  const canConfirm =
    built.skuLines.length > 0 &&
    !built.unresolved.length &&
    !missingRequired &&
    !includedNoSku;

  const toggleIncluded = (productId: string, included: boolean) =>
    setChoices((current) => ({
      ...current,
      [productId]: { ...current[productId], included },
    }));

  const setQuantity = (productId: string, quantity: number) =>
    setChoices((current) => ({
      ...current,
      [productId]: { ...current[productId], quantity },
    }));

  const pickSku = (productId: string, componentId: string, skuUnitId: string) =>
    setChoices((current) => {
      const choice = current[productId] ?? { included: true, quantity: 1, skuChoices: {} };
      return {
        ...current,
        [productId]: {
          ...choice,
          skuChoices: { ...choice.skuChoices, [componentId]: skuUnitId },
        },
      };
    });

  const confirm = () => {
    const material = built.skuLines.find((line) => line.material)?.material;
    const item: OrderItem = {
      id: `item-${Date.now()}-${pkg.id}`,
      packageId: pkg.id,
      packageCode: pkg.code,
      sku: pkg.code,
      productName: pkg.name,
      specification: summarizePackagePicks(built.packageItems),
      quantity: 1,
      unit: "套",
      unitPrice: price,
      supplyType: aggregateSupplyType(built.skuLines),
      availableStock:
        minStock === Number.POSITIVE_INFINITY ? undefined : minStock,
      material,
      skuLines: built.skuLines,
      packageItems: built.packageItems,
      attachments: [],
    };
    onConfirm(item);
  };

  const stockHint = hasCustom
    ? "含定制生产主件，接单后转生产需求"
    : hasPurchase
      ? "含外采主件，接单后转采购需求"
      : minStock === Number.POSITIVE_INFINITY
        ? ""
        : `现货可售 ${minStock} 套`;

  return (
    <div
      className="config-picker-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`套餐选配 · ${pkg.name}`}
    >
      <section className="config-picker package-picker">
        <header>
          <div>
            <b>{pkg.name}</b>
            <small>
              {pkg.code} · 含 {pkg.items.length} 件单品
              {pkg.description ? ` · ${pkg.description}` : ""}
            </small>
          </div>
          <button type="button" aria-label="关闭套餐选配" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {missingRequired && (
          <p className="picker-warning" role="alert">
            有必选单品的主件尚未配置在售规格，请联系店长补齐产品资料。
          </p>
        )}
        <div className="picker-rows">
          {cards.map(({ item, product, rows }) => {
            const choice = choices[item.productId] ?? {
              included: !item.optional,
              quantity: item.quantity,
              skuChoices: {},
            };
            const quantityOptions = item.quantityOptions ?? [];
            return (
              <article
                className="picker-row package-product-row"
                key={item.productId}
                data-included={choice.included ? "true" : "false"}
              >
                <label className="picker-row-head">
                  {item.optional && (
                    <input
                      type="checkbox"
                      checked={choice.included}
                      onChange={(e) =>
                        toggleIncluded(item.productId, e.target.checked)
                      }
                      aria-label={`选购${product?.name ?? item.productId}`}
                    />
                  )}
                  <b>{product?.name ?? item.productId}</b>
                  {quantityOptions.length > 0 ? (
                    <span className="picker-quantity-options">
                      {quantityOptions.map((q) => (
                        <label key={q} className="picker-quantity-option">
                          <input
                            type="radio"
                            name={`qty-${item.productId}`}
                            value={q}
                            checked={choice.quantity === q}
                            disabled={!choice.included}
                            onChange={() => setQuantity(item.productId, q)}
                          />
                          ×{q}
                        </label>
                      ))}
                    </span>
                  ) : (
                    <small>×{item.quantity}{item.optional ? " · 选配" : ""}</small>
                  )}
                </label>
                {product && rows.length > 0 && (
                  <div className="package-component-rows">
                    {rows.map(({ comp, options, componentName }) => {
                      const selected = choice.skuChoices[comp.componentId] ?? "";
                      return (
                        <div className="package-component-row" key={comp.componentId}>
                          <small>
                            {componentName}
                            <span>×{comp.quantity}{comp.optional ? " 选配" : ""}</span>
                          </small>
                          {options.length > 0 ? (
                            <select
                              aria-label={`${product.name} ${componentName}规格`}
                              value={selected}
                              disabled={!choice.included}
                              onChange={(e) =>
                                pickSku(item.productId, comp.componentId, e.target.value)
                              }
                            >
                              {options.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                  {specSummary(unit.specValues)}
                                  {` · ${unit.supplyType}`}
                                  {` · 可用 ${availableCount(unit)}`}
                                  {showPricing ? ` · ${money(unit.unitPrice)}` : ""}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="picker-empty">暂无在售规格</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {product && choice.included && showPricing && (
                  <small className="package-product-price">
                    成品价 {money(configProductPrice(product, skuUnits, selectionsOf(choice, skuUnits)))} × {choice.quantity} ={" "}
                    <b>{money(configProductPrice(product, skuUnits, selectionsOf(choice, skuUnits)) * choice.quantity)}</b>
                  </small>
                )}
              </article>
            );
          })}
        </div>
        <footer>
          <div className="picker-summary">
            {showPricing && (
              <span>
                组件小计 <b>{money(componentSum)}</b>
              </span>
            )}
            {showPricing && pkg.adjustPrice !== 0 && (
              <span>
                套餐增减价{" "}
                <b>
                  {pkg.adjustPrice > 0 ? "+" : ""}
                  {money(pkg.adjustPrice)}
                </b>
              </span>
            )}
            <strong>套餐合计价 {money(price)}</strong>
          </div>
          <div className="picker-meta">
            {stockHint && <span>{stockHint}</span>}
            <span>{built.packageItems.length} 件单品 · {built.skuLines.length} 项组件</span>
          </div>
          <div className="picker-actions">
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="primary"
              disabled={!canConfirm}
              onClick={confirm}
            >
              加入销售单
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

// 从选择状态提取该单品的规格选择（compId → specValues）
function selectionsOf(
  choice: ProductChoice,
  skuUnits: SkuUnit[],
): Record<string, Record<string, string>> {
  const selections: Record<string, Record<string, string>> = {};
  for (const [componentId, unitId] of Object.entries(choice.skuChoices)) {
    if (!choice.included || !unitId) continue;
    const unit = skuUnits.find((u) => u.id === unitId);
    if (unit) selections[componentId] = unit.specValues;
  }
  return selections;
}
