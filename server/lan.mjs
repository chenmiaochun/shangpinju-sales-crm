import { networkInterfaces } from 'node:os'

/**
 * 本机局域网 IPv4 对应的前端访问地址（origin）。
 *
 * 用途：店里的员工/客户用「本机内网 IP:前端端口」访问系统时，服务端 CORS 白名单
 * 必须包含这个 origin，否则登录会被 403（ORIGIN_FORBIDDEN）。
 * 路由器的 DHCP 可能让本机 IP 变化，所以这里动态读取网卡，而不是把 IP 写死。
 *
 * 只放行「本机网卡上的非回环 IPv4 + 指定端口」，不会放行外部/公网地址。
 */

const CACHE_TTL_MS = 5_000
const DEFAULT_PORTS = [5173, 5174, 4173]
let cache = { at: 0, origins: [] }

export function localLanAddresses() {
  const addresses = new Set()
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      // family 在 Windows 上是 'IPv4'，在部分 Linux 上是 4，两者都兼容
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) addresses.add(net.address)
    }
  }
  return [...addresses]
}

export function lanOrigins(ports = DEFAULT_PORTS) {
  const now = Date.now()
  if (now - cache.at < CACHE_TTL_MS && cache.ports === ports.join(',')) return cache.origins
  const origins = []
  for (const address of localLanAddresses()) {
    for (const port of ports) origins.push(`http://${address}:${port}`)
  }
  cache = { at: now, ports: ports.join(','), origins }
  return origins
}
