// 订单页产品库优化 数据修复
// 用途：
//   1. 清掉 Server state.products 里的 6 个 demo 商品（spj-living-set-01 等）
//   2. 修 configProducts[].series 字段：原 bridge 脚本填成了品类名（错），应该填真实系列名
//      解析路径：skuUnit.componentId → component.seriesId → series.name
//      兜底：组件无 seriesId 时用「其他」这个 builtin 系列名
// 幂等：重跑若 products 已是 [] 且 series 已正确解出，会原地跳过
// 用法：先停 3001 服务，node scripts/fix-order-page-data.cjs [--dry]
const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");
const db = new DatabaseSync(path.join(ROOT, "server/data/sales.sqlite"));
const row = db.prepare("SELECT value FROM app_state WHERE id = 1").get();
const state = JSON.parse(row.value);

if (!DRY) {
  const dir = path.join(ROOT, "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const backupFile = path.join(dir, `sales-backup-${ts}-before-order-page-fix.json`);
  fs.writeFileSync(backupFile, row.value, "utf8");
  console.log("备份:", path.basename(backupFile));
}

const DEMO_IDS = new Set([
  "spj-living-set-01",
  "spj-sofa-01",
  "spj-sideboard-01",
  "spj-dining-table-01",
  "spj-coffee-table-01",
  "spj-mattress-01",
]);

// ——— 1. 清掉 demo products
const before = state.products?.length ?? 0;
state.products = (state.products ?? []).filter((p) => !DEMO_IDS.has(p.id));
const after = state.products.length;
console.log(`products: ${before} -> ${after}（移除了 ${before - after} 条 demo）`);

// ——— 2. 修 configProducts[].series 字段
const compById = new Map((state.components ?? []).map((c) => [c.id, c]));
const seriesById = new Map((state.series ?? []).map((s) => [s.id, s]));
const skuById = new Map((state.skuUnits ?? []).map((u) => [u.id, u]));

// 找到 builtin 「其他」系列（每个品类下都有一份）
const fallbackSeriesByCat = {};
for (const s of state.series ?? []) {
  if (s.name === "其他") fallbackSeriesByCat[s.categoryId] = s.name;
}

let seriesSet = 0, seriesSkipped = 0, fallbackUsed = 0, unresolved = 0;
for (const cp of state.configProducts ?? []) {
  const sku = skuById.get(cp.id);
  if (!sku) { unresolved++; continue; }
  const comp = compById.get(sku.componentId);
  if (!comp) { unresolved++; continue; }

  let newSeries = "";
  if (comp.seriesId) {
    const s = seriesById.get(comp.seriesId);
    newSeries = s?.name ?? "";
  }
  if (!newSeries) {
    // 兜底：本品类的「其他」系列名
    newSeries = fallbackSeriesByCat[comp.categoryId] ?? "其他";
    fallbackUsed++;
  } else {
    seriesSet++;
  }
  if (cp.series !== newSeries) {
    cp.series = newSeries;
  } else {
    seriesSkipped++;
  }
}

console.log(`configProducts.series: 重写 ${seriesSet}, 跳过(已正确) ${seriesSkipped}, 兜底「其他」 ${fallbackUsed}, 无法解析 ${unresolved}`);

// 统计最终分布
const dist = {};
for (const cp of state.configProducts ?? []) {
  const cat = state.categories.find((c) => c.id === cp.categoryId);
  const key = `${cat?.name ?? "?"}/${cp.series ?? "其他"}`;
  dist[key] = (dist[key] || 0) + 1;
}
console.log("最终 品类/系列 分布（top 20）:");
const sortedDist = Object.entries(dist).sort((a, b) => b[1] - a[1]).slice(0, 20);
for (const [k, v] of sortedDist) console.log("  " + k + ": " + v);

if (!DRY) {
  db.prepare("UPDATE app_state SET value = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(state), new Date().toISOString());
  console.log("✅ 已写入数据库");
}
db.close();
