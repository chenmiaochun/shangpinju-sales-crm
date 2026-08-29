import { networkInterfaces } from 'node:os'
import net from 'node:net'
import http from 'node:http'
import { execSync } from 'node:child_process'

const UI_PORT = 5173
const API_PORT = 3001

function run(cmd, timeout = 120000) {
  try {
    return execSync(cmd, { encoding: 'latin1', stdio: ['ignore', 'pipe', 'ignore'], timeout })
  } catch {
    return ''
  }
}

function localIPs() {
  const out = []
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) out.push({ name, address: info.address })
    }
  }
  return out
}

function portOpen(host, port, timeout = 1200) {
  return new Promise(resolve => {
    const socket = new net.Socket()
    let done = false
    const finish = value => { if (!done) { done = true; socket.destroy(); resolve(value) } }
    socket.setTimeout(timeout)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.connect(port, host)
  })
}

function httpProbe(url, origin) {
  return new Promise(resolve => {
    const req = http.get(url, { headers: origin ? { Origin: origin } : {} }, res => {
      res.resume()
      resolve({ status: res.statusCode, cors: res.headers['access-control-allow-origin'] || null })
    })
    req.setTimeout(4000, () => { req.destroy(); resolve({ status: null, cors: null }) })
    req.on('error', () => resolve({ status: null, cors: null }))
  })
}

function gateway() {
  const text = run('route print 0.0.0.0')
  const match = text.match(/0\.0\.0\.0\s+0\.0\.0\.0\s+(\d+\.\d+\.\d+\.\d+)/)
  return match ? match[1] : null
}

function pingOK(ip) {
  const text = run(`ping -n 1 -w 800 ${ip}`)
  return /TTL/i.test(text)
}

function firewallRules() {
  const text = run('netsh advfirewall firewall show rule name=all dir=in')
  return {
    ui: text.includes('Shangpinju-UI-5173'),
    api: text.includes('Shangpinju-API-3001'),
  }
}

function lanNeighbors(selfIP) {
  const prefix = selfIP.split('.').slice(0, 3).join('.')
  const text = run('arp -a')
  const set = new Set()
  for (const m of text.matchAll(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g)) {
    if (m[1].startsWith(prefix + '.') && m[1] !== selfIP && !m[1].endsWith('.255')) set.add(m[1])
  }
  return [...set]
}

function connectedClients(port, selfIP) {
  const text = run('netstat -ano')
  const set = new Set()
  for (const line of text.split(/\r?\n/)) {
    if (!/ESTABLISHED/i.test(line)) continue
    if (!new RegExp(`:${port}\\s`).test(line)) continue
    const m = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+/)
    if (m && m[1] !== '127.0.0.1' && m[1] !== selfIP) set.add(m[1])
  }
  return [...set]
}

const mark = ok => (ok ? 'OK  ' : 'FAIL')
const line = '='.repeat(58)

const ips = localIPs()
const primary = ips.find(i => i.address.startsWith('192.168.')) || ips[0]
const gw = gateway()
const fw = firewallRules()

console.log(line)
console.log('尚品居销售系统 · 网络自检')
console.log(line)
console.log(`时间: ${new Date().toLocaleString('zh-CN')}`)
console.log('')

console.log('[1] 本机网络')
if (!ips.length) console.log('  FAIL 未检测到内网 IP，请检查网络连接')
for (const i of ips) console.log(`  ${mark(true)} 网卡 ${i.name}: ${i.address}`)
console.log(`  ${mark(Boolean(gw))} 网关: ${gw || '未找到'}${gw ? ` (${pingOK(gw) ? '可达' : '禁 ping，正常'})` : ''}`)
console.log('')

const selfIP = primary ? primary.address : '127.0.0.1'

console.log('[2] 服务端口')
for (const [label, port] of [['前端 UI', UI_PORT], ['服务端 API', API_PORT]]) {
  const local = await portOpen('127.0.0.1', port)
  const lan = await portOpen(selfIP, port)
  console.log(`  ${mark(local && lan)} ${label} ${port}: 本机 ${local ? '通' : '不通'} / 内网 ${lan ? '通' : '不通'}`)
}
console.log('')

console.log('[3] 页面与接口探测')
const uiLocal = await httpProbe(`http://127.0.0.1:${UI_PORT}/`)
const uiLan = await httpProbe(`http://${selfIP}:${UI_PORT}/`)
const apiLan = await httpProbe(`http://${selfIP}:${UI_PORT}/api/health`)
console.log(`  ${mark(uiLocal.status === 200)} 本机页面 http://127.0.0.1:${UI_PORT} -> ${uiLocal.status ?? '无响应'}`)
console.log(`  ${mark(uiLan.status === 200)} 内网页面 http://${selfIP}:${UI_PORT} -> ${uiLan.status ?? '无响应'}`)
console.log(`  ${mark(apiLan.status === 200)} 接口代理 /api/health -> ${apiLan.status ?? '无响应'}`)
console.log('')

console.log('[4] 跨域白名单（决定手机/员工能否登录）')
const cors = await httpProbe(`http://${selfIP}:${API_PORT}/api/health`, `http://${selfIP}:${UI_PORT}`)
const corsOK = cors.cors === `http://${selfIP}:${UI_PORT}`
console.log(`  ${mark(corsOK)} 来源 http://${selfIP}:${UI_PORT} -> ${cors.cors || '未放行'}`)
if (!corsOK) console.log('     提示: 需把该地址加入 server/index.mjs 的 corsOrigin 白名单')
console.log('')

console.log('[5] 防火墙')
console.log(`  ${mark(fw.ui)} 入站规则 Shangpinju-UI-5173 ${fw.ui ? '已存在' : '缺失'}`)
console.log(`  ${mark(fw.api)} 入站规则 Shangpinju-API-3001 ${fw.api ? '已存在' : '缺失'}`)
console.log('')

console.log('[6] 局域网设备')
const neighbors = lanNeighbors(selfIP)
const reach = neighbors.map(ip => ({ ip, ok: pingOK(ip) }))
const okCount = reach.filter(r => r.ok).length
const detail = reach.map(r => `${r.ip}${r.ok ? '' : '(禁ping/离线)'}`).join(', ')
console.log(`  参考 发现 ${neighbors.length} 台设备: ${detail || '无'}`)
console.log(`  参考 可 ping 通 ${okCount}/${neighbors.length}（设备禁 ping 属正常，不影响访问）`)
console.log('')

console.log('[7] 当前已连接的客户端')
const clients = connectedClients(UI_PORT, selfIP)
console.log(`  ${clients.length ? clients.join(', ') : '暂无外部设备连接'}`)
console.log('')

console.log(line)
console.log('结论')
console.log(line)
const coreOK = Boolean(gw)
  && (await portOpen(selfIP, UI_PORT))
  && (await portOpen(selfIP, API_PORT))
  && uiLan.status === 200
  && apiLan.status === 200
  && corsOK
  && fw.ui && fw.api
console.log(coreOK ? '  核心项全部通过 - 同网段设备可以正常使用系统' : '  存在异常项，按上面 FAIL 项排查')
console.log(`  员工访问地址: http://${selfIP}:${UI_PORT}`)
if (!corsOK) console.log('  需处理: 把上述地址加入 server/index.mjs 的 corsOrigin 白名单并重启服务端')
if (!fw.ui || !fw.api) console.log('  需处理: 防火墙缺少放行规则，联系管理员补规则')
console.log(line)
