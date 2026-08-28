import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSalesData } from "../../store/SalesDataContext";
import {
  masterImportTemplateXlsx,
  readMasterFile,
  type MasterParseResult,
} from "./master-import";

export function MasterImportDialog({ onClose }: { onClose: () => void }) {
  const sales = useSalesData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<MasterParseResult | null>(null);
  const [parseError, setParseError] = useState("");
  const [imported, setImported] = useState(false);

  async function handleFile(file: File) {
    setParsing(true);
    setParseError("");
    setResult(null);
    try {
      const parsed = await readMasterFile(file, {
        categories: sales.categories ?? [],
        series: sales.series ?? [],
        skuUnits: sales.skuUnits ?? [],
      });
      setResult(parsed);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "解析失败");
    } finally {
      setParsing(false);
    }
  }

  function downloadTemplate() {
    const buf = masterImportTemplateXlsx();
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "尚品居整品导入模板.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  function confirmImport() {
    if (!result) return;
    sales.importProductMaster({
      categories: result.categories,
      series: result.series,
      components: result.components,
      skuUnits: result.skuUnits,
    });
    setImported(true);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal master-import" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>
            <FileSpreadsheet size={18} /> 批量导入主件与 SKU
          </h3>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="master-import-body">
          <p className="master-import-hint">
            支持飞书「尚品居产品数据库」导出的 Excel/CSV（整品粒度，一比一导入为 1 主件 + 1
            SKU）。供应方式默认「现货」、库存 0、状态「上架」；「系列」列自动匹配/新建系列，
            留空归「公共/其他」；非在售与重复记录自动跳过。
          </p>

          <div className="master-import-actions">
            <button
              className="pm-primary"
              onClick={() => fileRef.current?.click()}
              disabled={parsing}
            >
              <Upload size={15} /> {parsing ? "解析中…" : "选择 Excel/CSV 文件"}
            </button>
            <button className="pm-link" onClick={downloadTemplate}>
              下载导入模板
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {parseError && (
            <div className="pm-notice" role="alert">
              {parseError}
            </div>
          )}

          {result && (
            <div className="master-import-result">
              <div className="import-summary">
                <span className="import-stat">
                  <b>{result.summary.newCategoryCount}</b> 新建大类
                </span>
                <span className="import-stat">
                  <b>{result.summary.newSeriesCount}</b> 新建系列
                </span>
                <span className="import-stat">
                  <b>{result.summary.componentCount}</b> 主件
                </span>
                <span className="import-stat">
                  <b>{result.summary.skuCount}</b> SKU
                </span>
                <span className="import-stat skip">
                  <b>{result.summary.skippedCount}</b> 跳过
                </span>
                <span className="import-stat error">
                  <b>{result.summary.errorCount}</b> 错误
                </span>
              </div>

              {result.skipped.length > 0 && (
                <details className="import-detail">
                  <summary>跳过明细（{result.skipped.length}）</summary>
                  <ul>
                    {result.skipped.slice(0, 20).map((s) => (
                      <li key={s.sku}>
                        {s.sku} — {s.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {result.errors.length > 0 && (
                <details className="import-detail" open>
                  <summary>
                    <AlertTriangle size={14} /> 错误明细（{result.errors.length}）
                  </summary>
                  <ul>
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>
                        第 {e.row} 行：{e.messages.join("；")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {imported && (
            <div className="pm-notice ok" role="status">
              <CheckCircle2 size={15} /> 导入完成，已在「品类与主件 / 库存台账」查看。
            </div>
          )}
        </div>

        <footer className="modal-foot">
          {result && !imported ? (
            <button className="pm-primary" onClick={confirmImport}>
              {result.summary.errorCount > 0
                ? `导入有效行（忽略 ${result.summary.errorCount} 个错误）`
                : "确认导入"}
            </button>
          ) : (
            <button className="pm-primary" onClick={onClose}>
              关闭
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
