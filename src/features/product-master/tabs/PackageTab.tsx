import { useMemo, useState } from "react";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";
import type {
  ConfigProduct,
  MediaFile,
  PackageItem,
  ProductMedia,
  ProductPackage,
} from "../../../types";
import { useSalesData } from "../../../store/SalesDataContext";
import {
  ensureUniqueCode,
  generatePackageCode,
  packagePriceRange,
} from "../../../utils/product-config";
import { bySort, formatPriceRange, newId } from "../pm-utils";
import { MediaUploader } from "../MediaUploader";

interface DraftItem {
  productId: string;
  quantity: number;
  quantityOptionsText: string;
  optional: boolean;
}

const MEDIA_FIELDS: { key: keyof ProductMedia; label: string; hint?: string }[] = [
  { key: "images", label: "主图 / 套餐图", hint: "第一张作为主图" },
  { key: "dimensionImages", label: "尺寸图" },
  { key: "materialImages", label: "材质图" },
  { key: "colorImages", label: "颜色图" },
  { key: "installationDoc", label: "安装说明" },
  { key: "careDoc", label: "保养说明" },
  { key: "manualFiles", label: "手册 / 附件" },
];

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

function fieldFiles(m: ProductMedia, key: keyof ProductMedia): MediaFile[] {
  const v = m[key];
  return Array.isArray(v) ? (v as MediaFile[]) : [];
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

export function PackageTab() {
  const sales = useSalesData();
  const configProducts = sales.configProducts ?? [];
  const skuUnits = sales.skuUnits ?? [];
  const packages = sales.productPackages ?? [];

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [adjustPrice, setAdjustPrice] = useState(0);
  const [status, setStatus] = useState<"上架" | "下架">("上架");
  const [media, setMedia] = useState<ProductMedia>(emptyMedia());
  const [items, setItems] = useState<DraftItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function addItem() {
    const p = configProducts[0];
    if (!p) return;
    setItems((list) => [
      ...list,
      { productId: p.id, quantity: 1, quantityOptionsText: "", optional: false },
    ]);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function buildPackage(): ProductPackage {
    const builtItems: PackageItem[] = items
      .filter((it) => it.productId)
      .map((it) => {
        const opts = it.quantityOptionsText
          .split(/[,，]/)
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v) && v > 0);
        return {
          productId: it.productId,
          quantity: it.quantity,
          quantityOptions: opts.length ? opts : undefined,
          optional: it.optional,
        };
      });
    return {
      id: editingId ?? newId(),
      name: name || "未命名套餐",
      code: code || "TC-001",
      sortOrder,
      adjustPrice,
      status,
      media: hasMedia(media) ? media : undefined,
      items: builtItems,
    };
  }

  const preview = useMemo<ProductPackage | null>(() => {
    if (items.length === 0) return null;
    return buildPackage();
  }, [name, code, items, adjustPrice, sortOrder, status, media, editingId]);

  const previewRange = preview
    ? packagePriceRange(preview, configProducts, skuUnits)
    : null;

  function autoCode() {
    const suggested = generatePackageCode(packages.map((p) => p.code));
    setCode(ensureUniqueCode(suggested, packages.map((p) => p.code)));
  }

  function resetForm() {
    setName("");
    setCode("");
    setSortOrder(0);
    setAdjustPrice(0);
    setStatus("上架");
    setMedia(emptyMedia());
    setItems([]);
    setEditingId(null);
  }

  function submit() {
    if (items.length === 0) return;
    if (!code.trim()) autoCode();
    const pkg = buildPackage();
    if (editingId) sales.updateProductMaster("productPackages", editingId, { ...pkg });
    else sales.addProductMaster("productPackages", pkg);
    resetForm();
  }

  function loadForEdit(pkg: ProductPackage) {
    setEditingId(pkg.id);
    setName(pkg.name);
    setCode(pkg.code);
    setSortOrder(pkg.sortOrder);
    setAdjustPrice(pkg.adjustPrice);
    setStatus(pkg.status);
    setMedia(pkg.media ?? emptyMedia());
    setItems(
      pkg.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        quantityOptionsText: (it.quantityOptions ?? []).join(","),
        optional: it.optional ?? false,
      })),
    );
  }

  const productName = (id: string) =>
    configProducts.find((p) => p.id === id)?.name ?? "（未选择）";

  return (
    <div className="pm-two-col">
      <section className="pm-col">
        <header className="pm-col-head">
          <h3>套餐列表</h3>
        </header>
        <ul className="pm-list">
          {packages
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((pkg) => (
              <li key={pkg.id}>
                <div>
                  <b>{pkg.name}</b>
                  <small>
                    {pkg.code} · {pkg.items.length} 个单品 · {pkg.status}
                  </small>
                </div>
                <div className="pm-row-actions">
                  <button className="pm-link" onClick={() => loadForEdit(pkg)}>
                    编辑
                  </button>
                  <button
                    className="pm-del"
                    aria-label={`删除 ${pkg.name}`}
                    onClick={() => {
                      if (confirm(`确认删除套餐「${pkg.name}」？`))
                        sales.removeProductMaster("productPackages", pkg.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          {packages.length === 0 && (
            <li className="pm-empty">暂无套餐，在右侧创建。</li>
          )}
        </ul>
      </section>

      <section className="pm-col pm-form-col">
        <header className="pm-col-head">
          <h3>{editingId ? "编辑套餐" : "新增套餐"}</h3>
          <button className="pm-add" onClick={autoCode}>
            <Plus size={15} /> 生成编码
          </button>
        </header>
        <div className="pm-inline-form">
          <label>
            套餐名称
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如 餐厅套系" />
          </label>
          <label>
            编码
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="TC-001" />
          </label>
          <div className="pm-form-grid-3">
            <label>
              排序
              <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </label>
            <label>
              套餐增减价
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
              <span>套餐内容（单品组合）</span>
              <button className="pm-add-mini" onClick={addItem} disabled={!configProducts.length}>
                + 加单品
              </button>
            </div>
            {items.map((it, idx) => (
              <div className="pm-draft-comp" key={idx}>
                <div className="pm-draft-comp-head">
                  <select
                    value={it.productId}
                    onChange={(e) => updateItem(idx, { productId: e.target.value })}
                  >
                    {configProducts
                      .slice()
                      .sort((a: ConfigProduct, b: ConfigProduct) => a.sortOrder - b.sortOrder)
                      .map((p: ConfigProduct) => (
                      <option key={p.id} value={p.id}>
                        {p.name}（{p.code}）
                      </option>
                    ))}
                  </select>
                  <label className="pm-qty">
                    数量
                    <input
                      type="number"
                      value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                    />
                  </label>
                  <label className="pm-opt">
                    <input
                      type="checkbox"
                      checked={it.optional}
                      onChange={(e) => updateItem(idx, { optional: e.target.checked })}
                    />
                    可选
                  </label>
                  <button className="pm-del" onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <label className="pm-qty-options">
                  可选数量（逗号分隔，如 4,6）
                  <input
                    value={it.quantityOptionsText}
                    onChange={(e) => updateItem(idx, { quantityOptionsText: e.target.value })}
                    placeholder="4,6"
                  />
                </label>
              </div>
            ))}
            {items.length === 0 && (
              <p className="pm-muted">尚未添加单品。需先在「单品配置」建好单品。</p>
            )}
          </div>

          {previewRange && (
            <div className="pm-price-preview">
              套餐价预览：
              <b>{formatPriceRange(previewRange)}</b>
              {previewRange.unresolved.length > 0 && (
                <small className="pm-warn">
                  （{previewRange.unresolved.length} 个单品暂无可定价组合）
                </small>
              )}
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
                  ownerId={editingId ?? "new-package"}
                  label={f.label}
                  hint={f.hint}
                  value={fieldFiles(media, f.key)}
                  onChange={(files) => setMedia((m) => ({ ...m, [f.key]: files }))}
                />
              </div>
            ))}
            <label className="pm-quality">
              质检标准
              <textarea
                value={media.qualityStandard ?? ""}
                onChange={(e) => setMedia((m) => ({ ...m, qualityStandard: e.target.value }))}
                rows={2}
              />
            </label>
          </div>

          <div className="pm-form-actions">
            <button className="pm-primary" onClick={submit}>
              {editingId ? "保存修改" : "创建套餐"}
            </button>
            <button onClick={resetForm}>清空</button>
          </div>
        </div>
      </section>
    </div>
  );
}
