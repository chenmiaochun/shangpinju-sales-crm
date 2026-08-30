const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });

const cols = db.prepare('PRAGMA table_info(audit_log)').all();
console.log('audit_log 列:', cols.map(c => c.name).join(', '));

const total = db.prepare('SELECT COUNT(*) AS n FROM audit_log').get();
console.log('总行数:', total.n);

console.log('\n=== 最近 15 条 ===');
const rows = db.prepare('SELECT * FROM audit_log ORDER BY rowid DESC LIMIT 15').all();
for (const r of rows) {
  const s = JSON.stringify(r);
  console.log(s.length > 400 ? s.slice(0, 400) + '...' : s);
}
db.close();
