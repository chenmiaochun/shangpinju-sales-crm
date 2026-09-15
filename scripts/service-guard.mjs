/**
 * 服务守护进程：让销售系统在电脑重启、服务崩溃后自动恢复。
 *
 * 用法（一般由计划任务在用户登录时自动拉起）：
 *   node scripts/service-guard.mjs
 *
 * 行为：
 *   - 每 30 秒检查 3001（后端）和 5173（前端）是否在监听；
 *   - 任一端口不通，就清理残留进程并重新拉起 scripts/dev.mjs；
 *   - 刚拉起后给 60 秒宽限期，避免 vite 还没编译完就被误判为挂掉；
 *   - 端口本来就通（比如手动 npm run dev 起的），本脚本不会重复启动。
 *
 * 日志：logs/service-guard-YYYY-MM-DD.log
 */

import { spawn, execSync } from 'node:child_process'
import { connect } from 'node:net'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { localLanAddresses } from '../server/lan.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = Number(process.env.SALES_API_PORT || 3001)
const UI_PORT = Number(process.env.SALES_UI_PORT || 5173)
const CHECK_INTERVAL_MS = 30_000
const GRACE_AFTER_START_MS = 60_000
const LOG_DIR = resolve(ROOT, 'logs')
const DEV_SCRIPT = resolve(ROOT, 'scripts/dev.mjs')

mkdirSync(LOG_DIR, { recursive: true })

function logFile() {
  const day = new Date().toISOString().slice(0, 10)
  return resolve(LOG_DIR, `service-guard-${day}.log`)
}

function writeLog(line) {
  const text = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${line}\n`
  try {
    appendFileSync(logFile(), text, 'utf8')
  } catch {
    // 日志写不进去也不能让守护进程死掉
  }
  console.log(text.trimEnd())
}

/**
 * 把当前能访问的地址写进项目根目录的「访问地址.txt」。
 *
 * 路由器 DHCP 会换 IP（本项目半个月里换过两次：110.127 → 1.17 → 1.161），
 * 一换员工收藏的地址就失效、网页就打不开。
 * 这个文件让老板随时能查到当前地址；IP 一变守护进程立刻更新并记进日志。
 */
const ADDRESS_FILE = resolve(ROOT, '访问地址.txt')
let lastAddressKey = ''

function refreshAddressFile() {
  const addresses = localLanAddresses().filter((address) => !address.startsWith('169.254.'))
  const key = addresses.join(',')
  if (key === lastAddressKey) return
  const previous = lastAddressKey
  lastAddressKey = key
  const at = new Date().toLocaleString('zh-CN', { hour12: false })
  const lines = [
    '尚品居销售系统 · 当前访问地址',
    '',
    '这台电脑自己用：  http://localhost:' + UI_PORT,
    '',
    addresses.length ? '员工（连同一个网络）用：' : '员工访问：未检测到可用的内网地址，请检查网络连接',
    ...addresses.map((address) => '  http://' + address + ':' + UI_PORT),
    '',
    '更新时间：' + at,
    '',
    '这个文件由守护进程自动维护，IP 变了会自动重写。',
    '还是打不开？在项目目录运行：node scripts/doctor.mjs',
  ]
  try {
    writeFileSync(ADDRESS_FILE, lines.join('\n'), 'utf8')
  } catch {
    return
  }
  if (previous && previous !== key) writeLog(`内网地址变化：${previous} → ${key || '(无)'}`)
  else if (key) writeLog(`访问地址：${addresses.map((a) => `http://${a}:${UI_PORT}`).join('、')}`)
}

function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms))
}

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

function killPidTree(pid) {
  if (!pid) return
  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', windowsHide: true })
    } catch {
      // 进程已经不在了，忽略
    }
    return
  }
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // 忽略
    }
  }
}

function pidsListeningOn(port) {
  if (process.platform !== 'win32') return []
  try {
    const output = execSync('netstat -ano -p tcp', { encoding: 'utf8', windowsHide: true })
    const pids = new Set()
    for (const line of output.split(/\r?\n/)) {
      if (!/LISTENING/i.test(line)) continue
      const parts = line.trim().split(/\s+/)
      if (parts.length < 5) continue
      const local = parts[1] || ''
      const pid = parts[parts.length - 1]
      if (local.endsWith(`:${port}`) && /^[1-9]\d*$/.test(pid)) pids.add(Number(pid))
    }
    return [...pids]
  } catch {
    return []
  }
}

let child = null
let busy = false
let graceUntil = 0

function spawnDev() {
  const proc = spawn(process.execPath, [DEV_SCRIPT], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const pipe = (chunk) => {
    const text = String(chunk).trimEnd()
    if (text) writeLog(`  ${text}`)
  }
  proc.stdout.on('data', pipe)
  proc.stderr.on('data', pipe)
  proc.on('exit', (code, signal) => {
    writeLog(`服务进程退出 code=${code} signal=${signal || '-'}`)
    if (child === proc) child = null
  })
  return proc
}

async function ensureRunning() {
  if (busy) return
  busy = true
  try {
    const apiUp = await portOpen(API_PORT)
    const uiUp = await portOpen(UI_PORT)
    if (apiUp && uiUp) return

    writeLog(`端口不通：${!apiUp ? API_PORT : ''}${!apiUp && !uiUp ? '、' : ''}${!uiUp ? UI_PORT : ''} → 准备拉起`)

    for (const port of [API_PORT, UI_PORT]) {
      for (const pid of pidsListeningOn(port)) {
        writeLog(`清理残留进程 pid=${pid}（占用 ${port}）`)
        killPidTree(pid)
      }
    }
    if (child) {
      killPidTree(child.pid)
      child = null
    }
    await sleep(1500)
    child = spawnDev()
    graceUntil = Date.now() + GRACE_AFTER_START_MS
    writeLog(`已拉起服务进程 pid=${child.pid}`)
  } catch (error) {
    writeLog(`检查异常：${error?.message || error}`)
  } finally {
    busy = false
  }
}

async function tick() {
  refreshAddressFile()
  if (Date.now() < graceUntil) return
  await ensureRunning()
}

function shutdown() {
  writeLog('守护进程退出')
  if (child) killPidTree(child.pid)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

writeLog(`守护进程启动 pid=${process.pid}，项目目录 ${ROOT}`)
writeLog(`监控端口 ${API_PORT}（后端）、${UI_PORT}（前端），每 ${CHECK_INTERVAL_MS / 1000} 秒检查一次`)

await ensureRunning()
refreshAddressFile()
setInterval(() => {
  tick().catch((error) => writeLog(`tick 异常：${error?.message || error}`))
}, CHECK_INTERVAL_MS)
