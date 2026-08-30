import { readFileSync, appendFileSync } from 'node:fs'

const target = 'C:/Users/Administrator/Documents/销售软件/src/features/orders/order-print.css'
const css = [
  '',
  '/* 2026-08-30：宋体下标题同步收一点，保持整单比例 */',
  '.sales-order-sheet .sheet-title h1{font-size:22px;letter-spacing:2px}',
  '.sales-order-sheet .sheet-title span b{font-size:16px}',
  '.sales-order-sheet .sheet-components h2{font-size:12px}',
  ''
].join('\n')

const current = readFileSync(target, 'utf8')
if (current.includes('2026-08-30：宋体下标题')) {
  console.log('already patched, skip')
} else {
  appendFileSync(target, css, 'utf8')
  console.log('order-print.css patched')
}
