import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('lull', {
  send: (channel: string, ...args: any[]) => {
    const allowed = ['show-alert', 'close-alert', 'alert-action']
    if (allowed.includes(channel)) ipcRenderer.send(channel, ...args)
  },
  on: (channel: string, listener: (...args: any[]) => void) => {
    const allowed = ['alert-action', 'main-process-message', 'macro-status', 'macro-error', 'macro-stats']
    if (!allowed.includes(channel)) return
    const wrapped = (_event: any, ...args: any[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
  // account + data operations (async request/response)
  invoke: (channel: string, ...args: any[]) => {
    const allowed = [
      'auth:signup',
      'auth:login',
      'auth:logout',
      'auth:session',
      'auth:changePassword',
      'data:save',
      'macros:run',
      'macros:stop',
      'macros:stopAll',
      'macros:status',
      'macros:sync',
      'macros:panic',
    ]
    if (!allowed.includes(channel)) return Promise.reject(new Error('channel not allowed'))
    return ipcRenderer.invoke(channel, ...args)
  },
})

// keep existing message hookup
ipcRenderer.on('main-process-message', (_event, ...args) => {
  console.log('[Receive Main-process message]:', ...args)
})