const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', { width, height }),
  hideWindow: () => ipcRenderer.send('hide-window')
})
