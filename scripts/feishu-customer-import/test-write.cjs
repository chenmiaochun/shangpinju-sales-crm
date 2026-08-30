const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dir = path.resolve(__dirname, '../../server/data');
const dbPath = path.join(dir, 'sales.sqlite');

console.log('=== 文件状态 ===');
const fs = require('fs');
for (const f of ['sales.sqlite', 'sales.sqlite-wal', 'sales.sqlite-shm']) {
  try {
    const s = fs.statSync(path.join(dir, f));
    console.log(`  ${f}: ${s.size} bytes`);
  } catch (e) {
    console.log(`  ${f}: 不存在`);
  }
}

console.log('\n=== 可写连接测试 ===');
try {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 10000;');
  console.log('  连接成功（可写模式）');

  db.exec('CREATE TABLE IF NOT EXISTS _probe_tmp (id INTEGER PRIMARY KEY, v TEXT)');
  db.prepare('INSERT INTO _probe_tmp (v) VALUES (?)').run('probe-' + Date.now());
  const n = db.prepare('SELECT COUNT(*) AS n FROM _probe_tmp').get();
  console.log('  写入测试成功, 表内行数:', n.n);
  db.exec('DROP TABLE _probe_tmp');
  console.log('  临时表已清理');

  const jm = db.prepare('PRAGMA journal_mode').get();
  console.log('  journal_mode:', JSON.stringify(jm));
  db.close();
  console.log('\n结论: 数据库文件本身可写');
} catch (e) {
  console.log('  !! 写入失败:', e.message, '| errcode:', e.errcode);
  console.log('\n结论: 数据库文件不可写（权限问题）');
}
