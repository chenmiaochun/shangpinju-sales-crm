/**
 * 修复/重建品类名称：补全 state.categories 数组
 *
 * 问题：state.categories 为空，导致服务端无法把 categoryId 解析成 categoryName，
 *       采集台/产品目录的品类筛选器全部显示"未分类"。
 *
 * 用法：node scripts/fix-categories.mjs
 * 幂等：重复运行安全（先查后写，已存在则跳过）。
 *
 * ⚠️ 关键：setState 必须传入完整 state 对象（含 configProducts 等所有字段），
 *    因为 mergeConcurrentState 的逻辑是 merged={...incoming}，只保留传入的字段。
 *    绝不能只传 { categories: [...] }，否则其他字段（configProducts 等）会全部丢失！
 */
import { SalesDatabase } from '../server/database.mjs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const db = new SalesDatabase(path.join(__dirname, '..', 'server', 'data', 'sales.sqlite'))

// 从产品数据反推的 categoryId -> 品类名映射（基于产品名推断）
const CATEGORY_MAP = {
  '717dd7ec-c52a-444d-9acb-1a7ce0fff610': '床',
  '6bc23cef-2ff6-46a6-8f69-eb07129ba4d3': '柜架',
  '0a6f550b-4a62-4839-bd43-62ad28381bbc': '椅凳',
  'e5dc21cf-c60b-4119-955b-6c3f264d9d2a': '餐台',
  'aeb4bdc3-b789-4ecc-bbdd-ddb44116f92c': '沙发',
  'f97b1d19-b1d5-4301-ad6f-190d49bda8d0': '茶台',
  'd9c1a8c2-d5f4-41f2-ab8b-c12839732297': '几类',
  '8f4bdd0f-4f20-43b7-8393-dc6f80b1f1a3': '配件',
}

// ⚠️ 读完整 state，修改后整体写回（防止 mergeConcurrent 丢字段）
const fullState = db.getState().value
const categories = fullState.categories || []

if (categories.length > 0) {
  console.log(`categories 已有 ${categories.length} 条，检查是否需要补充...`)
}

// 构建完整的 categories 数组（保留已有的 + 补缺的）
const existingIds = new Set(categories.map(c => c.id))
let added = 0
for (const [id, name] of Object.entries(CATEGORY_MAP)) {
  if (!existingIds.has(id)) {
    categories.push({ id, name, sort: categories.length })
    added++
    console.log(`  + ${name} (${id})`)
  }
}

if (added === 0 && categories.length > 0) {
  console.log('所有品类已存在，无需修改。')
  process.exit(0)
}

// 写回：修改完整 state 的引用后整体传入 setState
fullState.categories = categories
db.setState(fullState)
console.log(`\n完成：categories 现有 ${categories.length} 条（新增 ${added} 条）`)

// 验证：确认每个产品的 categoryId 都能解析到名字
const products = fullState.configProducts || []
const catMap = Object.fromEntries(categories.map(c => [c.id, c.name]))
let unresolved = 0
for (const p of products) {
  const name = catMap[p.categoryId]
  if (!name) unresolved++
}
console.log(`验证：${products.length} 个产品中，${products.length - unresolved} 个可解析品类名，${unresolved} 个未匹配`)
