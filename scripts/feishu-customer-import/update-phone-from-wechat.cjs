// 把飞书「客户微信名」写入销售软件客户 phone 字段
// 占位符（未加微信/没加微信等）按老板要求删除 → phone 留空
// 用法: node update-phone-from-wechat.cjs          (干跑)
//       node update-phone-from-wechat.cjs --apply  (写入，自动备份)
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '../..');
const APPLY = process.argv.includes('--apply');
const dbPath = path.join(ROOT, 'server/data/sales.sqlite');

const rows = fs.readFileSync(path.join(__dirname, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const has = v => v != null && String(v).trim() !== '';

// 占位符识别：明确表示"没有微信"的值
const PLACEHOLDER_RE = /^(未|没|无|未加|没加|没有|未添加|未通过|不加)\s*(加)?\s*(微信|好友)$|^未加微信$|^没加微信$|^无微信$|^没有微信$/;
const EXPLICIT = new Set(['未加微信', '没加微信', '无微信', '没有微信', '未加', '没加', '无', '未添加微信']);
const isPlaceholder = v => {
  const s = String(v || '').trim();
  if (!s) return true;
  if (EXPLICIT.has(s)) return true;
  return PLACEHOLDER_RE.test(s);
};

// 先扫一遍所有微信名，列出将被判为占位符的值
const placeholderVals = new Map();
for (const r of rows) {
  if (!has(r['客户微信名'])) continue;
  const w = String(r['客户微信名']).trim();
  if (isPlaceholder(w)) placeholderVals.set(w, (placeholderVals.get(w) || 0) + 1);
}
console.log('== 判定为占位符的微信名 ==');
let phTotal = 0;
for (const [k, v] of [...placeholderVals].sort((a, b) => b[1] - a[1])) {
  console.log(`  「${k}」× ${v}`);
  phTotal += v;
}
console.log('  合计:', phTotal, '条 → 这些 phone 将留空');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 8000;');
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
const cs = state.customers ?? [];

const wxByRid = new Map();
for (const r of rows) {
  if (has(r['客户微信名'])) wxByRid.set(r.record_id, String(r['客户微信名']).trim());
}

let setPhone = 0, cleared = 0, noWx = 0, skipped = 0;
for (const c of cs) {
  if (!String(c.leadId || '').startsWith('FS-')) { skipped++; continue; }
  const rid = String(c.id).replace('cust-fs-', '');
  const wx = wxByRid.get(rid);
  if (!has(wx)) { c.phone = ''; noWx++; continue; }
  if (isPlaceholder(wx)) { c.phone = ''; cleared++; continue; }
  c.phone = wx;
  setPhone++;
}

console.log('\n== 处理统计 ==');
console.log('  写入微信名到 phone:', setPhone);
console.log('  占位符已删除(留空):', cleared);
console.log('  原本无微信名(留空):', noWx);
console.log('  非飞书客户(未动):', skipped);

// 重复 phone 检查
const phoneMap = new Map();
for (const c of cs) {
  if (!c.phone) continue;
  phoneMap.set(c.phone, (phoneMap.get(c.phone) || 0) + 1);
}
const dupPhones = [...phoneMap.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log('\n  唯一 phone 值:', phoneMap.size, '| 重复组:', dupPhones.length);
console.log('  重复 Top10:', dupPhones.slice(0, 10).map(([k, n]) => k + '×' + n).join(', '));

if (!APPLY) {
  console.log('\n(干跑，未写入。加 --apply 执行)');
  db.close();
  process.exit(0);
}

// 备份
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const backupPath = path.join(ROOT, 'backups', `sales-backup-${stamp}-before-phone-from-wechat.json`);
fs.mkdirSync(path.join(ROOT, 'backups'), { recursive: true });
fs.writeFileSync(backupPath, JSON.stringify(state));
console.log('\n备份:', backupPath, fs.statSync(backupPath).size, 'bytes');

db.prepare('UPDATE app_state SET value = ? WHERE id = 1').run(JSON.stringify(state));
db.close();

const db2 = new DatabaseSync(dbPath, { readOnly: true });
const after = JSON.parse(db2.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db2.close();
const filled = (after.customers ?? []).filter(c => c.phone).length;
console.log('写入完成 | 客户总数:', (after.customers ?? []).length, '| 有 phone 值:', filled, '| 仍为空:', (after.customers ?? []).length - filled);
