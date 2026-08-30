import { readFileSync, writeFileSync } from 'node:fs'

const file = 'src/features/data-admin/data-admin.css'
const extra = `
/* 2026-08-30 门店收款设置面板 */
.payment-settings{border:1px solid #d9cfc7;background:#fffaf8;padding:16px 18px;margin-top:16px;border-radius:4px}
.payment-settings-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
.payment-settings-head h2{margin:0;font-size:17px;color:#3a2f2a}
.payment-settings-head span{display:block;color:#7a6f68;font-size:12px;margin-top:4px;max-width:560px}
.payment-enabled-toggle{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#8b1a1e;white-space:nowrap;cursor:pointer}
.payment-qr-row{display:flex;gap:20px;flex-wrap:wrap;margin-bottom:14px}
.payment-qr-card{flex:1 1 220px;border:1px dashed #cdbdb1;padding:12px;border-radius:4px;background:#fff}
.payment-qr-card>b{display:block;font-size:13px;margin-bottom:8px}
.payment-qr-card figure{margin:0;position:relative;display:inline-block}
.payment-qr-card figure img{width:120px;height:120px;object-fit:contain;border:1px solid #ddd;background:#fff;display:block}
.payment-qr-clear{position:absolute;top:-8px;right:-8px;display:inline-flex;align-items:center;gap:3px;border:0;background:#8b1a1e;color:#fff;border-radius:10px;padding:2px 6px;font-size:11px;cursor:pointer}
.payment-qr-upload{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid #8b1a1e;background:#fff;color:#8b1a1e;font-weight:700;border-radius:4px;cursor:pointer}
.payment-banks{border:1px solid #e7ddd5;padding:12px;border-radius:4px;margin-bottom:14px;background:#fff}
.payment-banks-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.payment-banks-head>b{font-size:13px}
.payment-bank-add{display:inline-flex;align-items:center;gap:4px;border:0;background:#8b1a1e;color:#fff;padding:5px 10px;border-radius:4px;font-size:12px;cursor:pointer}
.payment-bank-row{display:grid;grid-template-columns:1.2fr 1fr 1.6fr 36px;gap:8px;margin-bottom:8px}
.payment-bank-row input{min-height:36px;border:1px solid #cdbdb1;padding:0 9px;font-size:13px}
.payment-bank-del{border:1px solid #cdbdb1;background:#fff;color:#a33;cursor:pointer;border-radius:4px}
.payment-note-field{display:block}
.payment-note-field>b{display:block;font-size:13px;margin-bottom:6px}
.payment-note-field textarea{width:100%;min-height:54px;border:1px solid #cdbdb1;padding:8px;font-size:13px;resize:vertical}
.payment-actions{display:flex;align-items:center;gap:14px;margin-top:4px}
.payment-save{border:0;background:#8b1a1e;color:#fff;font-weight:700;min-height:40px;padding:0 20px;border-radius:4px;cursor:pointer}
.payment-notice{color:#27603d;font-weight:700;font-size:13px}
.payment-saved-at{color:#7a6f68;font-size:12px}
`
const prev = readFileSync(file, 'utf8')
if (prev.includes('.payment-settings{')) {
  console.log('already present, skip')
} else {
  writeFileSync(file, prev.replace(/\s*$/, '') + '\n' + extra, 'utf8')
  console.log('appended')
}
