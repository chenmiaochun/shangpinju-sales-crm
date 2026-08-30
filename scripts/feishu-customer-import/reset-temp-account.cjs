// 重新激活 import-bot 临时账号并重置密码（不触碰任何其他账号）
const { DatabaseSync } = require('node:sqlite');
const { randomBytes, scryptSync } = require('node:crypto');
const { resolve } = require('node:path');

const TEMP_USER = 'import-bot';
const TEMP_PASS = 'SpjImport-2026';

const db = new DatabaseSync(resolve(__dirname, '../../server/data/sales.sqlite'));
db.exec('PRAGMA busy_timeout = 8000;');

const hashPassword = (password) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
};

const row = db.prepare('SELECT id, username, active FROM auth_accounts WHERE username = ?').get(TEMP_USER);
if (!row) {
  console.log('临时账号不存在，请先运行 temp-account.cjs --create');
  process.exit(1);
}

db.prepare('UPDATE auth_accounts SET password_hash = ?, active = 1, must_change_password = 0, updated_at = ? WHERE id = ?')
  .run(hashPassword(TEMP_PASS), new Date().toISOString(), row.id);

// 清掉旧会话，避免失效 session 干扰
db.prepare('DELETE FROM auth_sessions WHERE account_id = ?').run(row.id);

const after = db.prepare('SELECT id, username, active FROM auth_accounts WHERE id = ?').get(row.id);
console.log('已激活:', JSON.stringify(after));

const admin = db.prepare("SELECT id, username, name, active FROM auth_accounts WHERE username = 'admin'").get();
console.log('老板 admin 账号未被改动:', JSON.stringify(admin));

db.close();
