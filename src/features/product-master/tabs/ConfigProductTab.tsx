import { useMemo, useState } from "react";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import type {
  ConfigProduct,
  ConfigProductComponent,
  MediaFile,
  ProductComponent,
  ProductMedia,
} from "../../../types";
import { useSalesData } from "../../../store/SalesDataContext";
import {
  componentSkuOptions,
  configProductPriceRange,
  ensureUniqueCode,
  generateConfigProductCode,
  specSummary,
} from "../../../utils/product-config";
import {
  bySort,
  formatPriceRange,
  newId,
  seriesIdOf,
  seriesListOf,
} from "../pm-utils";
import { MediaUploader } from "../MediaUploader";

type DimMode = "lock" | "open" | "any";
interface DimControl {
  mode: DimMode;
  value: string;
  allowed: string;
}
interface DraftComponent {
  componentId: string;
  quantity: number;
  optional: boolean;
  controls: Record<string, DimControl>;
}

const MEDIA_FIELDS: { key: keyof ProductMedia; label: string; hint?: string }[] = [
  { key: "images", label: "主图 / 产品图", hint: "第一张作为主图" },
  { key: "dimensionImages", label: "尺寸图" },
  { key: "materialImages", label: "材质图" },
  { key: "colorImages", label: "颜色图" },
  { key: "installationDoc", label: "安装说明" },
  { key: "careDoc", label: "保养说明" },
  { key: "manualFiles", label: "产品手册 / 附件" },
];

function fieldFiles(m: ProductMedia, key: keyof ProductMedia): MediaFile[] {
  const v = m[key];
  return Array.isArray(v) ? (v as MediaFile[]) : [];
}

function emptyMedia(): ProductMedia {
  return {
    images: [],
    dimensionImages: [],
    materialImages: [],
    colorImages: [],
    installationDoc: [],
    careDoc: [],
    manualFiles: [],
    qualityStandard: "",
  };
}

export function ConfigProductTab() {
  const sales = useSalesData();
  const categories = sales.categories ?? [];
  const productSeries = sales.series ?? [];
  const components = sales.components ?? [];
  const skuUnits = sales.skuUnits ?? [];
  const configProducts = sales.configProducts ?? [];

  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");
  const [series, setSeries] = useState("");
  const [applicableSpace, setApplicableSpace] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [adjustPrice, setAdjustPrice] = useState(0);
  const [status, setStatus] = useState<"上架" | "下架">("上架");
  const [media, setMedia] = useState<ProductMedia>(emptyMedia());
  const [draftComps, setDraftComps] = useState<DraftComponent[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const cat = categories.find((c) => c.id === categoryId) ?? categories[0];
  const activeCategoryId = cat?.id ?? "";
  const catComponents = useMemo(
    () => components.filter((c) => c.categoryId === activeCategoryId).sort(bySort),
    [components, activeCategoryId],
  );

  // 主件按产品系列分组（公共/其他 + 自定义系列），供下拉选择器折叠展示
  const compSeriesGroups = useMemo(() => {
    const groups: { seriesId: string; seriesName: string; comps: ProductComponent[] }[] = [];
    for (const ser of seriesListOf(activeCategoryId, productSeries)) {
      const comps = catComponents.filter((c) => seriesIdOf(c) === ser.id);
      if (comps.length) groups.push({ seriesId: ser.id, seriesName: ser.name, comps });
    }
    return groups;
  }, [catComponents, productSeries, activeCategoryId]);

  const preview = useMemo<ConfigProduct | null>(() => {
    if (!activeCategoryId || draftComps.length === 0) return null;
    return buildProduct();
  }, [activeCategoryId, draftComps, adjustPrice]);

  function buildProduct(): ConfigProduct {
    const components2: ConfigProductComponent[] = draftComps
      .filter((d) => d.componentId)
      .map((d) => {
        const locked: Record<string, string> = {};
        const allowed: Record<string, string[]> = {};
        for (const [dim, ctrl] of Object.entries(d.controls)) {
          if (ctrl.mode === "lock" && ctrl.value) locked[dim] = ctrl.value;
          if (ctrl.mode === "open") {
            const arr = ctrl.allowed
              .split(/[,，]/)
              .map((v) => v.trim())
              .filter(Boolean);
            if (arr.length) allowed[dim] = arr;
          }
        }
        return {
          componentId: d.componentId,
          quantity: d.quantity,
          optional: d.optional,
          locked: Object.keys(locked).length ? locked : undefined,
          allowed: Object.keys(allowed).length ? allowed : undefined,
        };
      });
    return {
      id: editingId ?? newId(),
      categoryId: activeCategoryId,
      name: name || "未命名单品",
      code: code || "SP-XXX-001",
      description: description || undefined,
      style: style || undefined,
      series: series || undefined,
      applicableSpace: applicableSpace
        ? applicableSpace.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
        : undefined,
      sortOrder,
      media: hasMedia(media) ? media : undefined,
      components: components2,
      adjustPrice,
      status,
    };
  }

  function hasMedia(m: ProductMedia): boolean {
    return (
      (m.images?.length ?? 0) > 0 ||
      (m.dimensionImages?.length ?? 0) > 0 ||
      (m.materialImages?.length ?? 0) > 0 ||
      (m.colorImages?.length ?? 0) > 0 ||
      (m.installationDoc?.length ?? 0) > 0 ||
      (m.careDoc?.length ?? 0) > 0 ||
      (m.manualFiles?.length ?? 0) > 0 ||
      !!m.qualityStandard
    );
  }

  function addDraftComponent() {
    const comp = catComponents[0];
    if (!comp) return;
    setDraftComps((list) => [
      ...list,
      {
        componentId: comp.id,
        quantity: 1,
        optional: false,
        controls: Object.fromEntries(
          comp.specDims.map((d) => [
            d.name,
            { mode: "any" as DimMode, value: "", allowed: "" },
          ]),
        ),
      },
    ]);
  }

  function updateDraftComponent(
    idx: number,
    patch: Partial<DraftComponent>,
  ) {
    setDraftComps((list) =>
      list.map((d, i) => (i === idx ? { ...d, ...patch } : d)),
    );
  }

  function changeComponent(
    idx: number,
    componentId: string,
  ) {
    const comp = components.find((c) => c.id === componentId);
    if (!comp) return;
    updateDraftComponent(idx, {
      componentId,
      controls: Object.fromEntries(
        comp.specDims.map((d) => [
          d.name,
          { mode: "any" as DimMode, value: "", allowed: "" },
        ]),
      ),
    });
  }

  function setDimMode(idx: number, dim: string, mode: DimMode) {
    setDraftComps((list) =>
      list.map((d, i) =>
        i === idx
          ? {
              ...d,
              controls: {
                ...d.controls,
                [dim]: { ...d.controls[dim], mode },
              },
            }
          : d,
      ),
    );
  }
  function setDimValue(idx: number, dim: string, value: string) {
    setDraftComps((list) =>
      list.map((d, i) =>
        i === idx
          ? {
              ...d,
              controls: {
                ...d.controls,
                [dim]: { ...d.controls[dim], value },
              },
            }
          : d,
      ),
    );
  }
  function setDimAllowed(idx: number, dim: string, allowed: string) {
    setDraftComps((list) =>
      list.map((d, i) =>
        i === idx
          ? {
              ...d,
              controls: {
                ...d.controls,
                [dim]: { ...d.controls[dim], allowed },
              },
            }
          : d,
      ),
    );
  }

  function autoCode() {
    if (!cat) return;
    const suggested = generateConfigProductCode(
      cat.code,
      configProducts.map((p) => p.code),
    );
    setCode(ensureUniqueCode(suggested, configProducts.map((p) => p.code)));
  }

  function resetForm() {
    setName("");
    setCode("");
    setDescription("");
    setStyle("");
    setSeries("");
    setApplicableSpace("");
    setSortOrder(0);
    setAdjustPrice(0);
    setStatus("上架");
    setMedia(emptyMedia());
    setDraftComps([]);
    setEditingId(null);
  }

  function submit() {
    if (!activeCategoryId) return;
    if (!code.trim()) autoCode();
    const product = buildProduct();
    if (editingId) {
      sales.updateProductMaster("configProducts", editingId, { ...product });
    } else {
      sales.addProductMaster("configProducts", product);
    }
    resetForm();
  }

  function loadForEdit(p: ConfigProduct) {
    setEditingId(p.id);
    setCategoryId(p.categoryId);
    setName(p.name);
    setCode(p.code);
    setDescription(p.description ?? "");
    setStyle(p.style ?? "");
    setSeries(p.series ?? "");
    setApplicableSpace((p.applicableSpace ?? []).join("，"));
    setSortOrder(p.sortOrder);
    setAdjustPrice(p.adjustPrice);
    setStatus(p.status);
    setMedia(p.media ?? emptyMedia());
    setDraftComps(
      p.components.map((c) => {
        const comp = components.find((x) => x.id === c.componentId);
        const controls: Record<string, DimControl> = {};
        comp?.specDims.forEach((d) => {
          const lockedVal = c.locked?.[d.name];
          const allowedArr = c.allowed?.[d.name];
          if (lockedVal) controls[d.name] = { mode: "lock", value: lockedVal, allowed: "" };
          else if (allowedArr && allowedArr.length)
            controls[d.name] = { mode: "open", value: "", allowed: allowedArr.join(",") };
          else controls[d.name] = { mode: "any", value: "", allowed: "" };
        });
        return {
          componentId: c.componentId,
          quantity: c.quantity,
          optional: c.optional,
          controls,
        };
      }),
    );
  }

  const previewRange = preview ? configProductPriceRange(preview, skuUnits) : null;

  return (
    <div className="pm-two-col">
      <section className="pm-col">
        <header className="pm-col-head">
          <h3>单品列表</h3>
        </header>
          <ul className="pm-list">
            {configProducts
              .slice()
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((p) => (
                <li
                  key={p.id}
                  className={editingId === p.id ? "active" : ""}
                  onClick={() => loadForEdit(p)}
                >
                  <div>
                    <b>{p.name}</b>
                    <small>
                      {p.code} · {p.components.length} 主件 · {p.status}
                    </small>
                  </div>
                  <div className="pm-row-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="pm-link" onClick={() => loadForEdit(p)}>
                      编辑
                    </button>
                    <button
                      className="pm-del"
                      aria-label={`删除 ${p.name}`}
                      onClick={() => {
                        if (confirm(`确认删除单品「${p.name}」？`))
                          sales.removeProductMaster("configProducts", p.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            {configProducts.length === 0 && (
              <li className="pm-empty">暂无单品，在右侧创建。</li>
            )}
          </ul>
      </section>

      <section className="pm-col pm-form-col">
        <header className="pm-col-head">
          <h3>{editingId ? "编辑单品" : "新增单品"}</h3>
          <button className="pm-add" onClick={autoCode} disabled={!cat}>
            <Plus size={15} /> 生成编码
          </button>
        </header>

        <div className="pm-inline-form">
          <label>
            所属大类
            <select
              value={activeCategoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setDraftComps([]);
              }}
            >
              <option value="">请选择</option>
              {categories.sort(bySort).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}（{c.code}）
                </option>
              ))}
            </select>
          </label>
          <label>
            名称
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 1.8m 黑胡桃圆餐桌" />
          </label>
          <label>
            编码
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SP-CT-001" />
          </label>
          <label>
            详情 / 卖点
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </label>
          <div className="pm-form-grid-3">
            <label>
              风格
              <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="意式极简" />
            </label>
            <label>
              系列
              <input value={series} onChange={(e) => setSeries(e.target.value)} placeholder="五福沙发" />
            </label>
            <label>
              适用空间
              <input value={applicableSpace} onChange={(e) => setApplicableSpace(e.target.value)} placeholder="客厅，餐厅" />
            </label>
          </div>
          <div className="pm-form-grid-3">
            <label>
              排序
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </label>
            <label>
              增减价
              <input type="number" value={adjustPrice} onChange={(e) => setAdjustPrice(Number(e.target.value))} />
            </label>
            <label>
              状态
              <select value={status} onChange={(e) => setStatus(e.target.value as "上架" | "下架")}>
                <option value="上架">上架</option>
                <option value="下架">下架</option>
              </select>
            </label>
          </div>

          <div className="pm-components-block">
            <div className="pm-block-head">
              <span>组合模板（主件 + 规格约束）</span>
              <button className="pm-add-mini" onClick={addDraftComponent} disabled={!catComponents.length}>
                + 加主件
              </button>
            </div>
            {draftComps.map((d, idx) => {
              const comp = components.find((c) => c.id === d.componentId);
              return (
                <div className="pm-draft-comp" key={idx}>
                  <div className="pm-draft-comp-head">
                    <select
                      value={d.componentId}
                      onChange={(e) => changeComponent(idx, e.target.value)}
                    >
                      {compSeriesGroups.map((g) => (
                        <optgroup key={g.seriesId} label={g.seriesName}>
                          {g.comps.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}（{c.code}）
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <label className="pm-qty">
                      数量
                      <input
                        type="number"
                        value={d.quantity}
                        onChange={(e) =>
                          updateDraftComponent(idx, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="pm-opt">
                      <input
                        type="checkbox"
                        checked={d.optional}
                        onChange={(e) =>
                          updateDraftComponent(idx, { optional: e.target.checked })
                        }
                      />
                      可选
                    </label>
                    <button className="pm-del" onClick={() => setDraftComps((l) => l.filter((_, i) => i !== idx))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {comp && (
                    <div className="pm-dims">
                      {comp.specDims.map((dim) => {
                        const ctrl = d.controls[dim.name] ?? {
                          mode: "any" as DimMode,
                          value: "",
                          allowed: "",
                        };
                        return (
                          <div className="pm-dim-edit" key={dim.id}>
                            <span className="pm-dim-name">{dim.name}</span>
                            <select
                              value={ctrl.mode}
                              onChange={(e) => setDimMode(idx, dim.name, e.target.value as DimMode)}
                            >
                              <option value="any">全部开放</option>
                              <option value="lock">锁定</option>
                              <option value="open">开放取值</option>
                            </select>
                            {ctrl.mode === "lock" && (
                              <select value={ctrl.value} onChange={(e) => setDimValue(idx, dim.name, e.target.value)}>
                                <option value="">选择</option>
                                {dim.values.map((v) => (
                                  <option key={v} value={v}>
                                    {v}
                                  </option>
                                ))}
                              </select>
                            )}
                            {ctrl.mode === "open" && (
                              <input
                                value={ctrl.allowed}
                                onChange={(e) => setDimAllowed(idx, dim.name, e.target.value)}
                                placeholder={dim.values.join(",")}
                              />
                            )}
                          </div>
                        );
                      })}
                      {comp.specDims.length === 0 && (
                        <small className="pm-muted">该主件无规格维度</small>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {draftComps.length === 0 && (
              <p className="pm-muted">尚未添加主件。先选大类，再点「加主件」。</p>
            )}
          </div>

          {previewRange && (
            <div className="pm-price-preview">
              标准价预览：
              <b>{formatPriceRange(previewRange)}</b>
              {previewRange.unresolved.length > 0 && (
                <small className="pm-warn">
                  （{previewRange.unresolved.length} 个主件暂无可匹配的最小单位，需先在「组件与成本」建 SKU）
                </small>
              )}
            </div>
          )}

          {preview && (
            <div className="pm-sku-preview">
              <div className="pm-block-head">
                <span>已匹配 SKU 预览（共 {preview.components.reduce((n, c) => n + componentSkuOptions(skuUnits, c).length, 0)} 条）</span>
              </div>
              {preview.components.map((comp) => {
                const compInfo = components.find((c) => c.id === comp.componentId);
                const options = componentSkuOptions(skuUnits, comp);
                return (
                  <div key={comp.componentId} className="pm-sku-preview-row">
                    <b>{compInfo?.name ?? comp.componentId}</b>
                    {options.length === 0 ? (
                      <small className="pm-warn">未匹配到 SKU（请先在「组件与成本」创建该主件的最小单位）</small>
                    ) : (
                      <small>
                        {options.slice(0, 5).map((u) => `${u.sku}(${specSummary(u.specValues)})`).join("、")}
                        {options.length > 5 && ` 等 ${options.length} 条`}
                      </small>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="pm-media-section">
            <div className="pm-block-head">
              <span>
                <ImageIcon size={15} /> 媒体与资料
              </span>
            </div>
            {MEDIA_FIELDS.map((f) => (
              <div className="pm-media-field" key={f.key}>
                <MediaUploader
                  ownerId={editingId ?? "new-config-product"}
                  label={f.label}
                  hint={f.hint}
                  value={fieldFiles(media, f.key)}
                  onChange={(files) =>
                    setMedia((m) => ({ ...m, [f.key]: files }))
                  }
                />
              </div>
            ))}
            <label className="pm-quality">
              质检标准（含水率、色差、结构标准）
              <textarea
                value={media.qualityStandard ?? ""}
                onChange={(e) => setMedia((m) => ({ ...m, qualityStandard: e.target.value }))}
                rows={2}
              />
            </label>
          </div>

          <div className="pm-form-actions">
            <button className="pm-primary" onClick={submit}>
              {editingId ? "保存修改" : "创建单品"}
            </button>
            <button onClick={resetForm}>清空</button>
          </div>
        </div>
      </section>
    </div>
  );
}
