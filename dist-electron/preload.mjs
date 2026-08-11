"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("lull", {
  send: (channel, ...args) => {
    const allowed = ["show-alert", "close-alert", "alert-action"];
    if (allowed.includes(channel)) electron.ipcRenderer.send(channel, ...args);
  },
  on: (channel, listener) => {
    const allowed = ["alert-action", "main-process-message", "macro-status", "macro-error", "macro-stats"];
    if (!allowed.includes(channel)) return;
    const wrapped = (_event, ...args) => listener(...args);
    electron.ipcRenderer.on(channel, wrapped);
    return () => electron.ipcRenderer.removeListener(channel, wrapped);
  },
  // account + data operations (async request/response)
  invoke: (channel, ...args) => {
    const allowed = [
      "auth:signup",
      "auth:login",
      "auth:logout",
      "auth:session",
      "auth:changePassword",
      "data:save",
      "macros:run",
      "macros:stop",
      "macros:stopAll",
      "macros:status",
      "macros:sync",
      "macros:panic"
    ];
    if (!allowed.includes(channel)) return Promise.reject(new Error("channel not allowed"));
    return electron.ipcRenderer.invoke(channel, ...args);
  }
});
electron.ipcRenderer.on("main-process-message", (_event, ...args) => {
  console.log("[Receive Main-process message]:", ...args);
});
