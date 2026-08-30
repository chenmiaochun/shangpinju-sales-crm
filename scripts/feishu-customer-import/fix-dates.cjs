// 修复：到店日期为空的记录，createdAt 落成了 "Sat Aug 29" 这类非 ISO 值
// 还原策略：优先用飞书「月份」字段，其次用客户编号末两位（末两位即月份），最后才回退今天
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const APPLY = process.argv.includes('--apply');
const dbPath = path.resolve(__dirname, '../../server/data/sales.sqlite');

const rows = fs.readFileSync(path.join(__dirname, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const monthByRid = new Map();   // record_id -> MM
const monthByNo = new Map();    // 客户编号 -> MM
for (const r of rows) {
  const m = Array.isArray(r['月份']) ? r['月份'][0] : r['月份'];
  const mm = m ? String(m).replace('月', '').trim().padStart(2, '0') : '';
  if (mm) {
    monthByRid.set(r.record_id, mm);
    if (r['客户编号']) monthByNo.set(String(r['客户编号']).trim(), mm);
  }
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 8000;');
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
const cs = state.customers ?? [];

function inferMonth(c) {
  const rid = String(c.id || '').replace('cust-fs-', '');
  if (monthByRid.has(rid)) return { mm: monthByRid.get(rid), src: '飞书月份' };
  const no = String(c.leadId || '').replace('FS-', '');
  if (monthByNo.has(no)) return { mm: monthByNo.get(no), src: '飞书月份(编号匹配)' };
  if (/^\d{5}$/.test(no)) return { mm: no.slice(-2), src: '编号末两位' };
  return null;
}

const bad = cs.filter(c => String(c.leadId || '').startsWith('FS-')
  && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.createdAt || '')));

console.log('需修复:', bad.length);
for (const c of bad) {
  const inf = inferMonth(c);
  const newDate = inf ? `2026-${inf.mm}-01` : '2026-08-29';
  console.log(`  ${c.leadId} | ${c.name} | ${c.createdAt} → ${newDate}  (${inf ? inf.src + ' ' + inf.mm + '月' : '无月份信息·用导入日'})`);
}

if (!APPLY) {
  console.log('\n(干跑，未修改。加 --apply 修复)');
  db.close();
  process.exit(0);
}

let fixed = 0;
for (const c of cs) {
  if (!String(c.leadId || '').startsWith('FS-')) continue;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(c.createdAt || '')) && c.lastContactAt) continue;
  const inf = inferMonth(c);
  const newDate = inf ? `2026-${inf.mm}-01` : '2026-08-29';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.createdAt || ''))) c.createdAt = newDate;
  if (!c.lastContactAt) c.lastContactAt = `${newDate}T00:00:00.000Z`;
  fixed++;
}

db.prepare('UPDATE app_state SET value = ? WHERE id = 1').run(JSON.stringify(state));
console.log('\n已修复:', fixed);

const after = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
const still = (after.customers ?? []).filter(c => String(c.leadId || '').startsWith('FS-')
  && !/^\d{4}-\d{2}-\d{2}$/.test(String(c.createdAt || '')));
console.log('修复后仍异常:', still.length, '| 客户总数:', (after.customers ?? []).length);

const byMonth = new Map();
for (const c of after.customers) {
  if (!String(c.leadId || '').startsWith('FS-')) continue;
  const m = String(c.createdAt).slice(0, 7);
  byMonth.set(m, (byMonth.get(m) || 0) + 1);
}
console.log('\n导入客户按月份分布:');
for (const [k, v] of [...byMonth].sort()) console.log(`  ${k}: ${v}`);
db.close();
