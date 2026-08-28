// 用前端同一份 master-import.ts 逻辑解析 Excel 并通过服务端 API 导入
// 用法: node scripts/feishu-import/import-via-api.cjs           (干跑，只打印预览)
//       node scripts/feishu-import/import-via-api.cjs --apply   (实际写入)
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "../..");
const jitiFactory = require(path.join(ROOT, "node_modules/.pnpm/jiti@2.7.0/node_modules/jiti"));
const APPLY = process.argv.includes("--apply");
const XLSX_PATH = path.join(ROOT, "artifacts", "飞书整品导入_2026-08-29.xlsx");
const API = "http://localhost:3001";
const HDRS = { "content-type": "application/json", origin: "http://localhost:5173" };
const ADMIN = {
  username: process.env.IMPORT_USER || "admin",
  password: process.env.IMPORT_PASS || "AcceptTest-2026",
};

async function main() {
  // 1) 加载前端真实模块
  const jiti = jitiFactory(__dirname, { interopDefault: true });
  const { readMasterFile } = jiti(path.join(ROOT, "src/features/product-master/master-import.ts"));

  // 2) 读当前服务端 state（只读 SQLite，避免干扰运行中的服务）
  const db = new DatabaseSync(path.join(ROOT, "server/data/sales.sqlite"), { readOnly: true });
  const current = JSON.parse(db.prepare("SELECT value FROM app_state WHERE id = 1").get().value);
  db.close();

  // 3) 用 File shim 走 readMasterFile（与 UI 上传完全同一条解析链路）
  const buf = fs.readFileSync(XLSX_PATH);
  const file = {
    name: path.basename(XLSX_PATH),
    text: async () => buf.toString("utf8"),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
  const result = await readMasterFile(file, {
    categories: current.categories ?? [],
    series: current.series ?? [],
    skuUnits: current.skuUnits ?? [],
  });

  console.log("== 解析预览 ==");
  console.log(JSON.stringify(result.summary));
  if (result.skipped.length) console.log("跳过:", JSON.stringify(result.skipped));
  if (result.errors.length) {
    console.log("错误(前20):", JSON.stringify(result.errors.slice(0, 20)));
  }
  console.log("现有: 品类", (current.categories ?? []).length, "系列", (current.series ?? []).length,
    "主件", (current.components ?? []).length, "SKU", (current.skuUnits ?? []).length);

  if (!APPLY) { console.log("(干跑结束，未写入。加 --apply 执行导入)"); return; }
  if (result.errors.length > 0) { console.error("!! 有解析错误，拒绝写入"); process.exit(1); }

  // 4) 登录拿会话
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: HDRS,
    body: JSON.stringify(ADMIN),
  });
  if (!loginRes.ok) throw new Error("登录失败: " + loginRes.status);
  const cookie = loginRes.headers.get("set-cookie").split(";")[0];

  // 5) 导入前备份
  const backup = await (await fetch(`${API}/api/backup`, { headers: { ...HDRS, cookie } })).json();
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const backupPath = path.join(ROOT, "backups", `sales-backup-${stamp}-before-feishu-import.json`);
  fs.writeFileSync(backupPath, JSON.stringify(backup));
  console.log("导入前备份:", backupPath, fs.statSync(backupPath).size, "bytes");

  // 6) GET 最新 state → 按 importProductMaster 语义合并（新数据前插）→ PUT
  const remote = (await (await fetch(`${API}/api/state`, { headers: { ...HDRS, cookie } })).json());
  const state = remote.value;
  const merged = {
    ...state,
    categories: [...result.categories, ...(state.categories ?? [])],
    series: [...result.series, ...(state.series ?? [])],
    components: [...result.components, ...(state.components ?? [])],
    skuUnits: [...result.skuUnits, ...(state.skuUnits ?? [])],
  };
  const putRes = await fetch(`${API}/api/state`, {
    method: "PUT",
    headers: { ...HDRS, cookie },
    body: JSON.stringify(merged),
  });
  if (!putRes.ok) throw new Error("PUT 失败: " + putRes.status + " " + await putRes.text());
  console.log("PUT ok");

  // 7) 复核
  const after = (await (await fetch(`${API}/api/state`, { headers: { ...HDRS, cookie } })).json()).value;
  console.log("== 导入后 ==");
  console.log("品类", after.categories.length, "系列", after.series.length,
    "主件", after.components.length, "SKU", after.skuUnits.length);
  const sample = after.skuUnits.find((s) => s.sku === "BD-EL-001");
  console.log("抽样 BD-EL-001:", JSON.stringify(sample));
}

main().catch((e) => { console.error(e); process.exit(1); });
