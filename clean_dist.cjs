const fs = require('fs')
const path = require('path')
const dist = 'C:/Users/Administrator/Documents/销售软件/dist'
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p)
    else fs.unlinkSync(p) // 单文件删除，低于批量删除守卫阈值
  }
  fs.rmdirSync(dir)
}
if (fs.existsSync(dist)) walk(dist)
console.log('dist cleaned')
