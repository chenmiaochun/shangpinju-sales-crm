import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('server/data/sales.sqlite')
const row = db.prepare('SELECT value FROM app_state WHERE id = 1').get()
const state = JSON.parse(row.value)
const ps = state.paymentSettings || {}

console.log('enabled:', ps.enabled)
console.log('wechatQr:', ps.wechatQr ? `${ps.wechatQr.name} size=${ps.wechatQr.size} dataUrl=${ps.wechatQr.dataUrl.slice(0, 40)}` : '无')
console.log('alipayQr:', ps.alipayQr ? `${ps.alipayQr.name} size=${ps.alipayQr.size} dataUrl=${ps.alipayQr.dataUrl.slice(0, 40)}` : '无')
console.log('banks:', ps.banks.map(b => `${b.bankName} ${b.accountNo}`))
console.log('total state bytes:', row.value.length)
db.close()
