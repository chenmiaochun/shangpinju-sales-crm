# 网络开通 · ① 局域网 IP 自动放行（验收报告）

- 时间：2026-08-29 09:35–09:41
- 窗口：本窗口（销售系统3（网络）续聊）
- 改动文件：`server/lan.mjs`（新增）、`server/app.mjs`、`server/index.mjs`
- 状态：**已改完 + 已验证 + 服务端已重启生效**

---

## 一、为什么要改

上一轮为了让手机能登录，把本机内网 IP `192.168.110.127:5173` **写死**进了服务端 CORS 白名单
（commit `125abe4`）。问题：路由器的 DHCP 一旦换 IP（重启路由器、换 WiFi、续租到期），

1. 员工访问地址变了（要重新发地址）；
2. 更麻烦的是**服务端白名单还是旧 IP，会直接 403 登不上**。

## 二、改了什么

### 新增 `server/lan.mjs`

- `localLanAddresses()`：实时读 `os.networkInterfaces()`，取所有**非回环 IPv4**。
- `lanOrigins(ports)`：拼成 `http://<本机内网IP>:<端口>`，端口默认 `[5173, 5174, 4173]`
  （5173 生产前端 / 5174 将来的测试环境 / 4173 vite preview）。
- 结果**缓存 5 秒**，不逐请求读网卡。

### `server/app.mjs`

CORS 白名单计算处（原第 112 行）改为：

```js
const configuredOrigins = corsOrigin === '*' ? [] : String(corsOrigin).split(',').map(v => v.trim()).filter(Boolean)
const allowedOrigins = corsOrigin === '*' ? [] : [...new Set([...configuredOrigins, ...lanOrigins()])]
```

即：**显式配置 + 本机当前所有局域网 IP**。`corsOrigin === '*'` 的行为完全不变。

### `server/index.mjs`

默认白名单收回到只保留固定地址，注释说明局域网 IP 由 `lan.mjs` 动态放行：

```js
corsOrigin: process.env.SALES_CORS_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173',
```

---

## 三、验证结果

服务端测试（`node --test server/server.test.mjs`）：**20 / 20 通过**

CORS 行为实测（`scripts` 外的临时脚本 `verify-lan.cjs` 打的）：

| 来源 Origin | 期望 | 实测 | 结论 |
|---|---|---|---|
| `http://192.168.110.127:5173` | 放行 | `200`，ACAO 回显该 origin | ✅ |
| `http://localhost:5173` | 放行 | `200` | ✅ |
| `http://127.0.0.1:5173` | 放行 | `200` | ✅ |
| 局域网 IP + 登录（故意错密码） | 401 而非 403 | `401 AUTH_REQUIRED` | ✅ CORS 已通过，只剩密码校验 |
| `http://10.0.0.99:5173`（伪造内网 IP） | 拒绝 | `403 ORIGIN_FORBIDDEN` | ✅ |
| `http://evil.example.com:5173`（公网域名） | 拒绝 | `403 ORIGIN_FORBIDDEN` | ✅ |
| `http://192.168.110.127:9999`（同 IP 错端口） | 拒绝 | `403 ORIGIN_FORBIDDEN` | ✅ |

端到端：

- `http://192.168.110.127:5173/` → `200`
- `http://192.168.110.127:3001/api/health`（带 LAN Origin）→ `200 {"ok":true}`

**结论：换 IP 后无需改任何配置、无需重启服务端（5 秒内自动生效）；同时对非本机 IP 仍然严格拒绝。**

---

## 四、对既有功能的影响

- 只放宽了「本机网卡上的内网 IP + 前端端口」这一类 origin，仍需正常登录，权限体系未动。
- 数据库、前端、其它业务代码零改动；老数据未触碰。
- `server/index.mjs` 里那个写死的 `192.168.110.127` 已移除（被动态逻辑取代）。

## 五、未完成 / 待确认

- **本改动未提交 git**（当前工作区还有另一个窗口正在改同一批文件，见正文提示，等老板定夺后再 commit）。
- 建议路由器仍做一次 IP-MAC 绑定：自动放行解决的是「服务端不报错」，固定 IP 解决的是「员工收藏的地址不失效」，两者不冲突、都做最稳。

## 六、下一件事（按上一轮排的优先级）

- ② 双环境改造（生产 5173 不动 + 测试 5174）——**建议全员推广前做**，等老板拍板
- ③ 建员工账号（最小权限）
- ④ 异地员工：ZeroTier 节点 `360c2e39a0` 待在 my.zerotier.com 建网授权（店里 WiFi 场景用不上，可缓）
