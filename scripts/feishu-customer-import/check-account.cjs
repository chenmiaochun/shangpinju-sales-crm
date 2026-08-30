const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });
const rows = db.prepare(
  'SELECT id, username, active, must_change_password, updated_at, substr(password_hash,1,34) AS hash_prefix FROM auth_accounts ORDER BY username'
).all();
console.log('=== auth_accounts 当前状态 ===');
for (const r of rows) console.log(JSON.stringify(r));

const sessions = db.prepare('SELECT COUNT(*) AS n FROM auth_sessions').get();
console.log('\n活跃会话数:', sessions.n);

const st = JSON.parse(db.prepare('SELECT value FROM app_state WHERE id = 1').get().value);
console.log('\napp_state 客户数:', (st.customers ?? []).length, '| 订单数:', (st.orders ?? []).length);
console.log('app_state updated_at:', db.prepare('SELECT updated_at FROM app_state WHERE id = 1').get().updated_at);
db.close();
