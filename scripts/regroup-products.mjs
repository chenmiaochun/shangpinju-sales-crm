// 产品分组回填 + 清空图片（改进版，可重跑幂等）
// 用法：node scripts/regroup-products.mjs
// 分组键（mergeKey）= 名称去掉「·尺寸/材质」后缀，再去掉末尾「（）」描述符。
//   例：
//     - 鹅卵石茶台·1600*700*750/北美黑胡桃木  → key=鹅卵石茶台
//     - 简约床（1.5米）·北美黑胡桃木           → key=简约床（去「·」再去「（1.5米）」）
//     - 心适沙发单人位（真皮）·1040*1040*420    → key=心适沙发单人位（去「·」再去「（真皮）」）
//     - 鹅卵石高柜（A）·1200*400*1600          → key=鹅卵石高柜（去「·」再去「（A）」→ 与（B）并一张卡）
//   这样「一个产品一张卡、尺寸/版本在详情里选」的口径就统一了。
//   修改前先备份 state 到 C:/tmp/state-backup-<ts>.json。
import { SalesDatabase } from '../server/database.mjs'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new SalesDatabase(path.join(__dirname, '..', 'server', 'data', 'sales.sqlite'))

const state = db.getState().value
const products = state.configProducts ?? []
console.log('产品总数:', products.length)

// 备份
const backupPath = `C:/tmp/state-backup-${Date.now()}.json`
fs.writeFileSync(backupPath, JSON.stringify(state, null, 2), 'utf8')
console.log('已备份原 state ->', backupPath)

// 简单稳定哈希（DJB2）
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// 从名称解析 mergeKey / parenthetical（（）描述符）/ dotPart（· 之后部分）
function parseName(name) {
  const raw = (name || '').trim()
  // 先按「·」拆分，第一段是主名，其余拼回 dotPart（可能含尺寸/材质）
  const dotIdx = raw.indexOf('·')
  let base = raw
  let dotPart = ''
  if (dotIdx >= 0) {
    base = raw.slice(0, dotIdx).trim()
    dotPart = raw.slice(dotIdx + 1).trim()
  }
  // 去掉末尾「（）」/「()」描述符（尺寸/版本/材质变体）
  let parenthetical = ''
  const m = base.match(/\s*[（(]([^（）()]*)[）)]\s*$/)
  if (m) {
    parenthetical = m[1].trim()
    base = base.slice(0, m.index).trim()
  }
  const mergeKey = base || raw
  const specLabel = [parenthetical, dotPart].filter(Boolean).join(' · ')
  return { mergeKey, specLabel }
}

const now = new Date().toISOString()
let changed = 0
for (const p of products) {
  const { mergeKey, specLabel } = parseName(p.name)
  const groupId = 'G-' + hash(mergeKey)
  const newMedia = { images: [] } // 清空图片，保留主数据，待规范重传
  const needUpdate =
    p.groupId !== groupId ||
    (p.specLabel ?? '') !== specLabel ||
    JSON.stringify(p.media) !== JSON.stringify(newMedia)
  if (needUpdate) {
    p.groupId = groupId
    p.specLabel = specLabel
    p.media = newMedia
    p.updatedAt = now
    changed++
  }
}
console.log('需更新:', changed)

db.setState(state)
console.log('已写回数据库。')

// 统计分组结果
const groups = {}
for (const p of products) {
  const g = p.groupId || '(none)'
  groups[g] = (groups[g] || 0) + 1
}
const multi = Object.entries(groups).filter(([, n]) => n > 1)
console.log('分组总数:', Object.keys(groups).length, ' 多成员组:', multi.length)
console.log('--- 多成员组（一个产品一张卡）---')
for (const [g, n] of multi.sort((a, b) => b[1] - a[1])) {
  const members = products.filter((p) => p.groupId === g).map((p) => p.specLabel || p.name)
  console.log(`  [${n}]`, members.join('  |  '))
}
