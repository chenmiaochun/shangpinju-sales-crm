const fs = require('fs');
const path = require('path');

const rows = fs.readFileSync(path.join(__dirname, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const has = v => v != null && String(v).trim() !== '';
let wx = 0, name = 0, both = 0, neither = 0, onlyWx = 0;
const wxSet = new Map();
const nameSet = new Map();

for (const r of rows) {
  const n = has(r['客户姓名']), w = has(r['客户微信名']);
  if (n) { name++; nameSet.set(String(r['客户姓名']).trim(), (nameSet.get(String(r['客户姓名']).trim()) || 0) + 1); }
  if (w) { wx++; const k = String(r['客户微信名']).trim(); wxSet.set(k, (wxSet.get(k) || 0) + 1); }
  if (n && w) both++;
  if (!n && !w) neither++;
  if (!n && w) onlyWx++;
}

console.log('总记录:', rows.length);
console.log('有姓名:', name, '(' + (name / rows.length * 100).toFixed(1) + '%)');
console.log('有微信名:', wx, '(' + (wx / rows.length * 100).toFixed(1) + '%)');
console.log('两者都有:', both);
console.log('只有微信名:', onlyWx);
console.log('两者都空:', neither);

const dupWx = [...wxSet.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
console.log('\n微信名唯一数:', wxSet.size, '| 重复组数:', dupWx.length);
console.log('重复样例:', dupWx.slice(0, 12).map(([k, c]) => k + '×' + c).join(', '));

const dupName = [...nameSet.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
console.log('\n姓名唯一数:', nameSet.size, '| 重复组数:', dupName.length);

console.log('\n微信名样例:', [...wxSet.keys()].slice(0, 20).join(' | '));

// 联合键：姓名+微信名
const joint = new Map();
for (const r of rows) {
  const k = (has(r['客户姓名']) ? String(r['客户姓名']).trim() : '') + '|' + (has(r['客户微信名']) ? String(r['客户微信名']).trim() : '');
  joint.set(k, (joint.get(k) || 0) + 1);
}
const dupJoint = [...joint.entries()].filter(([, c]) => c > 1);
console.log('\n姓名+微信名联合唯一数:', joint.size, '| 仍重复:', dupJoint.length);
console.log('联合键重复样例:', dupJoint.slice(0, 8).map(([k, c]) => k + '×' + c).join(' ; '));
