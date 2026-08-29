/**
 * 每日闭店自动备份。
 *
 *   node scripts/backup-daily.mjs
 *
 * 备份内容：
 *   - sales.sqlite（业务主库，含客户/订单/产品等）
 *   - app.db
 *   - uploads/（上传的图片附件）
 *
 * 为什么用 VACUUM INTO 而不是直接复制文件：
 *   SQLite 开着 WAL 时，数据先写在 sales.sqlite-wal 里，直接复制主库文件
 *   会漏掉还没合并进去的最新数据。VACUUM INTO 由 SQLite 自己产出一份
 *   完整、一致的快照，备份时不需要停服务。
 *
 * 备份位置：backups/daily-YYYY-MM-DD-HHmm/
 * 保留策略：只保留最近 30 份自动备份，更早的自动删除（手动备份不受影响）
 */

import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { mkdirSync, existsSync, copyFileSync, readdirSync, rmSync, appendFileSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'server/data')
const BACKUP_DIR = resolve(ROOT, 'backups')
const LOG_DIR = resolve(ROOT, 'logs')
const KEEP_DAYS = 7
const KEEP_WEEKLIES = 8
const PREFIX = 'daily-'

mkdirSync(BACKUP_DIR, { recursive: true })
mkdirSync(LOG_DIR, { recursive: true })

function log(message) {
  const line = `[${new Date().toLocaleString('zh-CN', { hour12: false })}] ${message}\n`
  try {
    appendFileSync(join(LOG_DIR, 'backup.log'), line, 'utf8')
  } catch {
    // 日志写不进去不影响备份本身
  }
  console.log(line.trimEnd())
}

function stamp() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/**
 * 手写递归复制。
 * 不用 fs.cpSync：实测在这个项目的 uploads 目录（300+ 个图片附件）上会把 node 进程直接搞崩。
 */
function copyDir(source, target) {
  mkdirSync(target, { recursive: true })
  let count = 0
  let bytes = 0
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name)
    const to = join(target, entry.name)
    if (entry.isDirectory()) {
      const nested = copyDir(from, to)
      count += nested.count
      bytes += nested.bytes
      continue
    }
    copyFileSync(from, to)
    count += 1
    bytes += statSync(from).size
  }
  return { count, bytes }
}

function backupSqlite(source, target) {
  if (!existsSync(source)) {
    log(`跳过，文件不存在：${source}`)
    return false
  }
  const db = new DatabaseSync(source)
  try {
    db.exec(`VACUUM INTO '${target}'`)
    const size = statSync(target).size
    log(`已备份 ${source.split(/[\\/]/).pop()} → ${(size / 1024).toFixed(0)} KB`)
    return true
  } catch (error) {
    log(`备份失败 ${source}：${error?.message || error}`)
    return false
  } finally {
    db.close()
  }
}

/**
 * 从目录名 daily-YYYY-MM-DD-HHmmss 还原出日期，认不出来就返回 null。
 */
function parseStamp(name) {
  const match = /^daily-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(name)
  if (!match) return null
  const [, y, m, d, hh, mm, ss] = match
  return new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))
}

/**
 * 保留策略：最近 7 天的每天一份，外加最近 8 个周日的归档。
 * uploads 一次就是几百 MB，全留会把硬盘吃光，所以只留这个量。
 */
function prune() {
  const entries = readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(PREFIX))
    .map((entry) => ({ name: entry.name, date: parseStamp(entry.name) }))
    .filter((entry) => entry.date)
    .sort((a, b) => a.date - b.date)

  if (!entries.length) return

  const keep = new Set()
  for (const entry of entries.slice(-KEEP_DAYS)) keep.add(entry.name)
  const weeklies = entries.filter((entry) => entry.date.getDay() === 0).slice(-KEEP_WEEKLIES)
  for (const entry of weeklies) keep.add(entry.name)

  const stale = entries.filter((entry) => !keep.has(entry.name))
  for (const entry of stale) {
    try {
      rmSync(join(BACKUP_DIR, entry.name), { recursive: true, force: true })
      log(`清理旧备份：${entry.name}`)
    } catch (error) {
      log(`清理失败 ${entry.name}：${error?.message || error}`)
    }
  }
}

function main() {
  const target = join(BACKUP_DIR, PREFIX + stamp())
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  mkdirSync(target, { recursive: true })
  log(`开始备份 → ${target}`)

  const results = [
    backupSqlite(join(DATA_DIR, 'sales.sqlite'), join(target, 'sales.sqlite')),
    backupSqlite(join(DATA_DIR, 'app.db'), join(target, 'app.db')),
  ]

  const uploads = join(DATA_DIR, 'uploads')
  if (existsSync(uploads)) {
    try {
      const copied = copyDir(uploads, join(target, 'uploads'))
      log(`已备份 uploads/ → ${copied.count} 个文件，${(copied.bytes / 1048576).toFixed(1)} MB`)
      results.push(true)
    } catch (error) {
      log(`备份 uploads 失败：${error?.message || error}`)
      results.push(false)
    }
  }

  prune()

  const ok = results.every(Boolean)
  log(ok ? `备份完成：${target}` : `备份完成但有失败项：${target}`)
  if (!ok) process.exitCode = 1
}

/**
 * 挑一个长期稳定的 node 来跑计划任务。
 * 不能用 WorkBuddy 托管运行时那种可能被清理的路径。
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

const TASK_NAME = 'ShangPinJuSalesBackup'
const SCHEDULE_TIME = process.env.SALES_BACKUP_TIME || '21:30'

function taskCommandLine() {
  return `cmd.exe /c start "" /b "${stableNode()}" "${resolve(ROOT, 'scripts/backup-daily.mjs')}"`
}

function installSchedule() {
  if (process.platform !== 'win32') {
    console.log('当前不是 Windows，跳过计划任务注册。')
    return
  }
  execFileSync(
    'schtasks',
    ['/create', '/tn', TASK_NAME, '/tr', taskCommandLine(), '/sc', 'DAILY', '/st', SCHEDULE_TIME, '/f'],
    { encoding: 'utf8', stdio: 'pipe' }
  )
  console.log(`已注册每日备份任务：${TASK_NAME}`)
  console.log(`  时间：每天 ${SCHEDULE_TIME}（闭店后）`)
  console.log(`  想改时间：先 set SALES_BACKUP_TIME=22:00，再执行一次 install`)
}

function uninstallSchedule() {
  if (process.platform !== 'win32') return
  try {
    execFileSync('schtasks', ['/delete', '/tn', TASK_NAME, '/f'], { encoding: 'utf8', stdio: 'pipe' })
    console.log(`已删除备份任务：${TASK_NAME}`)
  } catch (error) {
    console.log(`删除失败或任务不存在：${error?.message || error}`)
  }
}

function showStatus() {
  if (process.platform === 'win32') {
    try {
      const output = execFileSync('schtasks', ['/query', '/tn', TASK_NAME, '/fo', 'LIST'], {
        encoding: 'utf8',
        stdio: 'pipe',
      })
      console.log(`每日备份任务 ${TASK_NAME}：${/已禁用|Disabled/.test(output) ? '已禁用' : '已注册'}`)
      const time = /(\d{2}:\d{2}):\d{2}/.exec(output)
      if (time) console.log(`  执行时间：每天 ${time[1]}`)
    } catch {
      console.log(`每日备份任务 ${TASK_NAME}：未注册（不会自动备份）`)
    }
  }
  const entries = readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(PREFIX))
    .map((entry) => entry.name)
    .sort()
  console.log(`已有自动备份 ${entries.length} 份${entries.length ? `，最新：${entries[entries.length - 1]}` : ''}`)
}

const action = process.argv[2]
if (action === 'install') installSchedule()
else if (action === 'uninstall') uninstallSchedule()
else if (action === 'status') showStatus()
else main()
