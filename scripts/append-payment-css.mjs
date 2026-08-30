import { readFileSync, writeFileSync } from 'node:fs'

const file = 'src/features/orders/order-print.css'
const extra = `
/* 2026-08-30 销售单底部收款区块 */
.sheet-payment{border-top:1px dashed #999;margin-top:10px;padding-top:8px;font-size:10px;page-break-inside:avoid}
.sheet-payment-title{display:block;font-size:12px;margin-bottom:6px;letter-spacing:1px}
.sheet-payment-codes{display:flex;gap:20px;justify-content:center;margin-bottom:8px}
.sheet-payment-codes figure{margin:0;text-align:center}
.sheet-payment-codes img{width:108px;height:108px;object-fit:contain;border:1px solid #ddd;background:#fff}
.sheet-payment-codes figcaption{margin-top:3px;font-size:10px}
.sheet-payment-banks{margin:6px 0}
.sheet-bank-line{display:flex;justify-content:space-between;gap:14px;font-size:10px;line-height:1.8;border-bottom:1px dotted #eee;padding:1px 0}
.sheet-bank-name{font-weight:bold;flex:0 0 auto}
.sheet-bank-account{letter-spacing:1px;flex:1 1 auto;text-align:center}
.sheet-bank-owner{flex:0 0 auto}
.sheet-payment-note{margin-top:6px;font-size:10px;color:#333;line-height:1.6}
`
const prev = readFileSync(file, 'utf8')
if (prev.includes('.sheet-payment{')) {
  console.log('already present, skip')
} else {
  writeFileSync(file, prev.replace(/\s*$/, '') + '\n' + extra, 'utf8')
  console.log('appended')
}
