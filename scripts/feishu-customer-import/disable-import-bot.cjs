const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'));
db.exec('PRAGMA busy_timeout = 8000;');
const row = db.prepare('SELECT id, active FROM auth_accounts WHERE username = ?').get('import-bot');
if (row) {
  db.prepare('DELETE FROM auth_sessions WHERE account_id = ?').run(row.id);
  db.prepare('UPDATE auth_accounts SET active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), row.id);
  console.log('import-bot 已禁用，会话已清理');
} else {
  console.log('import-bot 不存在');
}
db.close();
