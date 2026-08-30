const fs = require('fs');
const path = require('path');

const dir = __dirname;
const lines = fs.readFileSync(path.join(dir, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean);
const rows = lines.map(l => JSON.parse(l));

console.log('总记录:', rows.length);

function dist(field, flat = true) {
  const m = new Map();
  for (const r of rows) {
    let v = r[field];
    if (v == null) v = [];
    if (!Array.isArray(v)) v = [v];
    if (v.length === 0) {
      m.set('(空)', (m.get('(空)') || 0) + 1);
      continue;
    }
    for (const item of v) {
      const k = String(item);
      m.set(k, (m.get(k) || 0) + 1);
    }
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

for (const f of ['当前状态', '购买意向', '成交信息', '认知途径', '装修进度',
                 '预算范围', '接待人员', '主谈人员', '月份', '到店时段',
                 '所属城市', '所属区县', '车品牌']) {
  console.log(`\n===== ${f} =====`);
  for (const [k, c] of dist(f)) console.log(`  ${k}: ${c}`);
}

console.log('\n===== 数据质量 =====');
const nameEmpty = rows.filter(r => !r['客户姓名'] || !String(r['客户姓名']).trim()).length;
const nameOne = rows.filter(r => r['客户姓名'] && String(r['客户姓名']).trim().length === 1).length;
const phoneEmpty = rows.filter(r => !r['手机号'] || !String(r['手机号']).trim()).length;
const noDate = rows.filter(r => !r['到店日期']).length;
console.log('姓名为空:', nameEmpty);
console.log('姓名仅1字:', nameOne);
console.log('手机号为空:', phoneEmpty);
console.log('到店日期为空:', noDate);

const names = new Map();
for (const r of rows) {
  const n = String(r['客户姓名'] || '').trim();
  if (n) names.set(n, (names.get(n) || 0) + 1);
}
const dupNames = [...names.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
console.log('\n重名(>1次) 数量:', dupNames.length);
console.log(dupNames.slice(0, 15).map(([n, c]) => `${n}×${c}`).join(' , '));
