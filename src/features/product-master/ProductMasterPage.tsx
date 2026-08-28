import { useState, type ReactNode } from "react";
import { Layers, Boxes, Package, SlidersHorizontal, ClipboardList, FileSpreadsheet } from "lucide-react";
import { useRoleAccess } from "../../features/team";
import { CategoryComponentTab } from "./tabs/CategoryComponentTab";
import { ConfigProductTab } from "./tabs/ConfigProductTab";
import { PackageTab } from "./tabs/PackageTab";
import { ComponentCostTab } from "./tabs/ComponentCostTab";
import { InventoryLedgerTab } from "./tabs/InventoryLedgerTab";
import { MasterImportDialog } from "./MasterImportDialog";
import "./product-master.css";

type TabKey = "cat" | "config" | "package" | "cost" | "ledger";

export function ProductMasterPage() {
  const access = useRoleAccess();
  const canViewCost = access.can("cost.view");
  const [tab, setTab] = useState<TabKey>("cat");
  const [importing, setImporting] = useState(false);

  const tabs: { key: TabKey; label: string; icon: ReactNode; costOnly?: boolean }[] = [
    { key: "cat", label: "品类与主件", icon: <Layers size={16} /> },
    { key: "config", label: "单品配置", icon: <Boxes size={16} /> },
    { key: "package", label: "套餐配置", icon: <Package size={16} /> },
    { key: "cost", label: "组件与成本", icon: <SlidersHorizontal size={16} />, costOnly: true },
    { key: "ledger", label: "库存台账", icon: <ClipboardList size={16} /> },
  ];
  const visibleTabs = tabs.filter((t) => !t.costOnly || canViewCost);

  return (
    <main className="pm-page">
      <header className="pm-page-head">
        <div>
          <p>尚品居经营系统</p>
          <h1>产品主数据</h1>
          <span>大类 → 主件 → 最小单位 → 单品 → 套餐，老板手工精选配置；员工只看到成品</span>
        </div>
        <button className="pm-import-btn" onClick={() => setImporting(true)}>
          <FileSpreadsheet size={15} /> 批量导入
        </button>
      </header>

      <nav className="pm-tabs" aria-label="产品主数据功能">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "active" : ""}
            onClick={() => setTab(t.key)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>

      <div className="pm-content">
        {tab === "cat" && <CategoryComponentTab />}
        {tab === "config" && <ConfigProductTab />}
        {tab === "package" && <PackageTab />}
        {tab === "cost" && <ComponentCostTab canViewCost={canViewCost} />}
        {tab === "ledger" && <InventoryLedgerTab canViewCost={canViewCost} />}
      </div>

      {importing && <MasterImportDialog onClose={() => setImporting(false)} />}
    </main>
  );
}
