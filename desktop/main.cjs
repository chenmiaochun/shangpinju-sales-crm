const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

// 店里服务器的默认地址（本机静态 IP + 前端端口）。
// 若路由器换了 IP，员工在离线页里改一次即可，配置保存在本机，不需要重新打包。
const DEFAULT_SERVER = 'http://192.168.1.161:5173'
const OFFLINE_PAGE = path.join(__dirname, 'offline.html')

let configFile = ''
let serverUrl = DEFAULT_SERVER

function normalize(input) {
  let value = String(input || '').trim()
  if (!value) return ''
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`
  return value.replace(/\/+$/, '')
}

function readConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'))
    const value = normalize(parsed && parsed.serverUrl)
    if (value) return value
  } catch {
    /* 首次启动没有配置文件，用默认值 */
  }
  return DEFAULT_SERVER
}

function writeConfig(url) {
  try {
    fs.mkdirSync(path.dirname(configFile), { recursive: true })
    fs.writeFileSync(configFile, JSON.stringify({ serverUrl: url, updatedAt: new Date().toISOString() }, null, 2))
  } catch {
    /* 写不进去也不影响本次连接 */
  }
}

/** 只允许本地离线页调用地址相关的 ipc，远程页面调不通 */
function isLocalPage(event) {
  const url = (event && event.senderFrame && event.senderFrame.url) || ''
  return url.startsWith('file://')
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    show: false,
    backgroundColor: '#f4f6f4',
    autoHideMenuBar: true,
    title: '尚品居经营系统',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  const isInternalUrl = (value) => {
    try {
      return new URL(value).origin === new URL(serverUrl).origin
    } catch {
      return false
    }
  }

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) void window.loadURL(url)
    else void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url) || url.startsWith('file://')) return
    event.preventDefault()
    void shell.openExternal(url)
  })
  // 连不上服务器时，切成离线页（可改服务器地址）
  window.webContents.on('did-fail-load', (_event, errorCode, _description, validatedURL, isMainFrame) => {
    if (!isMainFrame) return
    if (String(validatedURL).startsWith('file://')) return
    if (errorCode === -3 || errorCode === 0) return // 用户中断 / 正常跳转
    void window.loadFile(OFFLINE_PAGE)
  })

  void window.loadURL(serverUrl)
  return window
}

ipcMain.handle('spj:get-server-url', (event) => (isLocalPage(event) ? serverUrl : ''))
ipcMain.handle('spj:get-version', () => app.getVersion())
ipcMain.handle('spj:set-server-url', (event, input) => {
  if (!isLocalPage(event)) throw new Error('forbidden')
  const next = normalize(input)
  if (!next) throw new Error('地址不能为空')
  serverUrl = next
  writeConfig(next)
  const window = BrowserWindow.getAllWindows()[0]
  if (window) void window.loadURL(next)
  return next
})
ipcMain.handle('spj:test-server', (event, input) => {
  if (!isLocalPage(event)) throw new Error('forbidden')
  const target = normalize(input)
  if (!target) throw new Error('地址不能为空')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  return fetch(`${target}/api/health`, { signal: controller.signal })
    .then((response) => (response.ok ? response.json() : { ok: false, status: response.status }))
    .catch((error) => ({ ok: false, error: String(error && error.message ? error.message : error) }))
    .finally(() => clearTimeout(timer))
})

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.setAppUserModelId('com.shangpinju.salescrm')
  app.whenReady().then(() => {
    configFile = path.join(app.getPath('userData'), 'server.json')
    serverUrl = readConfig()
    Menu.setApplicationMenu(null)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
