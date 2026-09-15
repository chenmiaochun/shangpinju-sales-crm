/**
 * 服务体检：一次看清「服务在不在、地址是什么、哪里卡住」。
 *
 *   node scripts/doctor.mjs
 *
 * 排查「网页打不开」时先跑这个。
 */

import { connect } from 'node:net'
import { networkInterfaces } from 'node:os'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = Number(process.env.SALES_API_PORT || 3001)
const UI_PORT = Number(process.env.SALES_UI_PORT || 5173)

function portOpen(port) {
  return new Promise((done) => {
    const socket = connect({ host: '127.0.0.1', port })
    const finish = (open) => { socket.destroy(); done(open) }
    socket.setTimeout(2000)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

function nodeProcs() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name=\'node.exe\'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Depth 3"',
      { encoding: 'utf8', windowsHide: true }
    )
    const parsed = JSON.parse(out)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return []
  }
}

console.log('='.repeat(58))
console.log('尚品居销售系统 · 服务体检')
console.log('='.repeat(58))
console.log('时间: ' + new Date().toLocaleString('zh-CN', { hour12: false }))
console.log('')

console.log('[1] 本机地址')
let primary = null
let primaryMac = ''
for (const [name, list] of Object.entries(networkInterfaces())) {
  for (const net of list || []) {
    if (net.family !== 'IPv4' || net.internal) continue
    const usable = !net.address.startsWith('169.254.')
    console.log('  ' + (usable ? '可用' : '无效') + '  ' + name + ': ' + net.address + (usable ? '  MAC=' + (net.mac || '').toUpperCase() : ' (系统自分配，没拿到 DHCP)'))
    if (usable && !primary) { primary = net.address; primaryMac = (net.mac || '').toUpperCase() }
  }
}
console.log('')

const apiUp = await portOpen(API_PORT)
const uiUp = await portOpen(UI_PORT)
console.log('[2] 服务端口')
console.log('  后端 ' + API_PORT + ': ' + (apiUp ? '通' : '未运行'))
console.log('  前端 ' + UI_PORT + ': ' + (uiUp ? '通' : '未运行'))
console.log('')

const procs = nodeProcs()
const guard = procs.filter((p) => (p.CommandLine || '').includes('service-guard'))
const dev = procs.filter((p) => (p.CommandLine || '').includes('dev.mjs'))
console.log('[3] 进程')
console.log('  守护进程: ' + (guard.length ? guard.map((p) => 'pid=' + p.ProcessId).join(', ') : '没有在跑'))
console.log('  服务进程: ' + (dev.length ? dev.map((p) => 'pid=' + p.ProcessId).join(', ') : '没有在跑'))
console.log('')

console.log('[4] 计划任务')
if (process.platform === 'win32') {
  for (const task of ['ShangPinJuSalesGuard', 'ShangPinJuSalesBackup']) {
    try {
      const out = execSync('schtasks /query /tn ' + task + ' /fo LIST', { encoding: 'utf8', stdio: 'pipe' })
      const disabled = /已禁用|Disabled/.test(out)
      const time = /(\d{2}:\d{2}):\d{2}/.exec(out)
      console.log('  ' + task + ': ' + (disabled ? '已禁用' : '已注册') + (time ? '（' + time[1] + '）' : ''))
    } catch {
      console.log('  ' + task + ': 未注册')
    }
  }
}
console.log('')

console.log('[5] 实际访问测试（用上面那个可用地址真连一次）')
if (primary) {
  const base = 'http://' + primary + ':' + UI_PORT
  try {
    const page = await fetch(base + '/', { headers: { Origin: base } })
    console.log('  页面 ' + base + ' -> HTTP ' + page.status + (page.status === 200 ? ' 正常' : ' 异常'))
  } catch (error) {
    console.log('  页面 ' + base + ' -> 打不开: ' + error.message)
  }
  try {
    const api = await fetch('http://' + primary + ':' + API_PORT + '/api/health', { headers: { Origin: base } })
    const body = await api.json().catch(() => null)
    console.log('  接口 /api/health -> HTTP ' + api.status + ' ' + JSON.stringify(body || {}))
  } catch (error) {
    console.log('  接口 /api/health -> 打不开: ' + error.message)
  }
} else {
  console.log('  没找到可用的内网地址')
}
console.log('')

console.log('[6] 守护日志（最后 10 行）')
const logDir = join(ROOT, 'logs')
if (existsSync(logDir)) {
  const files = readdirSync(logDir).filter((f) => f.startsWith('service-guard-')).sort()
  if (files.length) {
    const lines = readFileSync(join(logDir, files[files.length - 1]), 'utf8').split(/\r?\n/).filter(Boolean)
    for (const line of lines.slice(-12)) console.log('  ' + line)
  } else {
    console.log('  没有日志文件')
  }
} else {
  console.log('  没有 logs 目录')
}
console.log('')

console.log('='.repeat(58))
console.log('结论')
console.log('='.repeat(58))
if (apiUp && uiUp) {
  console.log('  服务正常')
  console.log('  本机访问: http://localhost:' + UI_PORT)
  console.log('  员工访问: http://' + (primary || '<本机内网IP>') + ':' + UI_PORT)
} else {
  console.log('  服务没起来。修法：')
  console.log('    node scripts/install-autostart.mjs install')
  console.log('  它会注册计划任务并立刻拉起服务，等 10 秒后再打开页面')
}
