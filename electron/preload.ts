import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('lull', {
  send: (channel: string, ...args: any[]) => {
    const allowed = ['show-alert', 'close-alert', 'alert-action']
    if (allowed.includes(channel)) ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    const allowed = ['alert-action', 'main-process-message']
    if (!allowed.includes(channel)) return
    const wrapped = (_event: any, ...args: any[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
})

// keep existing message hookup
ipcRenderer.on('main-process-message', (_event, ...args) => {
  console.log('[Receive Main-process message]:', ...args)
})