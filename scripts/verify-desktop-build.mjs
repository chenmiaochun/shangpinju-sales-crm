// 校验打包产物：列出 app.asar 内容，确认三个关键文件都在
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { listPackage } = require('C:/Users/Administrator/Documents/销售软件/node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar/lib/asar.js')
import { statSync } from 'node:fs'

const ASAR = 'C:/Temp/SPJDesktopTest/resources/app.asar'
const stat = statSync(ASAR)
console.log('app.asar 大小：', (stat.size / 1024 / 1024).toFixed(2), 'MB')

// asar 内部路径是反斜杠（Windows），先统一成正斜杠再比对
const files = listPackage(ASAR).map((name) => String(name).replace(/\\/g, '/').replace(/^\//, ''))
console.log('打包文件总数：', files.length)
console.log('根目录内容：')
for (const file of files.filter((name) => !name.includes('/'))) console.log('  -', file)
console.log('desktop 目录内容：')
for (const file of files.filter((name) => name.startsWith('desktop/'))) console.log('  -', file)

const need = ['desktop/main.cjs', 'desktop/preload.cjs', 'desktop/offline.html', 'package.json']
const missing = need.filter((name) => !files.includes(name))
console.log('\n关键文件检查：')
for (const name of need) {
  const found = files.includes(name) || files.includes('/' + name)
  console.log(' ', found ? '✅' : '❌', name)
}
console.log(missing.length ? '\n有文件缺失！' : '\n全部就位 ✅')
