import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  activeUser: string;
  onClose: () => void;
  onConfirm: (customer: { id: string; name: string; phone: string; cityArea: string; stage: string; intent: "高" | "中" | "低"; expectedAmount: number; products: string[]; style: string; budget: string; renovationProgress: string; concerns: string[]; salesperson: string; source: string; createdAt: string; lastContactAt: string; createdBy: string; updatedAt: string }) => void;
};

// 测试阶段销售自行录入的最小可用客户骨架。其他可选字段先不填，店长后续补全。
export function QuickCustomerModal({ activeUser, onClose, onConfirm }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cityArea, setCityArea] = useState("");
  const canSubmit = name.trim().length > 0 && phone.trim().length > 0;
  const submit = () => {
    if (!canSubmit) return;
    const now = new Date().toISOString();
    onConfirm({
      id: `cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      cityArea: cityArea.trim(),
      stage: "已成交",
      intent: "高",
      expectedAmount: 0,
      products: [],
      style: "",
      budget: "",
      renovationProgress: "",
      concerns: [],
      salesperson: activeUser,
      source: "销售开单临时录入",
      createdAt: now,
      lastContactAt: now,
      createdBy: activeUser,
      updatedAt: now,
    });
  };
  return (
    <div className="config-picker-backdrop" role="dialog" aria-modal="true" aria-label="新建临时客户">
      <section className="quick-modal">
        <header>
          <div>
            <b>新建临时客户</b>
            <small>测试期自助录入，仅必填姓名/手机/送货地址；后续可在「客户管理」补全</small>
          </div>
          <button type="button" aria-label="关闭" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="quick-modal-body">
          <label>
            <span>客户姓名 *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：王先生 / 李姐" autoFocus />
          </label>
          <label>
            <span>手机号 *</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11位手机号" inputMode="numeric" />
          </label>
          <label>
            <span>送货地址</span>
            <input value={cityArea} onChange={(e) => setCityArea(e.target.value)} placeholder="完整送货地址（街道/小区/楼号）" />
          </label>
          <p className="quick-modal-note">跟单人将记为「{activeUser}」，可保存后再到「客户管理」补客户备注/装修进度等。</p>
        </div>
        <footer>
          <button type="button" onClick={onClose}>取消</button>
          <button type="button" className="primary" disabled={!canSubmit} onClick={submit}>
            保存并选为当前客户
          </button>
        </footer>
      </section>
    </div>
  );
}
