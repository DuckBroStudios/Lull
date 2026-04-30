import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, screen } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

let win: BrowserWindow | null
let alertWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault()
      win?.hide()
    }
  })
}

function createAlertWindow(reminder: any) {
  // close any existing alert first
  if (alertWin) {
    alertWin.close()
    alertWin = null
  }

  const display = screen.getPrimaryDisplay()
  const { width: screenW } = display.workAreaSize
  const w = 560
  const h = 320

  alertWin = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round((screenW - w) / 2),
    y: 40,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // float above fullscreen apps (games, video, etc)
  alertWin.setAlwaysOnTop(true, 'screen-saver')
  alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const params = new URLSearchParams({
    alert: '1',
    data: encodeURIComponent(JSON.stringify(reminder)),
  }).toString()

  if (VITE_DEV_SERVER_URL) {
    alertWin.loadURL(`${VITE_DEV_SERVER_URL}?${params}`)
  } else {
    alertWin.loadFile(path.join(RENDERER_DIST, 'index.html'), { search: params })
  }

  alertWin.on('closed', () => {
    alertWin = null
  })
}

// listen for messages from the renderer process
ipcMain.on('show-alert', (_event, reminder) => {
  createAlertWindow(reminder)
})

ipcMain.on('close-alert', () => {
  if (alertWin) {
    alertWin.close()
    alertWin = null
  }
})

ipcMain.on('alert-action', (_event, action: 'dismiss' | 'snooze', reminderId: number) => {
  // forward back to main window so it can update state
  win?.webContents.send('alert-action', action, reminderId)
  if (alertWin) {
    alertWin.close()
    alertWin = null
  }
})

function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  const icon = nativeImage.createFromPath(iconPath)

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('Lull')

  const menu = Menu.buildFromTemplate([
    { label: 'Show Lull', click: () => { win?.show(); win?.focus() } },
    { type: 'separator' },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } },
  ])

  tray.setContextMenu(menu)
  tray.on('click', () => {
    if (!win) return
    win.isVisible() ? win.hide() : (win.show(), win.focus())
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
    win = null
  }
})

app.on('before-quit', () => { isQuitting = true })

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  } else {
    win?.show()
  }
})

app.whenReady().then(() => {
  createWindow()
  createTray()
})