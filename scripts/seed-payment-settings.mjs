import { copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'

const dbPath = 'server/data/sales.sqlite'
// 备份（cp，不用 rm）
const bak = `${dbPath}.seed-bak-${Date.now()}`
copyFileSync(dbPath, bak)
console.log('backup ->', bak)

const db = new DatabaseSync(dbPath)
const row = db.prepare('SELECT value FROM app_state WHERE id = 1').get()
if (!row) { console.error('no app_state row'); process.exit(1) }
const state = JSON.parse(row.value)

const banks = [
  { bankName: '中国工商银行', accountName: '陈妙纯', accountNo: '6222082019001191084' },
  { bankName: '农业银行', accountName: '陈妙纯', accountNo: '6228481397101526274' },
]
const paymentSettings = {
  enabled: false, // 先关闭，等老板上传二维码并核对银行卡后手动开启
  banks,
  updatedAt: new Date().toISOString(),
}
state.paymentSettings = paymentSettings

db.prepare('UPDATE app_state SET value = ?, updated_at = ? WHERE id = 1').run(
  JSON.stringify(state),
  paymentSettings.updatedAt,
)
console.log('paymentSettings seeded (enabled=false). banks:', banks.length)
db.close()
