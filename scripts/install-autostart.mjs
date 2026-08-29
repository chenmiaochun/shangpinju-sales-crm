/**
 * 把销售系统注册为「开机自动启动」。
 *
 *   node scripts/install-autostart.mjs install    注册计划任务并立刻拉起服务
 *   node scripts/install-autostart.mjs status     查看计划任务与服务端口状态
 *   node scripts/install-autostart.mjs uninstall  取消开机自启
 *
 * 原理：
 *   创建一个 Windows 计划任务，在用户登录时拉起 scripts/service-guard.mjs；
 *   守护进程每 30 秒检查一次端口，服务挂了自己拉回来。
 *   任务本身用 cmd /c start /b 包装，不会留下黑窗口。
 */

import { spawn, execFileSync } from 'node:child_process'
import { connect } from 'node:net'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TASK_NAME = 'ShangPinJuSalesGuard'
const GUARD = resolve(ROOT, 'scripts/service-guard.mjs')
const API_PORT = Number(process.env.SALES_API_PORT || 3001)
const UI_PORT = Number(process.env.SALES_UI_PORT || 5173)

const command = process.platform === 'win32' ? 'schtasks' : 'echo'

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

/**
 * 挑一个长期稳定的 node 来跑守护进程。
 * 计划任务要无人值守跑很久，不能用 WorkBuddy 托管运行时那种可能被清理的路径。
 */
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

function taskCommandLine() {
  return `cmd.exe /c start "" /b "${stableNode()}" "${GUARD}"`
}

function install() {
  if (process.platform !== 'win32') {
    console.log('当前不是 Windows，跳过计划任务注册。')
    return
  }
  execFileSync(
    'schtasks',
    ['/create', '/tn', TASK_NAME, '/tr', taskCommandLine(), '/sc', 'ONLOGON', '/f'],
    { encoding: 'utf8', stdio: 'pipe' }
  )
  console.log(`已注册计划任务：${TASK_NAME}`)
  console.log(`  触发：每次登录 Windows`)
  console.log(`  动作：${taskCommandLine()}`)

  const guard = spawn(stableNode(), [GUARD], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: process.env,
    windowsHide: true,
  })
  guard.unref()
  console.log(`守护进程已启动 pid=${guard.pid}`)
}

function uninstall() {
  if (process.platform !== 'win32') {
    console.log('当前不是 Windows，无需处理。')
    return
  }
  try {
    execFileSync('schtasks', ['/delete', '/tn', TASK_NAME, '/f'], { encoding: 'utf8', stdio: 'pipe' })
    console.log(`已删除计划任务：${TASK_NAME}（服务本身不会因此停止）`)
  } catch (error) {
    console.log(`删除失败或任务不存在：${error?.message || error}`)
  }
}

async function status() {
  if (process.platform === 'win32') {
    try {
      const output = execFileSync('schtasks', ['/query', '/tn', TASK_NAME, '/fo', 'LIST'], {
        encoding: 'utf8',
        stdio: 'pipe',
      })
      const ready = /就绪|Ready|运行中|Running/.test(output)
      const enabled = !/已禁用|Disabled/.test(output)
      console.log(`计划任务 ${TASK_NAME}：${enabled ? (ready ? '已注册，正常' : '已注册，状态异常') : '已禁用'}`)
    } catch {
      console.log(`计划任务 ${TASK_NAME}：未注册（开机不会自动启动）`)
    }
  }
  const apiUp = await portOpen(API_PORT)
  const uiUp = await portOpen(UI_PORT)
  console.log(`后端 ${API_PORT}：${apiUp ? '正常' : '未运行'}`)
  console.log(`前端 ${UI_PORT}：${uiUp ? '正常' : '未运行'}`)
  console.log(`员工访问地址：http://<本机内网IP>:${UI_PORT}`)
}

const action = process.argv[2] || 'status'
if (action === 'install') install()
else if (action === 'uninstall') uninstall()
else if (action === 'status') await status()
else {
  console.log('用法：node scripts/install-autostart.mjs install | status | uninstall')
  process.exit(1)
}
