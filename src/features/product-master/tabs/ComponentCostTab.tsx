import { useMemo, useState } from "react";
import { Plus, Trash2, Lock } from "lucide-react";
import type { ProductComponent, SkuUnit, SupplyType } from "../../../types";
import { useSalesData } from "../../../store/SalesDataContext";
import { buildSkuCode, ensureUniqueCode } from "../../../utils/product-config";
import { bySort, formatCurrency, newId, seriesNameOf } from "../pm-utils";

const SUPPLY_TYPES: SupplyType[] = [
  "现货",
  "展厅样品",
  "外采产品",
  "定制生产",
];

interface Props {
  canViewCost: boolean;
}

export function ComponentCostTab({ canViewCost }: Props) {
  const sales = useSalesData();
  const components = sales.components ?? [];
  const skuUnits = sales.skuUnits ?? [];
  const series = sales.series ?? [];

  const [componentId, setComponentId] = useState("");
  const [specValues, setSpecValues] = useState<Record<string, string>>({});
  const [unitPrice, setUnitPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [supplyType, setSupplyType] = useState<SupplyType>("现货");
  const [availableStock, setAvailableStock] = useState(0);
  const [reservedStock, setReservedStock] = useState(0);
  const [safetyStock, setSafetyStock] = useState(0);
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState<"上架" | "下架">("上架");
  const [seriesFilter, setSeriesFilter] = useState("");

  const comp = components.find((c) => c.id === componentId);
  const grouped = useMemo(
    () =>
      components
        .slice()
        .sort(bySort)
        .map((c) => ({
          component: c,
          seriesName: seriesNameOf(c.seriesId, series),
          units: skuUnits
            .filter((u) => u.componentId === c.id)
            .sort((a, b) => a.sku.localeCompare(b.sku)),
        }))
        .filter(
          (g) =>
            g.units.length > 0 &&
            (!seriesFilter || g.seriesName === seriesFilter),
        ),
    [components, skuUnits, series, seriesFilter],
  );
  // 系列筛选选项：台账中实际存在的主件系列
  const seriesOptions = useMemo(() => {
    const names = new Set<string>();
    components.forEach((c) => names.add(seriesNameOf(c.seriesId, series)));
    return Array.from(names).sort();
  }, [components, series]);

  function selectComponent(id: string) {
    setComponentId(id);
    const c = components.find((x) => x.id === id);
    setSpecValues(
      c ? Object.fromEntries(c.specDims.map((d) => [d.name, ""])) : {},
    );
  }

  function submit() {
    if (!comp) return;
    if (Object.values(specValues).some((v) => !v.trim())) return;
    const dimOrder = comp.specDims.map((d) => d.name);
    const base = buildSkuCode(comp.code, specValues, dimOrder);
    const sku = ensureUniqueCode(
      base,
      skuUnits.map((u) => u.sku),
    );
    const item: SkuUnit = {
      id: newId(),
      componentId: comp.id,
      sku,
      specValues: { ...specValues },
      unitPrice,
      costPrice,
      supplyType,
      availableStock,
      reservedStock,
      safetyStock,
      supplier: supplier || undefined,
      status,
    };
    sales.addProductMaster("skuUnits", item);
    setSpecValues(Object.fromEntries(comp.specDims.map((d) => [d.name, ""])));
    setUnitPrice(0);
    setCostPrice(0);
    setAvailableStock(0);
    setReservedStock(0);
    setSafetyStock(0);
    setSupplier("");
  }

  function patch(id: string, changes: Partial<SkuUnit>) {
    sales.updateProductMaster("skuUnits", id, changes);
  }

  if (!canViewCost) {
    return (
      <div className="pm-permission-denied">
        <Lock size={28} />
        <p>组件层价格与成本仅店长 / 采购 / 财务可见。</p>
        <small>你当前角色无权查看「组件与成本」。</small>
      </div>
    );
  }

  return (
    <div className="pm-cost">
      <section className="pm-cost-form">
        <header className="pm-col-head">
          <h3>新建最小单位（SKU）</h3>
        </header>
        <div className="pm-inline-form">
          <label>
            所属主件
            <select value={componentId} onChange={(e) => selectComponent(e.target.value)}>
              <option value="">请选择</option>
              {components.sort(bySort).map((c: ProductComponent) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.code}）
                </option>
              ))}
            </select>
          </label>
          {comp && (
            <div className="pm-form-grid">
              {comp.specDims.map((d) => (
                <label key={d.id}>
                  {d.name}
                  <select
                    value={specValues[d.name] ?? ""}
                    onChange={(e) =>
                      setSpecValues((s) => ({ ...s, [d.name]: e.target.value }))
                    }
                  >
                    <option value="">选择</option>
                    {d.values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div className="pm-form-grid-3">
            <label>
              售价
              <input type="number" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
            </label>
            <label>
              成本
              <input type="number" value={costPrice} onChange={(e) => setCostPrice(Number(e.target.value))} />
            </label>
            <label>
              供应方式
              <select value={supplyType} onChange={(e) => setSupplyType(e.target.value as SupplyType)}>
                {SUPPLY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              可用库存
              <input type="number" value={availableStock} onChange={(e) => setAvailableStock(Number(e.target.value))} />
            </label>
            <label>
              锁定库存
              <input type="number" value={reservedStock} onChange={(e) => setReservedStock(Number(e.target.value))} />
            </label>
            <label>
              安全库存
              <input type="number" value={safetyStock} onChange={(e) => setSafetyStock(Number(e.target.value))} />
            </label>
          </div>
          <label>
            供应商
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="可选" />
          </label>
          <label>
            状态
            <select value={status} onChange={(e) => setStatus(e.target.value as "上架" | "下架")}>
              <option value="上架">上架</option>
              <option value="下架">下架</option>
            </select>
          </label>
          <div className="pm-form-actions">
            <button className="pm-primary" onClick={submit} disabled={!comp}>
              <Plus size={15} /> 创建 SKU
            </button>
          </div>
        </div>
      </section>

      <section className="pm-cost-ledger">
        <header className="pm-col-head">
          <h3>最小单位台账</h3>
          <div className="pm-cost-filters">
            <select
              value={seriesFilter}
              onChange={(e) => setSeriesFilter(e.target.value)}
              aria-label="按产品系列筛选"
            >
              <option value="">全部系列</option>
              {seriesOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span className="pm-muted">按主件分组 · 编码自动去重</span>
          </div>
        </header>
        {grouped.length === 0 && (
          <p className="pm-empty">暂无最小单位，先在上方创建。</p>
        )}
        {grouped.map(({ component, seriesName, units }) => (
          <div className="pm-unit-group" key={component.id}>
            <h4>
              {component.name}（{component.code}）
              <span className="pm-series-tag">{seriesName}</span>
            </h4>
            <table className="pm-unit-table">
              <thead>
                <tr>
                  <th>SKU 编码</th>
                  <th>规格</th>
                  <th>售价</th>
                  <th>成本</th>
                  <th>可用</th>
                  <th>安全</th>
                  <th>方式</th>
                  <th>状态</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td className="pm-mono">{u.sku}</td>
                    <td>{Object.entries(u.specValues).map(([k, v]) => `${k}:${v}`).join(" / ")}</td>
                    <td>
                      <input
                        type="number"
                        className="pm-cell-num"
                        value={u.unitPrice}
                        onChange={(e) => patch(u.id, { unitPrice: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="pm-cell-num"
                        value={u.costPrice}
                        onChange={(e) => patch(u.id, { costPrice: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="pm-cell-num"
                        value={u.availableStock}
                        onChange={(e) => patch(u.id, { availableStock: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="pm-cell-num"
                        value={u.safetyStock}
                        onChange={(e) => patch(u.id, { safetyStock: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <select
                        className="pm-cell-select"
                        value={u.supplyType}
                        onChange={(e) => patch(u.id, { supplyType: e.target.value as SupplyType })}
                      >
                        {SUPPLY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="pm-cell-select"
                        value={u.status}
                        onChange={(e) => patch(u.id, { status: e.target.value as "上架" | "下架" })}
                      >
                        <option value="上架">上架</option>
                        <option value="下架">下架</option>
                      </select>
                    </td>
                    <td>
                      <button
                        className="pm-del"
                        aria-label="删除"
                        onClick={() => {
                          if (confirm(`确认删除最小单位 ${u.sku}？`))
                            sales.removeProductMaster("skuUnits", u.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pm-muted">
              组小计：售价 {formatCurrency(units.reduce((s, u) => s + u.unitPrice, 0))} ·
              成本 {formatCurrency(units.reduce((s, u) => s + u.costPrice, 0))} ·
              可用 {units.reduce((s, u) => s + Math.max(0, u.availableStock - u.reservedStock), 0)}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
