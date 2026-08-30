const { DatabaseSync } = require('node:sqlite');
const { resolve } = require('node:path');

const db = new DatabaseSync(resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db.close();

const cs = state.customers ?? [];
const fsCustomers = cs.filter(c => String(c.leadId || '').startsWith('FS-'));
const old = cs.filter(c => !String(c.leadId || '').startsWith('FS-'));

console.log('客户总数:', cs.length);
console.log('  飞书导入:', fsCustomers.length);
console.log('  原有(未动):', old.length, '→', old.map(c => c.name).join(', '));

console.log('\n=== 必填字段完整性检查 (飞书导入的', fsCustomers.length, '条) ===');
const required = ['id', 'name', 'phone', 'source', 'salesperson', 'stage', 'intent',
  'expectedAmount', 'products', 'style', 'budget', 'renovationProgress',
  'concerns', 'lastContactAt', 'createdAt'];
for (const f of required) {
  const missing = fsCustomers.filter(c => c[f] === undefined || c[f] === null).length;
  const empty = fsCustomers.filter(c => {
    const v = c[f];
    return v === '' || (Array.isArray(v) && v.length === 0);
  }).length;
  console.log(`  ${f}: 缺失 ${missing} / 空值 ${empty}`);
}

console.log('\n=== 挂靠账号检查 ===');
const byId = new Map();
for (const c of fsCustomers) byId.set(c.salespersonId, (byId.get(c.salespersonId) || 0) + 1);
for (const [k, v] of byId) console.log(`  ${k}: ${v} 条`);

console.log('\n=== stage 分布 ===');
const byStage = new Map();
for (const c of fsCustomers) byStage.set(c.stage, (byStage.get(c.stage) || 0) + 1);
for (const [k, v] of byStage) console.log(`  ${k}: ${v}`);

console.log('\n=== intent 分布 ===');
const byIntent = new Map();
for (const c of fsCustomers) byIntent.set(c.intent, (byIntent.get(c.intent) || 0) + 1);
for (const [k, v] of byIntent) console.log(`  ${k}: ${v}`);

console.log('\n=== 待补姓名 ===');
const noName = fsCustomers.filter(c => String(c.name).startsWith('（待补姓名'));
console.log('  数量:', noName.length);
for (const c of noName.slice(0, 12)) console.log(`    ${c.leadId} | 城市:${c.cityArea || '-'} | 小区:${c.communityName || '-'} | 到店:${String(c.createdAt).slice(0, 10)}`);

console.log('\n=== 抽样 2 条 ===');
for (const c of fsCustomers.slice(0, 2)) {
  console.log(JSON.stringify({
    leadId: c.leadId, name: c.name, phone: c.phone, source: c.source,
    salesperson: c.salesperson, stage: c.stage, intent: c.intent,
    budget: c.budget, products: c.products, cityArea: c.cityArea,
    communityDistrict: c.communityDistrict, communityName: c.communityName,
    licensePlate: c.licensePlate, createdAt: c.createdAt
  }, null, 1));
}

const fu = state.followUps ?? [];
console.log('\n跟进记录总数:', fu.length, '| 飞书导入:', fu.filter(f => String(f.id).startsWith('fu-fs-')).length);
