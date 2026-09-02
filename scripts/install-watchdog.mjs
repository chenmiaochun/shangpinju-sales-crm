/**
 * 注册「服务兜底」计划任务（配合 service-guard 常驻守护使用）。
 *
 *   node scripts/install-watchdog.mjs install    注册两个兜底任务
 *   node scripts/install-watchdog.mjs status     查看任务与服务状态
 *   node scripts/install-watchdog.mjs uninstall  删除两个兜底任务
 *
 * 背景：service-guard 的计划任务触发器是「用户登录时」，
 * 电脑重启后无人登录、或休眠/锁屏唤醒后不会自启，服务会一直挂。
 * 这里补两个兜底：
 *   1) ShangPinJuSalesGuard-Boot   —— 系统启动时（无需用户登录）
 *   2) ShangPinJuSalesGuard-Hourly —— 每小时整点检查一次
 * 两者都跑 scripts/ensure-services.mjs（幂等，端口在就直接退出）。
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = resolve(ROOT, 'scripts/ensure-services.mjs')

const TASKS = [
  { name: 'ShangPinJuSalesGuard-Boot', args: ['/sc', 'ONSTART'], label: '系统启动时（无需登录）' },
  { name: 'ShangPinJuSalesGuard-Hourly', args: ['/sc', 'HOURLY', '/mo', '1'], label: '每小时检查一次' },
]

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
  return `cmd.exe /c start "" /b "${stableNode()}" "${SCRIPT}"`
}

function install() {
  if (process.platform !== 'win32') {
    console.log('当前不是 Windows，跳过计划任务注册。')
    return
  }
  const node = stableNode()
  console.log(`使用 node：${node}`)
  console.log(`动作：${taskCommandLine()}\n`)

  for (const task of TASKS) {
    try {
      execFileSync(
        'schtasks',
        ['/create', '/tn', task.name, '/tr', taskCommandLine(), ...task.args, '/f'],
        { encoding: 'utf8', stdio: 'pipe' }
      )
      console.log(`✅ ${task.name} —— ${task.label}`)
    } catch (error) {
      const message = String(error?.stderr || error?.message || error)
      if (/拒绝访问|Access is denied/i.test(message)) {
        console.log(`❌ ${task.name} —— 需要管理员权限（请用「以管理员身份运行」的终端重跑本脚本）`)
      } else {
        console.log(`❌ ${task.name} —— 注册失败：${message.trim().split('\n')[0]}`)
      }
    }
  }
}

function uninstall() {
  for (const task of TASKS) {
    try {
      execFileSync('schtasks', ['/delete', '/tn', task.name, '/f'], { encoding: 'utf8', stdio: 'pipe' })
      console.log(`已删除计划任务：${task.name}`)
    } catch {
      console.log(`未找到或删除失败：${task.name}`)
    }
  }
}

function status() {
  for (const task of TASKS) {
    try {
      const output = execFileSync('schtasks', ['/query', '/tn', task.name, '/fo', 'LIST'], {
        encoding: 'utf8',
        stdio: 'pipe',
      })
      const enabled = !/已禁用|Disabled/.test(output)
      console.log(`${task.name}：${enabled ? '已注册' : '已禁用'} —— ${task.label}`)
    } catch {
      console.log(`${task.name}：未注册 —— ${task.label}`)
    }
  }
}

const action = process.argv[2] || 'status'
if (action === 'install') install()
else if (action === 'uninstall') uninstall()
else if (action === 'status') status()
else {
  console.log('用法：node scripts/install-watchdog.mjs install | status | uninstall')
  process.exit(1)
}
