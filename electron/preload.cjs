const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('tradingStorage', {
  load: () => ipcRenderer.invoke('storage:load'),
  save: (data) => ipcRenderer.invoke('storage:save', data)
})

contextBridge.exposeInMainWorld('windowControls', {
  toggleCompact: () => ipcRenderer.invoke('window:toggle-compact'),
  togglePinned: () => ipcRenderer.invoke('window:toggle-pinned')
})
