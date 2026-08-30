const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db.close();

const cs = state.customers ?? [];
const fs = cs.filter(c => String(c.leadId || '').startsWith('FS-'));
const legacy = cs.filter(c => !String(c.leadId || '').startsWith('FS-'));

console.log('客户总数:', cs.length, '| 飞书:', fs.length, '| 原有:', legacy.length,
  '(' + legacy.map(c => c.name).join('、') + ')');

const cnt = (key) => {
  const m = new Map();
  for (const c of fs) m.set(c[key] || '(空)', (m.get(c[key] || '(空)') || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

console.log('\n=== 合并后 stage 分布 ===');
console.log('  (合并前为 到店399 / 需求确认21 / 已成交71 / 已流失3)');
for (const [k, v] of cnt('stage')) console.log(`  ${k}: ${v}`);

console.log('\n=== 合并后 intent 分布（填2→中）===');
for (const [k, v] of cnt('intent')) console.log(`  ${k}: ${v}`);

const owners = new Map();
for (const c of fs) owners.set(c.salesperson, (owners.get(c.salesperson) || 0) + 1);
console.log('\n=== 负责人分布 ===');
for (const [k, v] of [...owners].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

const ph = new Map();
for (const c of fs) if (c.phone) ph.set(c.phone, (ph.get(c.phone) || 0) + 1);
console.log('\n唯一 phone:', ph.size, '| 重复组:', [...ph.values()].filter(n => n > 1).length);
console.log('无 phone:', fs.filter(c => !c.phone).length);

console.log('\n=== 合并效果抽查 ===');
for (const key of ['瑞丰玉坊', '星见', 'Cloud']) {
  const c = fs.find(x => x.phone === key);
  if (!c) { console.log(`  【${key}】未找到`); continue; }
  console.log(`  【${key}】${c.name} | ${c.stage} | ${c.salesperson} | 到店${String(c.createdAt).slice(0, 10)} | 需求:${(c.products || []).join('/') || '-'}`);
  if (c.notes) console.log(`      备注合并: ${c.notes.slice(0, 80)}`);
}

console.log('\n=== 待补姓名 ===');
const noName = fs.filter(c => String(c.name).startsWith('（待补姓名'));
console.log('  数量:', noName.length);
for (const c of noName) console.log(`    ${String(c.leadId).replace('FS-', '')} | ${c.salesperson} | ${String(c.createdAt).slice(0, 10)}`);

console.log('\n跟进记录:', (state.followUps ?? []).length);
