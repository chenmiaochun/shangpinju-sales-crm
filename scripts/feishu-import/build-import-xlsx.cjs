// 从飞书导出的 ndjson 生成整品导入 Excel（模板列序）
// 用法: node scripts/feishu-import/build-import-xlsx.cjs
const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const ROOT = path.resolve(__dirname, "../..");
const ART = path.join(ROOT, "artifacts");
const readNdjson = (f) =>
  fs.readFileSync(path.join(ART, f), "utf8").trim().split("\n").map((l) => JSON.parse(l));

const master = readNdjson("feishu-主档-175.ndjson");
const prices = readNdjson("feishu-价格策略-175.ndjson");

const first = (v) => (Array.isArray(v) ? (v.length ? String(v[0]) : "") : v == null ? "" : String(v));

// 价格策略按「编号」匹配主档「产品编号」
const priceByCode = new Map();
for (const p of prices) {
  const code = String(p["编号"] ?? "").trim();
  if (code) priceByCode.set(code, p);
}

const headers = ["品类", "基型编号", "产品名称", "产品编号", "尺寸(MM)", "材质", "吊牌价", "内部参考价", "产品状态", "系列"];
const rows = [];
let priceMiss = 0;
for (const m of master) {
  const sku = String(m["产品编号"] ?? "").trim();
  const p = priceByCode.get(sku);
  if (!p) { priceMiss++; }
  rows.push([
    first(m["品类"]),
    String(m["基型编号"] ?? ""),
    String(m["产品名称"] ?? ""),
    sku,
    String(m["尺寸(MM)"] ?? ""),
    first(m["材质"]),
    p ? Number(p["吊牌价"] ?? 0) : 0,
    p && p["内部参考价"] != null ? Number(p["内部参考价"]) : "",
    first(m["产品状态"]),
    first(m["系列"]),
  ]);
}

console.log("主档行数:", master.length, "价格行数:", prices.length, "价格未匹配:", priceMiss);

const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
sheet["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 4) }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, "整品导入");
const out = path.join(ART, "飞书整品导入_2026-08-29.xlsx");
XLSX.writeFile(wb, out);
console.log("已生成:", out, "行数:", rows.length);
