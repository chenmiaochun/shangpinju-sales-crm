const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });
const st = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);

console.log('=== 订单明细 (', (st.orders ?? []).length, ') ===');
for (const o of st.orders ?? []) {
  console.log(JSON.stringify({
    id: o.id, orderNo: o.orderNo, customerName: o.customerName,
    salesperson: o.salesperson, opener: o.opener, status: o.status,
    contractAmount: o.contractAmount, items: (o.items || []).length,
    createdAt: o.createdAt, updatedAt: o.updatedAt
  }, null, 1));
}

const cs = st.customers ?? [];
const fs = cs.filter(c => String(c.leadId || '').startsWith('FS-'));
console.log('\n=== 客户 ===');
console.log('总数:', cs.length, '| 飞书:', fs.length, '| 非飞书:', cs.length - fs.length);

const nonFs = cs.filter(c => !String(c.leadId || '').startsWith('FS-'));
console.log('\n非飞书客户（含新建的）:');
for (const c of nonFs) {
  console.log(`  ${c.id} | ${c.name} | ${c.phone || '-'} | 负责人:${c.salesperson} | 创建:${c.createdAt || '-'} | createdBy:${c.createdBy || '-'}`);
}

console.log('\n=== 我的删除是否被回滚 ===');
console.log('陈妙纯/吴漫东 剩余客户:', fs.filter(c => ['陈妙纯', '吴漫东'].includes(c.salesperson)).length);
const ph = new Map();
for (const c of fs) if (c.phone) ph.set(c.phone, (ph.get(c.phone) || 0) + 1);
console.log('重复 phone 组:', [...ph.values()].filter(n => n > 1).length, '| 唯一:', ph.size);

console.log('\n=== 会话 ===');
const sess = db.prepare('SELECT account_id, created_at, expires_at FROM auth_sessions').all();
for (const s of sess) console.log(' ', JSON.stringify(s));

db.close();
