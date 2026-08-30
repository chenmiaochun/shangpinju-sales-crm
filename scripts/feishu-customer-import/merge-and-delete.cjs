// 1) 删除 陈妙纯 + 吴漫东 名下 13 条客户（老板确认全删）
// 2) 按 phone(微信名) 唯一值合并 51 组重复记录（不丢数据）
// 用法: node merge-and-delete.cjs          (干跑)
//       node merge-and-delete.cjs --apply  (写入，自动备份)
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '../..');
const APPLY = process.argv.includes('--apply');
const dbPath = path.join(ROOT, 'server/data/sales.sqlite');

const DELETE_OWNERS = ['陈妙纯', '吴漫东'];
const STAGE_RANK = { '已流失': 0, '到店': 1, '需求确认': 2, '已成交': 3 };

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 8000;');
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);

const allCustomers = state.customers ?? [];
const allFollowUps = state.followUps ?? [];

// ---------- 步骤 1：删除无账号负责人名下的客户 ----------
const toDeleteOwners = allCustomers.filter(c =>
  String(c.leadId || '').startsWith('FS-') && DELETE_OWNERS.includes(c.salesperson));
const delOwnerIds = new Set(toDeleteOwners.map(c => c.id));

console.log('== 步骤1：删除无账号负责人客户 ==');
console.log('  拟删除:', toDeleteOwners.length, '条');
for (const c of toDeleteOwners) {
  console.log(`    ${String(c.leadId).replace('FS-', '')} | ${c.name} | ${c.salesperson} | ${c.stage} | ${String(c.createdAt).slice(0, 10)}`);
}

let customers = allCustomers.filter(c => !delOwnerIds.has(c.id));

// ---------- 步骤 2：按 phone 唯一值合并 ----------
const groups = new Map();
for (const c of customers) {
  if (!String(c.leadId || '').startsWith('FS-') || !c.phone) continue;
  if (!groups.has(c.phone)) groups.set(c.phone, []);
  groups.get(c.phone).push(c);
}
const dupGroups = [...groups.entries()].filter(([, l]) => l.length > 1);

console.log('\n== 步骤2：合并重复微信名 ==');
console.log('  重复组:', dupGroups.length, '| 涉及记录:', dupGroups.reduce((n, [, l]) => n + l.length, 0));

const mergedIds = new Map();  // 被吞掉的 id -> 保留的 id
const mergedCustomers = [];
const pickLatest = (list, key) => {
  const sorted = [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  for (const c of sorted) { const v = c[key]; if (v !== '' && v != null && !(Array.isArray(v) && v.length === 0)) return v; }
  return '';
};

for (const [phone, list] of dupGroups) {
  const byDate = [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const base = byDate[0];              // 最早到店 → 作为基底
  const latest = byDate[byDate.length - 1];

  // name：优先非"待补姓名"且最长的
  const nameCands = list.map(c => String(c.name || '')).filter(n => n && !n.startsWith('（待补姓名'));
  const bestName = nameCands.sort((a, b) => b.length - a.length)[0] || base.name;

  const products = [...new Set(list.flatMap(c => c.products || []))];
  const notesParts = list.map(c => String(c.notes || '').trim()).filter(Boolean);

  const merged = {
    ...base,
    name: bestName,
    stage: [...list].sort((a, b) => (STAGE_RANK[b.stage] ?? 0) - (STAGE_RANK[a.stage] ?? 0))[0].stage,
    intent: pickLatest(list, 'intent') || base.intent,
    budget: pickLatest(list, 'budget'),
    renovationProgress: pickLatest(list, 'renovationProgress'),
    cityArea: pickLatest(list, 'cityArea'),
    communityDistrict: pickLatest(list, 'communityDistrict'),
    communityName: pickLatest(list, 'communityName'),
    visitPeriod: pickLatest(list, 'visitPeriod'),
    vehicleBrand: pickLatest(list, 'vehicleBrand'),
    licensePlate: pickLatest(list, 'licensePlate'),
    products,
    notes: notesParts.join(' ｜ '),
    salesperson: latest.salesperson,
    salespersonId: latest.salespersonId,
    lastContactAt: latest.lastContactAt || base.lastContactAt,
    nextFollowUpAt: pickLatest(list, 'nextFollowUpAt') || undefined,
    updatedAt: new Date().toISOString(),
  };

  for (const c of byDate.slice(1)) mergedIds.set(c.id, base.id);
  mergedCustomers.push(merged);
}

// 用合并后的记录替换原来的多条
const dupMemberIds = new Set(dupGroups.flatMap(([, l]) => l.map(c => c.id)));
customers = customers.filter(c => !dupMemberIds.has(c.id)).concat(mergedCustomers);

console.log('  合并后:', mergedCustomers.length, '条 (原', dupMemberIds.size, '条)');

// ---------- 步骤 3：跟进记录重定向 ----------
let followUps = allFollowUps.filter(f => !delOwnerIds.has(f.customerId));
let redirected = 0;
followUps = followUps.map(f => {
  if (mergedIds.has(f.customerId)) { redirected++; return { ...f, customerId: mergedIds.get(f.customerId) }; }
  return f;
});
const delFu = allFollowUps.length - followUps.length;

console.log('\n== 步骤3：跟进记录 ==');
console.log('  重定向到保留客户:', redirected, '| 随客户删除:', delFu);

console.log('\n== 汇总 ==');
console.log('  客户:', allCustomers.length, '→', customers.length,
  `(删 ${toDeleteOwners.length}，合并减少 ${dupMemberIds.size - mergedCustomers.length})`);
console.log('  跟进记录:', allFollowUps.length, '→', followUps.length);
console.log('  唯一 phone 值:', new Set(customers.filter(c => c.phone).map(c => c.phone)).size);

if (!APPLY) {
  console.log('\n(干跑，未写入。加 --apply 执行)');
  db.close();
  process.exit(0);
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const backupPath = path.join(ROOT, 'backups', `sales-backup-${stamp}-before-merge-delete.json`);
fs.mkdirSync(path.join(ROOT, 'backups'), { recursive: true });
fs.writeFileSync(backupPath, JSON.stringify({ ...state, customers: allCustomers, followUps: allFollowUps }));
console.log('\n备份:', backupPath, fs.statSync(backupPath).size, 'bytes');

db.prepare('UPDATE app_state SET value = ? WHERE id = 1')
  .run(JSON.stringify({ ...state, customers, followUps }));
db.close();

const db2 = new DatabaseSync(dbPath, { readOnly: true });
const after = JSON.parse(db2.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db2.close();
const fsAfter = (after.customers ?? []).filter(c => String(c.leadId || '').startsWith('FS-'));
console.log('\n写入完成 | 客户总数:', (after.customers ?? []).length, '| 飞书客户:', fsAfter.length);
console.log('剩余 陈妙纯/吴漫东 客户:', fsAfter.filter(c => DELETE_OWNERS.includes(c.salesperson)).length);
const ph = new Map();
for (const c of fsAfter) if (c.phone) ph.set(c.phone, (ph.get(c.phone) || 0) + 1);
console.log('重复 phone 组:', [...ph.values()].filter(n => n > 1).length);
