const fs = require('fs');
const path = require('path');

const rows = fs.readFileSync(path.join(__dirname, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean).map(l => JSON.parse(l));

const has = v => v != null && String(v).trim() !== '';

let nameY = 0, nameN_wechatY = 0, nameN_wechatN = 0;
for (const r of rows) {
  if (has(r['客户姓名'])) nameY++;
  else if (has(r['客户微信名'])) nameN_wechatY++;
  else nameN_wechatN++;
}
console.log('有姓名:', nameY);
console.log('无姓名但有微信名:', nameN_wechatY);
console.log('姓名和微信名都空 (无法识别):', nameN_wechatN);

const parent = rows.filter(r => Array.isArray(r['父记录']) && r['父记录'].length > 0);
console.log('\n父记录非空的条数:', parent.length);
if (parent.length) console.log('样例:', JSON.stringify(parent[0]['父记录']).slice(0, 300));

console.log('\n===== 无姓名的记录样例(前5条, 看还有什么可用信息) =====');
rows.filter(r => !has(r['客户姓名'])).slice(0, 5).forEach(r => {
  console.log(JSON.stringify({
    编号: r['客户编号'], 微信名: r['客户微信名'], 城市: r['所属城市'],
    区县: r['所属区县'], 小区: r['城市小区名'], 到店日期: r['到店日期'],
    状态: r['当前状态'], 核心需求: r['核心需求'], 备注: r['备注'],
    跟进记录: String(r['跟进记录'] || '').slice(0, 60)
  }));
});

console.log('\n===== 「核心需求」为空的条数 =====');
const noNeed = rows.filter(r => !Array.isArray(r['核心需求']) || r['核心需求'].length === 0);
console.log(noNeed.length, '/', rows.length);
