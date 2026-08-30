import { readFileSync, appendFileSync } from 'node:fs'

const target = 'C:/Users/Administrator/Documents/销售软件/src/features/orders/orders.css'
const css = `
/* —— 2026-08-30 开单页排版调整：宋体 + 字号整体下调 —— */
.order-workspace{font-family:"SimSun","宋体",serif!important}
.order-workspace input,.order-workspace select,.order-workspace textarea,.order-workspace button{font-family:"SimSun","宋体",serif!important;font-size:12px}
.order-workspace>header h1{font-size:22px!important}
.order-workspace .product-browser h2,.order-workspace .selection-cart h2,.order-workspace .order-pipeline h2{font-size:14px!important}
.order-workspace .product-browser article strong,.order-workspace .selection-cart article strong{font-size:13px}
.order-workspace .selection-bar label{font-size:11px}
.order-workspace .cart-totals label,.order-workspace .cart-totals>span{font-size:12px}
.order-workspace .cart-totals>strong{font-size:14px!important}
.order-workspace .cart-totals .save-order{font-size:13px!important}
/* 实收价 / 定金比例 复合输入 */
.cart-totals .actual-price-field{display:flex;align-items:center;gap:6px}
.cart-totals .actual-price-field input{width:100%;border-color:#c3a06b!important}
.cart-totals .actual-price-field input:focus{outline:1px solid #701318}
.cart-totals .reset-actual{white-space:nowrap;min-height:34px!important;padding:0 8px;font-size:11px!important;border:1px dashed #b8c9be!important;background:#fff!important;color:#77817b!important;cursor:pointer}
.cart-totals .deposit-field{display:flex;align-items:center;gap:5px}
.cart-totals .deposit-field input{width:100%}
.cart-totals .deposit-field em{font-style:normal;color:#77817b;font-size:12px}
`
let current = readFileSync(target, 'utf8')
if (current.includes('2026-08-30 开单页排版调整')) {
  console.log('already patched, skip')
} else {
  if (!current.endsWith('\n')) current += '\n'
  appendFileSync(target, current.slice(-1) === '\n' ? css : css, 'utf8')
  console.log('orders.css patched')
}
