const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.resolve(__dirname, '../../server/data/sales.sqlite'), { readOnly: true });

console.log('=== 最近的登录失败记录 ===');
const fails = db.prepare("SELECT id, action, details, created_at FROM audit_log WHERE action LIKE '%login%' OR action LIKE '%fail%' ORDER BY rowid DESC LIMIT 20").all();
for (const r of fails) console.log(`  ${r.created_at} | ${r.action} | ${r.details}`);

console.log('\n=== 按 action 统计 ===');
const stats = db.prepare('SELECT action, COUNT(*) AS n FROM audit_log GROUP BY action ORDER BY n DESC').all();
for (const s of stats) console.log(`  ${s.action}: ${s.n}`);

console.log('\n=== 最近 10 分钟内的 login_failed 次数 ===');
const recent = db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'login_failed' AND created_at > datetime('now', '-15 minutes')").get();
console.log('  15 分钟内失败:', recent.n, '次（限流阈值 5 次）');

db.close();
