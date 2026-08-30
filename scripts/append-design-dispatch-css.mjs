import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const file = resolve('src/features/tasks/tasks.css')
const css = `
.design-load-board{display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-width:1180px;margin:0 auto 12px;padding:10px 14px;background:#fff;border:1px solid var(--task-line);border-left:3px solid #c9a23a}
.design-load-board b{margin-right:6px;color:var(--task-green);font-size:12px}
.design-load-chip{padding:4px 9px;border-radius:10px;background:#f3f5f3;color:#4e5752;font-size:11px}
.design-assign{display:flex;align-items:center;flex-wrap:wrap;gap:8px;width:100%;padding:10px 12px;background:#fbf6ee;border:1px dashed #e0c48f}
.design-assign label{display:flex;align-items:center;gap:6px;color:#6b5a2e;font-size:12px}
.design-assign select{min-height:34px;padding:0 8px;border:1px solid #d8c79a;background:#fff;color:var(--task-ink)}
.design-assign button{min-height:34px;padding:0 12px;border:1px solid var(--task-green);background:var(--task-green);color:#fff;font-weight:600;cursor:pointer}
.design-assign button:disabled{opacity:.5;cursor:not-allowed}
.design-task-card h2 i.pri-较急{color:#b6791f;background:#faf0db}
.design-task-card h2 i.pri-紧急{color:#a34631;background:#f8ebe7}
.design-task-card h2 i.pri-特急{color:#fff;background:#c23a2b}
`
const current = readFileSync(file, 'utf8')
if (current.includes('.design-load-board')) {
  console.log('styles already present, skip')
} else {
  writeFileSync(file, current + css, 'utf8')
  console.log('appended design dispatch styles')
}
