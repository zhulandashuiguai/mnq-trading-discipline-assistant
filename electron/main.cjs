const { app, BrowserWindow, ipcMain, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const defaults = {
  strategies: [{
    id: 'mnq-qqq-example',
    name: 'MNQ / QQQ 盘中入场示例',
    entryRules: ['确认当前处于计划交易时段', 'QQQ 日内方向明确', 'QQQ 位于计划关键位置', 'MNQ 出现执行触发', '止损位置已确定', '仓位符合交易计划', '重大数据风险已确认'],
    exitRules: ['触及预设止损', '达到计划目标', 'QQQ 或 MNQ 结构失效', '达到计划时间退出'],
    enabled: true
  }],
  settings: {
    displayTimezone: 'Asia/Shanghai',
    sessions: [{ start: '09:30', end: '11:30' }, { start: '13:30', end: '15:30' }],
    maxTrades: 3,
    maxLoss: 300,
    maxConsecutiveLosses: 2
  },
  trades: [],
  dailyNotes: {}
}
let mainWindow
let compactMode = false
let pinned = false
let regularBounds
let wasMaximized = false

function getDataPath() {
  return path.join(app.getPath('userData'), 'trading-data.json')
}

function getData() {
  const dataPath = getDataPath()
  if (!fs.existsSync(dataPath)) return structuredClone(defaults)
  try {
    const saved = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
    return { ...structuredClone(defaults), ...saved, settings: { ...structuredClone(defaults.settings), ...saved.settings } }
  } catch {
    return structuredClone(defaults)
  }
}

function saveData(data) {
  fs.writeFileSync(getDataPath(), JSON.stringify(data, null, 2), 'utf8')
  return true
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#f5f7f8',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  })
  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) mainWindow.loadURL(devUrl)
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

function toggleCompactMode() {
  if (!mainWindow) return false

  if (!compactMode) {
    wasMaximized = mainWindow.isMaximized()
    if (wasMaximized) mainWindow.unmaximize()
    regularBounds = mainWindow.getBounds()
    const workArea = screen.getDisplayMatching(regularBounds).workArea
    mainWindow.setMinimumSize(320, 440)
    mainWindow.setMaximumSize(560, 900)
    mainWindow.setBounds({ x: workArea.x, y: workArea.y, width: 360, height: Math.min(560, workArea.height) })
    mainWindow.setAlwaysOnTop(false)
    mainWindow.setResizable(true)
    mainWindow.setMovable(true)
    compactMode = true
  } else {
    mainWindow.setMovable(true)
    mainWindow.setResizable(true)
    mainWindow.setMaximumSize(0, 0)
    mainWindow.setMinimumSize(1040, 680)
    mainWindow.setAlwaysOnTop(false)
    if (regularBounds) mainWindow.setBounds(regularBounds)
    if (wasMaximized) mainWindow.maximize()
    compactMode = false
    pinned = false
  }

  return compactMode
}

function togglePinned() {
  if (!mainWindow || !compactMode) return false
  pinned = !pinned
  mainWindow.setAlwaysOnTop(pinned, 'floating')
  return pinned
}

app.whenReady().then(() => {
  ipcMain.handle('storage:load', () => getData())
  ipcMain.handle('storage:save', (_, data) => saveData(data))
  ipcMain.handle('window:toggle-compact', () => toggleCompactMode())
  ipcMain.handle('window:toggle-pinned', () => togglePinned())
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
