const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.resolve(__dirname, '../../server/data/sales.sqlite');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA busy_timeout = 15000;');

const before = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get();
console.log('PASSIVE 结果:', JSON.stringify(before));

const full = db.prepare('PRAGMA wal_checkpoint(FULL)').get();
console.log('FULL 结果:', JSON.stringify(full));

const trunc = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
console.log('TRUNCATE 结果:', JSON.stringify(trunc));

const integrity = db.prepare('PRAGMA integrity_check').get();
console.log('完整性检查:', JSON.stringify(integrity));

db.close();
console.log('完成');
