const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });
const state = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
db.close();

const cs = state.customers ?? [];
const fs = cs.filter(c => String(c.leadId || '').startsWith('FS-'));

// A: 陈妙纯 + 吴漫东 13 条
const delA = fs.filter(c => c.salesperson === '陈妙纯' || c.salesperson === '吴漫东');
const stageA = {};
for (const c of delA) stageA[c.stage] = (stageA[c.stage] || 0) + 1;
console.log('【A】拟删除 13 条的阶段分布:', JSON.stringify(stageA));
console.log('    其中已成交:', delA.filter(c => c.stage === '已成交').length,
  '| 需求确认:', delA.filter(c => c.stage === '需求确认').length);
console.log('    有备注/跟进内容的:', delA.filter(c => c.notes).length);
const fu = (state.followUps ?? []).filter(f => delA.some(c => c.id === f.customerId));
console.log('    关联的跟进记录:', fu.length, '条');

// B: 去重 70 条
const groups = new Map();
for (const c of fs) {
  if (!c.phone) continue;
  if (!groups.has(c.phone)) groups.set(c.phone, []);
  groups.get(c.phone).push(c);
}
const dupGroups = [...groups.entries()].filter(([, l]) => l.length > 1);
const toDelete = [];
for (const [, list] of dupGroups) {
  const sorted = [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  toDelete.push(...sorted.slice(1));
}
const stageB = {};
for (const c of toDelete) stageB[c.stage] = (stageB[c.stage] || 0) + 1;
console.log('\n【B】去重拟删除', toDelete.length, '条的阶段分布:', JSON.stringify(stageB));
console.log('    其中已成交:', toDelete.filter(c => c.stage === '已成交').length);
console.log('    需求确认:', toDelete.filter(c => c.stage === '需求确认').length);
console.log('    带备注的:', toDelete.filter(c => c.notes).length);
console.log('    带跟进记录的:', toDelete.filter(c => (state.followUps ?? []).some(f => f.customerId === c.id)).length);

// 被删记录里"保留那条反而阶段更靠后"的情况
let worse = 0;
for (const [, list] of dupGroups) {
  const sorted = [...list].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const keep = sorted[0];
  const dropped = sorted.slice(1);
  const order = ['到店', '需求确认', '已成交'];
  if (dropped.some(d => order.indexOf(d.stage) > order.indexOf(keep.stage))) worse++;
}
console.log('    保留条阶段比被删条更"早期"的组数:', worse, '/', dupGroups.length);

// 合并方案预览
console.log('\n【C】合并方案预览（每组合并为 1 条，不丢数据）');
let mergeGroups = 0, mergeLose = 0;
for (const [k, list] of dupGroups) {
  mergeGroups++;
  mergeLose += list.length - 1;
}
console.log('    51 组重复 → 合并为 51 条客户（减少', mergeLose, '条）');
console.log('    合并后客户总数:', fs.length - mergeLose);
console.log('    合并规则: 状态取最新一次到店的、需求取并集、到店日期取最早、跟进记录全部保留');
