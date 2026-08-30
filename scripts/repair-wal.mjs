import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('server/data/sales.sqlite')

const checkpoint = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get()
console.log('checkpoint:', checkpoint)

const integrity = db.prepare('PRAGMA integrity_check').get()
console.log('integrity_check:', integrity)

const count = db.prepare('SELECT COUNT(*) as c FROM app_state').get()
console.log('app_state rows:', count)

db.close()
