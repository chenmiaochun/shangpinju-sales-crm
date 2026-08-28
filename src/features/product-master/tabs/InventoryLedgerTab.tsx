import { useMemo, useState } from "react";
import { Boxes, PackageCheck, AlertTriangle } from "lucide-react";
import type { SkuUnit } from "../../../types";
import { useSalesData } from "../../../store/SalesDataContext";
import { bySort, formatCurrency } from "../pm-utils";

interface Props {
  canViewCost: boolean;
}

export function InventoryLedgerTab({ canViewCost }: Props) {
  const sales = useSalesData();
  const categories = sales.categories ?? [];
  const components = sales.components ?? [];
  const skuUnits = sales.skuUnits ?? [];

  // 每个 SKU 的即时调整量（按 id 暂存）
  const [deltas, setDeltas] = useState<Record<string, number>>({});

  const tree = useMemo(() => {
    return categories
      .slice()
      .sort(bySort)
      .map((cat) => {
        const comps = components
          .filter((c) => c.categoryId === cat.id)
          .sort(bySort)
          .map((comp) => ({
            component: comp,
            units: skuUnits
              .filter((u) => u.componentId === comp.id)
              .sort((a, b) => a.sku.localeCompare(b.sku)),
          }))
          .filter((g) => g.units.length > 0);
        return { category: cat, comps };
      })
      .filter((g) => g.comps.length > 0);
  }, [categories, components, skuUnits]);

  const totalUnits = skuUnits.length;
  const totalValue = canViewCost
    ? skuUnits.reduce((s, u) => s + (u.costPrice ?? 0) * (u.availableStock ?? 0), 0)
    : 0;
  const lowStock = skuUnits.filter(
    (u) => ["现货", "展厅样品", "外采产品"].includes(u.supplyType) &&
      Math.max(0, u.availableStock - (u.reservedStock ?? 0)) <= (u.safetyStock ?? 0),
  ).length;

  function applyAdjust(u: SkuUnit) {
    const delta = deltas[u.id];
    if (!delta) return;
    sales.updateProductMaster("skuUnits", u.id, {
      availableStock: Math.max(0, (u.availableStock ?? 0) + delta),
    });
    setDeltas((d) => ({ ...d, [u.id]: 0 }));
  }

  return (
    <div className="pm-ledger">
      <section className="pm-kpis">
        <article>
          <Boxes size={18} />
          <span>最小单位总数<strong>{totalUnits}</strong></span>
        </article>
        <article>
          <PackageCheck size={18} />
          <span>
            库存成本
            <strong>{canViewCost ? formatCurrency(totalValue) : "无权限"}</strong>
          </span>
        </article>
        <article className={lowStock > 0 ? "warning" : ""}>
          <AlertTriangle size={18} />
          <span>库存预警<strong>{lowStock}</strong></span>
        </article>
      </section>

      {tree.length === 0 && (
        <p className="pm-empty">
          暂无最小单位库存。请先在「组件与成本」页建立 SKU（最小单位），库存会按最小单位展示在此。
        </p>
      )}

      {tree.map(({ category, comps }) => (
        <div className="pm-ledger-group" key={category.id}>
          <h3>
            {category.name}
            <small>（{category.code}）</small>
          </h3>
          {comps.map(({ component, units }) => (
            <div className="pm-unit-group" key={component.id}>
              <h4>
                {component.name}
                <small>（{component.code}）</small>
              </h4>
              <table className="pm-unit-table">
                <thead>
                  <tr>
                    <th>SKU 编码</th>
                    <th>规格</th>
                    <th>售价</th>
                    {canViewCost && <th>成本</th>}
                    <th>可用 / 锁定 / 自由</th>
                    <th>状态</th>
                    <th>库存调整</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => {
                    const free = Math.max(0, u.availableStock - (u.reservedStock ?? 0));
                    const low =
                      ["现货", "展厅样品", "外采产品"].includes(u.supplyType) &&
                      free <= (u.safetyStock ?? 0);
                    return (
                      <tr key={u.id}>
                        <td className="pm-mono">{u.sku}</td>
                        <td>{Object.entries(u.specValues).map(([k, v]) => `${k}:${v}`).join(" / ")}</td>
                        <td>{formatCurrency(u.unitPrice)}</td>
                        {canViewCost && <td>{formatCurrency(u.costPrice)}</td>}
                        <td>
                          <b>{formatDecimal(u.availableStock)}</b>
                          <small>
                            锁定 {formatDecimal(u.reservedStock ?? 0)} · 自由 {formatDecimal(free)}
                          </small>
                        </td>
                        <td>
                          {u.supplyType === "定制生产" ? (
                            <i className="pm-tag-custom">按单生产</i>
                          ) : low ? (
                            <i className="pm-tag-low">需关注</i>
                          ) : (
                            <i className="pm-tag-ok">正常</i>
                          )}
                        </td>
                        <td className="pm-adjust-cell">
                          <input
                            type="number"
                            className="pm-cell-num"
                            value={deltas[u.id] ?? 0}
                            onChange={(e) =>
                              setDeltas((d) => ({ ...d, [u.id]: Number(e.target.value) }))
                            }
                            placeholder="调整量"
                          />
                          <button
                            className="pm-link"
                            disabled={!deltas[u.id]}
                            onClick={() => applyAdjust(u)}
                          >
                            确认
                          </button>
                          <small>正加负减</small>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatDecimal(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
