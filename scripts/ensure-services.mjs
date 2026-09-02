/**
 * 兜底拉起：检查 3001 / 5173，不通就把服务拉起来，然后自己退出（不留常驻进程）。
 *
 *   node scripts/ensure-services.mjs
 *
 * 为什么需要它：
 *   service-guard（常驻守护）的计划任务触发器是「用户登录时」，
 *   电脑重启后没人登录、或休眠/锁屏唤醒后，守护进程不会自启 —— 服务就一直挂着。
 *   这个脚本由「系统启动时」和「每小时」两个计划任务调用，负责把服务补起来。
 *
 * 幂等：端口都在就直接退出；重复运行不会拉起第二份服务。
 */

import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEV = resolve(ROOT, 'scripts/dev.mjs')
const API_PORT = Number(process.env.SALES_API_PORT || 3001)
const UI_PORT = Number(process.env.SALES_UI_PORT || 5173)

function portOpen(port) {
  return new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (open) => {
      socket.destroy()
      done(open)
    }
    socket.setTimeout(2000)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function stableNode() {
  const candidates =
    process.platform === 'win32'
      ? ['C:\\Program Files\\nodejs\\node.exe']
      : ['/usr/local/bin/node', '/usr/bin/node']
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return process.execPath
}

const [apiUp, uiUp] = await Promise.all([portOpen(API_PORT), portOpen(UI_PORT)])

if (apiUp && uiUp) {
  console.log(`[ensure-services] 后端 ${API_PORT}、前端 ${UI_PORT} 均正常，无需操作`)
  process.exit(0)
}

console.log(`[ensure-services] 检测到服务缺失（后端 ${apiUp ? '正常' : '未运行'}、前端 ${uiUp ? '正常' : '未运行'}），开始拉起…`)
const child = spawn(stableNode(), [DEV], {
  cwd: ROOT,
  detached: true,
  stdio: 'ignore',
  windowsHide: true,
})
child.unref()
console.log(`[ensure-services] 已拉起 dev.mjs pid=${child.pid}，等待端口就绪…`)

// 最多等 90 秒，确认端口起来（计划任务里给个明确结果日志）
const deadline = Date.now() + 90_000
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 3000))
  const [ok1, ok2] = await Promise.all([portOpen(API_PORT), portOpen(UI_PORT)])
  if (ok1 && ok2) {
    console.log(`[ensure-services] 服务已就绪：http://<本机内网IP>:${UI_PORT}`)
    process.exit(0)
  }
}
console.log('[ensure-services] 90 秒内端口仍未就绪，请检查 logs/dev-server.log')
process.exit(1)
