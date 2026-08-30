const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '../..');
const db = new DatabaseSync(path.join(ROOT, 'server/data/sales.sqlite'), { readOnly: true });

const cols = db.prepare('PRAGMA table_info(auth_accounts)').all();
console.log('列:', cols.map(c => c.name).join(', '));

const rows = db.prepare('SELECT * FROM auth_accounts').all();
console.log('行数:', rows.length, '\n');
for (const r of rows) {
  const safe = { ...r };
  for (const k of Object.keys(safe)) {
    if (/pass|hash|secret|token/i.test(k)) safe[k] = '***';
    if (typeof safe[k] === 'string' && safe[k].startsWith('{')) {
      try { safe[k] = JSON.parse(safe[k]); } catch {}
    }
  }
  console.log(JSON.stringify(safe));
}
db.close();
