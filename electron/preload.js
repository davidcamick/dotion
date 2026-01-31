const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  hideWindow: () => ipcRenderer.send('hide-window'),
  launchApp: (appName) => ipcRenderer.send('manage-app', { appName, action: 'launch' }),
  manageApp: (appName, action) => ipcRenderer.send('manage-app', { appName, action }),
  getRunningApps: () => ipcRenderer.invoke('get-running-apps')
})
