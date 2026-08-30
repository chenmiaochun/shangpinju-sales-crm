const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/Administrator/Documents/销售软件/scripts/feishu-customer-import';
const lines = fs.readFileSync(path.join(dir, 'records.ndjson'), 'utf8')
  .split('\n').filter(Boolean);

console.log('总行数:', lines.length);

const first = JSON.parse(lines[0]);
console.log('\n=== 顶层 keys ===');
console.log(Object.keys(first));
console.log('\n=== 第一条原始 ===');
console.log(JSON.stringify(first, null, 1).slice(0, 3000));
