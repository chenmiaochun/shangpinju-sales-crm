const { contextBridge, ipcRenderer } = require('electron')

// 只向「本地离线页」暴露必要的服务器地址能力。
// 主窗口加载的是服务器上的页面，ipcMain 侧会二次校验调用来源，远程页面调不通。
contextBridge.exposeInMainWorld('spj', {
  getServerUrl: () => ipcRenderer.invoke('spj:get-server-url'),
  setServerUrl: (url) => ipcRenderer.invoke('spj:set-server-url', url),
  testServer: (url) => ipcRenderer.invoke('spj:test-server', url),
  getVersion: () => ipcRenderer.invoke('spj:get-version'),
})
