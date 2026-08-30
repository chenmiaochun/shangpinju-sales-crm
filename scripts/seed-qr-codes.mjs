import { DatabaseSync } from 'node:sqlite'
import { readFileSync, copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  const DB = resolve('server/data/sales.sqlite')
  const BACKUP = `${DB}.backup-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}`

  console.log('DB path:', DB)
  console.log('backup path:', BACKUP)

  copyFileSync(DB, BACKUP)
  console.log('已备份数据库')

  const WECHAT_PATH = 'E:/Users/Administrator/Documents/xwechat_files/angel-forever_675a/temp/RWTemp/2026-08/9e20f478899dc29eb19741386f9343c8/ae007163821482815806322ba6809d10.jpg'
  const ALIPAY_PATH = 'E:/Users/Administrator/Documents/xwechat_files/angel-forever_675a/temp/RWTemp/2026-08/9e20f478899dc29eb19741386f9343c8/fbd443b41379ad6c45a4ba78cf949244.jpg'

  console.log('wechat file exists check...')
  const wbuf = readFileSync(WECHAT_PATH)
  console.log('wechat read:', wbuf.length)
  const abuf = readFileSync(ALIPAY_PATH)
  console.log('alipay read:', abuf.length)

  function toCustomerFile(buf, name) {
    const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`
    return {
      id: `qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      dataUrl,
      size: buf.length,
      type: 'image/jpeg',
      createdAt: new Date().toISOString(),
    }
  }

  const wechatQr = toCustomerFile(wbuf, '微信收款码.jpg')
  const alipayQr = toCustomerFile(abuf, '支付宝收款码.jpg')

  const db = new DatabaseSync(DB)
  const row = db.prepare('SELECT value FROM app_state WHERE id = 1').get()
  console.log('row fetched, value length:', row.value.length)
  const state = JSON.parse(row.value)

  state.paymentSettings = {
    ...(state.paymentSettings || {}),
    enabled: true,
    wechatQr,
    alipayQr,
    updatedAt: new Date().toISOString(),
  }

  if (!state.paymentSettings.banks || state.paymentSettings.banks.length === 0) {
    state.paymentSettings.banks = [
      { bankName: '中国工商银行', accountName: '陈妙纯', accountNo: '6222082019001191084' },
      { bankName: '农业银行', accountName: '陈妙纯', accountNo: '6228481397101526274' },
    ]
  }

  const newValue = JSON.stringify(state)
  console.log('new value length:', newValue.length)
  db.prepare('UPDATE app_state SET value = ? WHERE id = 1').run(newValue)
  db.close()

  console.log('已写入收款码到 paymentSettings')
  console.log('enabled:', state.paymentSettings.enabled)
} catch (err) {
  console.error('ERROR:', err.message)
  console.error(err.stack)
  process.exit(1)
}
