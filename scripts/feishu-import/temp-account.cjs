// 临时导入账号：创建（--create）或删除（--cleanup）
// 用法: node scripts/feishu-import/temp-account.cjs --create
//       node scripts/feishu-import/temp-account.cjs --cleanup
const { DatabaseSync } = require("node:sqlite");
const { randomBytes, scryptSync } = require("node:crypto");
const { resolve } = require("node:path");

const TEMP_USER = "import-bot";
const TEMP_PASS = "SpjImport-2026";
const action = process.argv[2] || "";
const db = new DatabaseSync(resolve(__dirname, "../../server/data/sales.sqlite"));
db.exec("PRAGMA busy_timeout = 8000;");

const hashPassword = (password) => {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
};

if (action === "--create") {
  const exists = db.prepare("SELECT id FROM auth_accounts WHERE username = ?").get(TEMP_USER);
  if (exists) { console.log("已存在:", exists.id); process.exit(0); }
  const id = "account-import-" + Date.now();
  const at = new Date().toISOString();
  db.prepare(
    "INSERT INTO auth_accounts (id, username, password_hash, name, role, active, must_change_password, created_at, updated_at, phone, can_design, custom_permissions, roles) VALUES (?, ?, ?, ?, 'manager', 1, 0, ?, ?, '', 0, NULL, '[\"manager\"]')"
  ).run(id, TEMP_USER, hashPassword(TEMP_PASS), "导入工具", at, at);
  console.log("已创建临时账号:", id, TEMP_USER);
} else if (action === "--cleanup") {
  const row = db.prepare("SELECT id FROM auth_accounts WHERE username = ?").get(TEMP_USER);
  if (row) {
    db.prepare("DELETE FROM auth_sessions WHERE account_id = ?").run(row.id);
    db.prepare("DELETE FROM auth_accounts WHERE id = ?").run(row.id);
    console.log("已删除临时账号及其会话:", row.id);
  } else {
    console.log("临时账号不存在，无需清理");
  }
} else {
  console.log("用法: node temp-account.cjs --create | --cleanup");
}
db.close();
