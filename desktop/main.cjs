const { app, BrowserWindow, Menu, shell } = require('electron')

const APP_URL = 'https://chenmiaochun.github.io/shangpinju-sales-crm/#/login'
const APP_ORIGIN = new URL(APP_URL).origin

function isInternalUrl(value) {
  try { return new URL(value).origin === APP_ORIGIN } catch { return false }
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
    title: '尚品居销售系统',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  window.once('ready-to-show', () => window.show())
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) window.loadURL(url)
    else void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (isInternalUrl(url)) return
    event.preventDefault()
    void shell.openExternal(url)
  })
  void window.loadURL(APP_URL)
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.setAppUserModelId('com.shangpinju.salescrm')
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.focus()
  })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}
