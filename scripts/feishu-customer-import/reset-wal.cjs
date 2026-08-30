const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dir = path.resolve(__dirname, '../../server/data');
const dbPath = path.join(dir, 'sales.sqlite');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

// 1) 先把 WAL 里的数据全部合并进主库，确保不丢数据
try {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 10000;');
  const t = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
  console.log('checkpoint:', JSON.stringify(t));
  const ic = db.prepare('PRAGMA integrity_check').get();
  console.log('完整性:', JSON.stringify(ic));
  db.close();
} catch (e) {
  console.log('checkpoint 失败:', e.message);
  process.exit(1);
}

// 2) 删除 wal 与 shm，让服务重新初始化
for (const f of [walPath, shmPath]) {
  try {
    if (fs.existsSync(f)) {
      const size = fs.statSync(f).size;
      fs.rmSync(f, { force: true, maxRetries: 5, retryDelay: 200 });
      console.log(`已删除 ${path.basename(f)} (${size} bytes)`);
    } else {
      console.log(`${path.basename(f)} 不存在，跳过`);
    }
  } catch (e) {
    console.log(`删除 ${path.basename(f)} 失败: ${e.message}`);
  }
}

console.log('清理完成，等待服务重启');
