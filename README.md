# 销售软件

## Windows 桌面安装包

桌面版加载已发布的外网系统，网页更新后员工无需重新安装。构建命令：

```powershell
pnpm desktop:dist
```

安装包输出到 `artifacts/desktop`。桌面版需要联网；当前静态演示模式的数据仍保存在每台电脑的浏览器环境中，多人共享数据需要部署服务端数据库。

## SQLite 数据服务

要求 Node.js 24（使用内置 `node:http` 和 `node:sqlite`，无额外依赖）。

```powershell
$env:SALES_DATA_DIR = 'D:\sales-data' # 可选，默认 server/data
$env:PORT = '3001'                     # 可选
node server/index.mjs
```

可选配置：`SALES_MAX_BODY_BYTES`（默认 20971520）和 `SALES_CORS_ORIGIN`（默认 `*`）。服务收到 `SIGINT` 或 `SIGTERM` 时会停止接受连接并关闭数据库。

前端交付清单的外部系统入口通过 `VITE_INVENTORY_SYSTEM_URL` 和 `VITE_AFTERSALES_SYSTEM_URL` 配置。系统会在跳转时自动附加 `orderId` 和 `customerId`；未配置时按钮保持禁用，避免跳转到错误系统。

### API

所有写请求须使用 `Content-Type: application/json`，错误格式为 `{ "error": { "code", "message" } }`。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET / PUT | `/api/state` | 读取或替换应用状态对象 |
| GET | `/api/audit?limit=50&offset=0` | 分页读取写操作审计（limit 最大 200） |
| GET | `/api/backup` | 下载版本 1 JSON 备份 |
| POST | `/api/restore` | 校验并恢复版本 1 JSON 备份 |
| GET / PUT | `/api/members` | 读取或替换成员；PUT 接受数组或 `{ "members": [] }`，每项须有唯一非空字符串 `id` |
| GET / PUT | `/api/integrations` | 读取或替换集成设置对象；PUT 可使用 `{ "integrations": {...} }` |

运行服务测试：

```powershell
node --test server/*.test.mjs
```
