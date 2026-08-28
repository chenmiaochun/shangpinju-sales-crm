import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  ConfigProduct,
  OrderItem,
  ProductComponent,
  SkuUnit,
} from "../../types";
import {
  aggregateSupplyType,
  availableCount,
  buildOrderSkuLines,
  componentSkuOptions,
  configProductPrice,
  specSummary,
  summarizeSkuLines,
} from "../../utils/product-config";

const money = (value: number) =>
  `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Props = {
  product: ConfigProduct;
  components: ProductComponent[];
  skuUnits: SkuUnit[];
  // 老板/采购/财务（cost.view）可见组件价格与增减价；员工只看成品合计价
  showPricing?: boolean;
  onClose: () => void;
  onConfirm: (item: OrderItem) => void;
};

interface CompChoice {
  included: boolean;
  skuUnitId: string;
}

// 单品规格选择对话框：按主件逐个选择在售最小单位，实时算价与可用量。
// 员工端（showPricing=false）不显示组件单价与增减价，只显示成品合计价。
export function ConfigProductPicker({
  product,
  components,
  skuUnits,
  showPricing = false,
  onClose,
  onConfirm,
}: Props) {
  const [choices, setChoices] = useState<Record<string, CompChoice>>(() => {
    const init: Record<string, CompChoice> = {};
    for (const comp of product.components) {
      const options = componentSkuOptions(skuUnits, comp);
      init[comp.componentId] = {
        included: !comp.optional,
        skuUnitId: options[0]?.id ?? "",
      };
    }
    return init;
  });

  const rows = product.components.map((comp) => {
    const options = componentSkuOptions(skuUnits, comp);
    const componentName =
      components.find((c) => c.id === comp.componentId)?.name ??
      comp.componentId;
    return { comp, options, componentName };
  });

  const selections = useMemo(() => {
    const sel: Record<string, Record<string, string>> = {};
    for (const { comp } of rows) {
      const choice = choices[comp.componentId];
      if (!choice?.included || !choice.skuUnitId) continue;
      const unit = skuUnits.find((u) => u.id === choice.skuUnitId);
      if (unit) sel[comp.componentId] = unit.specValues;
    }
    return sel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices, skuUnits]);

  const { lines, unresolved } = useMemo(
    () => buildOrderSkuLines(product, components, skuUnits, selections),
    [product, components, skuUnits, selections],
  );

  const price = configProductPrice(product, skuUnits, selections);
  const componentSum = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const stockableLines = lines.filter((line) =>
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
  const hasCustom = lines.some((line) => line.supplyType === "定制生产");
  const hasPurchase = lines.some((line) => line.supplyType === "外采产品");
  const missingRequired = rows.some(
    (row) => !row.comp.optional && row.options.length === 0,
  );
  const includedNoSku = rows.some(
    (row) =>
      choices[row.comp.componentId]?.included &&
      !choices[row.comp.componentId]?.skuUnitId,
  );
  const canConfirm =
    lines.length > 0 && !unresolved.length && !missingRequired && !includedNoSku;

  const toggle = (componentId: string, included: boolean) =>
    setChoices((current) => ({
      ...current,
      [componentId]: { ...current[componentId], included },
    }));

  const pick = (componentId: string, skuUnitId: string) =>
    setChoices((current) => ({
      ...current,
      [componentId]: { ...current[componentId], skuUnitId },
    }));

  const confirm = () => {
    const material = lines.find((line) => line.material)?.material;
    const item: OrderItem = {
      id: `item-${Date.now()}-${product.id}`,
      configProductId: product.id,
      configProductCode: product.code,
      sku: product.code,
      productName: product.name,
      specification: summarizeSkuLines(lines),
      quantity: 1,
      unit: "套",
      unitPrice: price,
      supplyType: aggregateSupplyType(lines),
      availableStock:
        minStock === Number.POSITIVE_INFINITY ? undefined : minStock,
      material,
      skuLines: lines,
      selections,
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
      aria-label={`选择规格 · ${product.name}`}
    >
      <section className="config-picker">
        <header>
          <div>
            <b>{product.name}</b>
            <small>
              {product.code}
              {product.series ? ` · ${product.series}` : ""}
              {product.style ? ` · ${product.style}` : ""}
            </small>
          </div>
          <button type="button" aria-label="关闭规格选择" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        {missingRequired && (
          <p className="picker-warning" role="alert">
            有必选主件尚未配置在售规格，请联系店长补齐产品资料。
          </p>
        )}
        <div className="picker-rows">
          {rows.map(({ comp, options, componentName }) => {
            const choice = choices[comp.componentId] ?? {
              included: !comp.optional,
              skuUnitId: "",
            };
            return (
              <article
                className="picker-row"
                key={comp.componentId}
                data-included={choice.included ? "true" : "false"}
              >
                <label className="picker-row-head">
                  {comp.optional && (
                    <input
                      type="checkbox"
                      checked={choice.included}
                      onChange={(e) =>
                        toggle(comp.componentId, e.target.checked)
                      }
                      aria-label={`选购${componentName}`}
                    />
                  )}
                  <b>{componentName}</b>
                  <small>
                    ×{comp.quantity}
                    {comp.optional ? " · 选配" : " · 必选"}
                  </small>
                </label>
                {options.length > 0 ? (
                  <select
                    aria-label={`${componentName}规格`}
                    value={choice.skuUnitId}
                    disabled={!choice.included}
                    onChange={(e) => pick(comp.componentId, e.target.value)}
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
            {showPricing && product.adjustPrice !== 0 && (
              <span>
                增减价{" "}
                <b>
                  {product.adjustPrice > 0 ? "+" : ""}
                  {money(product.adjustPrice)}
                </b>
              </span>
            )}
            <strong>成品合计价 {money(price)}</strong>
          </div>
          <div className="picker-meta">
            {stockHint && <span>{stockHint}</span>}
            <span>{lines.length} 项组件</span>
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
