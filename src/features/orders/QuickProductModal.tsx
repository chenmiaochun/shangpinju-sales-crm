import { useState } from "react";
import { X } from "lucide-react";
import type { OrderItem } from "../../types";

type Props = {
  onClose: () => void;
  onConfirm: (item: OrderItem) => void;
};

// 测试期销售自行录入：一次性 OrderItem，不进 configProducts/sku 列表，
// 店长后续可在订单详情或产品主数据里补录成正式单品。
export function QuickProductModal({ onClose, onConfirm }: Props) {
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [unitPrice, setUnitPrice] = useState<number | "">("");
  const [material, setMaterial] = useState("北美黑胡桃木");
  const [unit, setUnit] = useState("件");
  const [note, setNote] = useState("");
  const validPrice = typeof unitPrice === "number" && unitPrice >= 0;
  const canSubmit = name.trim().length > 0 && validPrice;
  const submit = () => {
    if (!canSubmit) return;
    const id = `tmp-item-${Date.now()}`;
    onConfirm({
      id,
      sku: id,
      productName: name.trim(),
      specification: spec.trim() || undefined,
      quantity: 1,
      unit: unit.trim() || "件",
      unitPrice: typeof unitPrice === "number" ? unitPrice : 0,
      supplyType: "定制生产",
      material: material.trim() || undefined,
      lineNote: note.trim() || undefined,
      attachments: [],
      isTemporary: true,
    } as OrderItem & { isTemporary?: boolean });
  };
  return (
    <div className="config-picker-backdrop" role="dialog" aria-modal="true" aria-label="添加临时产品">
      <section className="quick-modal">
        <header>
          <div>
            <b>添加临时产品</b>
            <small>测试期快速补录：直接在销售单里出现一次，不进产品主库；店长后续统一清洗</small>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="quick-modal-body">
          <label>
            <span>产品名称 *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：玄关边几（圆形）" autoFocus />
          </label>
          <div className="quick-modal-row">
            <label>
              <span>规格</span>
              <input value={spec} onChange={(e) => setSpec(e.target.value)} placeholder="如：直径 600×高 500mm" />
            </label>
            <label>
              <span>单位</span>
              <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="件 / 套 / 把" />
            </label>
          </div>
          <label>
            <span>单价 (¥) *</span>
            <input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" />
          </label>
          <label>
            <span>材质</span>
            <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="如：北美黑胡桃木" />
          </label>
          <label>
            <span>备注</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="本单特殊说明（如仅此一件样品）" />
          </label>
        </div>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="primary" disabled={!canSubmit} onClick={submit}>
            加入销售单
          </button>
        </footer>
      </section>
    </div>
  );
}
