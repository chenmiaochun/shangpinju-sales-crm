// 产品主数据 → 订单页 configProducts 桥接脚本
// 用途：飞书 4.7 导入只填了 categories/series/components/skuUnits，订单页的
//       「产品库单品」tab 读 configProducts，所以这里为每个 SKU 生成 1 个
//       configProduct（1:1，1 个 component 槽位 + 锁定规格）。
// 幂等：按 skuUnit.id 作为 configProduct.id，重跑自动跳过已存在的。
// 用法：先停 3001 服务，再 node scripts/bridge-config-products.cjs [--dry]
const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DRY = process.argv.includes("--dry");
const db = new DatabaseSync(path.join(ROOT, "server/data/sales.sqlite"));
const row = db.prepare("SELECT value FROM app_state WHERE id = 1").get();
const state = JSON.parse(row.value);

const compById = new Map(state.components.map((c) => [c.id, c]));
const catById = new Map(state.categories.map((c) => [c.id, c]));

const existingById = new Set((state.configProducts || []).map((cp) => cp.id));

// 备份（仅当非干跑时）
if (!DRY) {
  const dir = path.join(ROOT, "backups");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const backupFile = path.join(dir, `sales-backup-${ts}-before-config-bridge.json`);
  fs.writeFileSync(backupFile, row.value, "utf8");
  console.log("备份:", path.basename(backupFile));
}

let added = 0, skipped = 0, unresolved = 0;
const next = [...(state.configProducts || [])];

for (const u of state.skuUnits) {
  if (existingById.has(u.id)) { skipped++; continue; }
  const comp = compById.get(u.componentId);
  if (!comp) { unresolved++; continue; }
  const specLabels = Object.entries(u.specValues || {}).map(([, v]) => v).filter(Boolean);
  const name = specLabels.length ? `${comp.name}·${specLabels.join("/")}` : comp.name;
  const category = catById.get(comp.categoryId);
  const cp = {
    id: u.id,
    categoryId: comp.categoryId,
    name,
    code: u.sku,
    sortOrder: comp.sort ?? 0,
    components: [
      {
        componentId: u.componentId,
        quantity: 1,
        optional: false,
        locked: u.specValues || {},
      },
    ],
    adjustPrice: 0,
    status: u.status === "上架" ? "上架" : "下架",
    // 派系列标签从品类 code 派生（便于卡片分组显示）
    series: category ? `${category.name}` : undefined,
  };
  next.push(cp);
  added++;
}

console.log(`新增: ${added}  跳过(已存在): ${skipped}  跳过(无 component): ${unresolved}`);
console.log("桥接后: configProducts 总数 =", next.length);
console.log("守卫: components=", state.components.length, "skuUnits=", state.skuUnits.length, "categories=", state.categories.length);

if (!DRY) {
  state.configProducts = next;
  db.prepare("UPDATE app_state SET value = ?, updated_at = ? WHERE id = 1")
    .run(JSON.stringify(state), new Date().toISOString());
  console.log("✅ 已写入数据库");
}
db.close();
