// 清除测试数据：订单10 / 客户11 / 配置品6 + 连带（售后单1 / 套餐1 / 库存记录2）
// 按 2026-08-29 备份（sales-backup-2026-08-28-23-36-before-purge-test.json）中的精确 ID 删除，幂等可重跑。
// 用法：先停 3001 服务，再执行 node scripts/purge-test-data.cjs [--dry]
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");

const TARGETS = {
  orders: [
    "order-1787920645847", "order-1787850088402", "order-1787850040171", "order-1787849947604",
    "order-1787849825891", "order-1787821899464", "order-1787820848644", "order-1787753046333",
    "order-1787705334313", "order-1787587262118",
  ],
  customers: [
    "lead-1787920568553", "lead-1787586427492", "lead-1787586963451", "lead-1787586408947",
    "lead-1787118169984", "lead-1785381986207", "c1", "c2", "c3", "c4", "c5",
  ],
  configProducts: [
    "89401f17-6638-45ff-9b07-416b6fb1807b", "b87af454-2901-42fa-ae76-4a7ff991b249",
    "ed3a6800-db13-4025-a754-871b4f8c28a4", "f9dd81cd-4d2c-4d68-b340-8e06ba645176",
    "a4f2c8f4-b2f7-48a7-a225-a3dbb15854b7", "3cc21857-d019-4670-bd8b-bbebf888951f",
  ],
  afterSalesTickets: ["ticket-1787591984627"],
  productPackages: ["cf578413-898d-47a3-a8cf-2184a6a1b252"],
};

// 库存记录无独立 id，按 productId 精确过滤
const STOCK_PRODUCT_IDS = new Set(["spj-dining-table-01", "spj-coffee-table-01"]);

const db = new DatabaseSync(path.join(ROOT, "server/data/sales.sqlite"));
const row = db.prepare("SELECT value FROM app_state WHERE id = 1").get();
const state = JSON.parse(row.value);

console.log("删除前计数:", Object.keys(TARGETS).map(k => `${k}=${(state[k] || []).length}`).join(", "),
  `warehouseStocks=${(state.warehouseStocks || []).length}`);

const report = {};
for (const [key, ids] of Object.entries(TARGETS)) {
  const before = state[key] || [];
  const removed = before.filter(item => ids.includes(item.id));
  const kept = before.filter(item => !ids.includes(item.id));
  report[key] = { removed: removed.length, kept: kept.length, 疑似漏网: before.filter(item => !ids.includes(item.id) && ids.length ? 0 : 0).length };
  state[key] = kept;
  console.log(`${key}: 删 ${removed.length} 条，保留 ${kept.length} 条`);
  // 校验：目标 id 是否全部命中（防止库里 id 已变化导致漏删）
  const missed = ids.filter(id => !before.some(item => item.id === id));
  if (missed.length) console.log(`  ⚠️ 未匹配到（可能已删除）: ${missed.join(", ")}`);
}

const stocksBefore = state.warehouseStocks || [];
const stocksKept = stocksBefore.filter(item => !STOCK_PRODUCT_IDS.has(item.productId));
console.log(`warehouseStocks: 删 ${stocksBefore.length - stocksKept.length} 条，保留 ${stocksKept.length} 条`);
state.warehouseStocks = stocksKept;

// 保护性断言：产品主数据（导入成果）不得被触碰
const guard = { categories: state.categories.length, series: state.series.length, components: state.components.length, skuUnits: state.skuUnits.length };
console.log("产品主数据守卫（应不变）:", JSON.stringify(guard));

if (DRY) {
  console.log("— 干跑模式，未写入 —");
} else {
  db.prepare("UPDATE app_state SET value = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(state), new Date().toISOString());
  console.log("✅ 已写入数据库");
}
db.close();
