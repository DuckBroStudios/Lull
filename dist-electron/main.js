import { app, globalShortcut, ipcMain, BrowserWindow, screen, nativeImage, Tray, Menu } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
const DEFAULT_SETTINGS = {
  displayName: "",
  theme: "light",
  soundEnabled: true,
  panicHotkey: "",
  notifSound: "chime.wav",
  vibrate: true,
  strongAlert: false,
  background: "default",
  soundPack: "all",
  autoSeasonal: false,
  zenMode: false,
  microAnimations: true,
  appIcon: "default",
  pattern: "none",
  music: false,
  autoAppIcon: false,
  avatarType: "monogram",
  avatarPhoto: "",
  avatarPreset: "terra",
  avatarColor: "#C8553D",
  profileVisible: false,
  timezone: "auto",
  autoTimezone: true,
  unlockedIcons: [],
  dashboardOrder: [],
  codeFont: "mono",
  codeFontSize: 13,
  codeTheme: "match",
  codeTabSize: 2,
  codeWrap: false,
  codeLivePreview: true,
  codeLineNumbers: false
};
function storePath() {
  return path.join(app.getPath("userData"), "lull-data.json");
}
function emptyStore() {
  return { version: 1, session: null, accounts: {} };
}
function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed.accounts) parsed.accounts = {};
    if (typeof parsed.session === "undefined") parsed.session = null;
    return parsed;
  } catch {
    return emptyStore();
  }
}
function writeStore(data) {
  const file = storePath();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}
function key(username) {
  return username.trim().toLowerCase();
}
function hashPassword(password, salt) {
  return scryptSync(password, salt, 64).toString("hex");
}
function verifyPassword(password, salt, hash) {
  const attempt = scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, "hex");
  if (attempt.length !== stored.length) return false;
  return timingSafeEqual(attempt, stored);
}
function publicUser(acc) {
  return {
    username: acc.username,
    createdAt: acc.createdAt,
    reminders: acc.reminders || [],
    tasks: acc.tasks || [],
    settings: { ...DEFAULT_SETTINGS, ...acc.settings || {} }
  };
}
function signup(username, password) {
  const uname = (username || "").trim();
  if (uname.length < 2) return { ok: false, error: "Username must be at least 2 characters." };
  if ((password || "").length < 4) return { ok: false, error: "Password must be at least 4 characters." };
  const store = readStore();
  if (store.accounts[key(uname)]) {
    return { ok: false, error: "That username is already taken." };
  }
  const salt = randomBytes(16).toString("hex");
  const acc = {
    username: uname,
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
    reminders: [],
    tasks: [],
    settings: { ...DEFAULT_SETTINGS, displayName: uname }
  };
  store.accounts[key(uname)] = acc;
  store.session = key(uname);
  writeStore(store);
  return { ok: true, user: publicUser(acc) };
}
function login(username, password) {
  const store = readStore();
  const acc = store.accounts[key(username || "")];
  if (!acc) return { ok: false, error: "No account with that username." };
  if (!verifyPassword(password || "", acc.salt, acc.hash)) {
    return { ok: false, error: "Incorrect password." };
  }
  store.session = key(acc.username);
  writeStore(store);
  return { ok: true, user: publicUser(acc) };
}
function logout() {
  const store = readStore();
  store.session = null;
  writeStore(store);
  return { ok: true };
}
function getSession() {
  const store = readStore();
  if (!store.session) return { ok: true, user: null };
  const acc = store.accounts[store.session];
  if (!acc) return { ok: true, user: null };
  return { ok: true, user: publicUser(acc) };
}
function saveData(username, data) {
  const store = readStore();
  const acc = store.accounts[key(username || "")];
  if (!acc) return { ok: false, error: "Account not found." };
  if (Array.isArray(data.reminders)) acc.reminders = data.reminders;
  if (Array.isArray(data.tasks)) acc.tasks = data.tasks;
  if (data.settings) acc.settings = { ...DEFAULT_SETTINGS, ...acc.settings, ...data.settings };
  writeStore(store);
  return { ok: true };
}
function changePassword(username, current, next) {
  const store = readStore();
  const acc = store.accounts[key(username || "")];
  if (!acc) return { ok: false, error: "Account not found." };
  if (!verifyPassword(current || "", acc.salt, acc.hash)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  if ((next || "").length < 4) return { ok: false, error: "New password must be at least 4 characters." };
  const salt = randomBytes(16).toString("hex");
  acc.salt = salt;
  acc.hash = hashPassword(next, salt);
  writeStore(store);
  return { ok: true };
}
const require$1 = createRequire(import.meta.url);
const running = /* @__PURE__ */ new Map();
let macroMap = /* @__PURE__ */ new Map();
let currentMacros = [];
let panicKey = "";
let mainWin = null;
let statsTimer = null;
function setMainWindow(win2) {
  mainWin = win2;
}
function broadcast() {
  mainWin == null ? void 0 : mainWin.webContents.send("macro-status", Array.from(running.keys()));
}
function reportError(id, message) {
  mainWin == null ? void 0 : mainWin.webContents.send("macro-error", id, message);
}
function ensureStatsTimer() {
  if (statsTimer) return;
  statsTimer = setInterval(() => {
    if (running.size === 0) {
      clearInterval(statsTimer);
      statsTimer = null;
      mainWin == null ? void 0 : mainWin.webContents.send("macro-stats", []);
      return;
    }
    const arr = Array.from(running.entries()).map(([id, st]) => ({ id, count: st.count, startedAt: st.startedAt }));
    mainWin == null ? void 0 : mainWin.webContents.send("macro-stats", arr);
  }, 1e3);
}
function loadNut() {
  try {
    return require$1("@nut-tree-fork/nut-js");
  } catch {
    return null;
  }
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || lo));
function sleep(ms, state) {
  return new Promise((resolve) => {
    const step = 40;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += step;
      if (state.stopped || elapsed >= ms) {
        clearInterval(id);
        resolve();
      }
    }, step);
  });
}
async function runAutoclicker(macro, state) {
  const nut = loadNut();
  if (!nut) throw new Error("Input automation not installed. Run: npm install");
  const { mouse, Button } = nut;
  mouse.config.autoDelayMs = 0;
  mouse.config.mouseSpeed = 1e5;
  const btn = macro.config.button === "right" ? Button.RIGHT : macro.config.button === "middle" ? Button.MIDDLE : Button.LEFT;
  if (macro.config.mode === "hold") {
    const holdMs = clamp(macro.config.holdSeconds, 0.05, 3600) * 1e3;
    const relMs = clamp(macro.config.releaseSeconds, 0.05, 3600) * 1e3;
    state.cleanup = async () => {
      try {
        await mouse.releaseButton(btn);
      } catch {
      }
    };
    while (!state.stopped) {
      await mouse.pressButton(btn);
      await sleep(holdMs, state);
      await mouse.releaseButton(btn);
      state.count++;
      if (state.stopped) break;
      await sleep(relMs, state);
    }
    try {
      await mouse.releaseButton(btn);
    } catch {
    }
  } else {
    const cps = clamp(macro.config.cps, 1, 200);
    const interval = 1e3 / cps;
    while (!state.stopped) {
      await mouse.click(btn);
      state.count++;
      if (interval > 1) await sleep(interval, state);
    }
  }
}
function nutKey(nut, name) {
  const { Key } = nut;
  const n = (name || "Space").trim();
  const map = {
    "space": Key.Space,
    "enter": Key.Enter,
    "return": Key.Enter,
    "tab": Key.Tab,
    "up": Key.Up,
    "down": Key.Down,
    "left": Key.Left,
    "right": Key.Right,
    "shift": Key.LeftShift,
    "ctrl": Key.LeftControl,
    "control": Key.LeftControl,
    "alt": Key.LeftAlt,
    "esc": Key.Escape,
    "escape": Key.Escape,
    "backspace": Key.Backspace,
    "delete": Key.Delete
  };
  const lower = n.toLowerCase();
  if (map[lower]) return map[lower];
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(n)) return Key["F" + n.slice(1)];
  if (/^[a-z]$/i.test(n)) return Key[n.toUpperCase()];
  if (/^[0-9]$/.test(n)) return Key["Num" + n];
  return Key.Space;
}
async function runKeyPresser(macro, state) {
  const nut = loadNut();
  if (!nut) throw new Error("Input automation not installed. Run: npm install");
  const { keyboard } = nut;
  keyboard.config.autoDelayMs = 0;
  const key2 = nutKey(nut, macro.config.key);
  const interval = clamp(macro.config.intervalMs, 5, 36e5);
  while (!state.stopped) {
    await keyboard.pressKey(key2);
    await keyboard.releaseKey(key2);
    state.count++;
    await sleep(interval, state);
  }
}
async function runAutoTyper(macro, state) {
  const nut = loadNut();
  if (!nut) throw new Error("Input automation not installed. Run: npm install");
  const { keyboard, Key } = nut;
  keyboard.config.autoDelayMs = 2;
  const text = String(macro.config.text ?? "");
  const startDelay = clamp(macro.config.startDelayMs ?? 1500, 0, 6e4);
  const intervalMs = clamp(macro.config.intervalMs ?? 1e3, 50, 36e5);
  const repeat = !!macro.config.repeat;
  await sleep(startDelay, state);
  do {
    if (state.stopped) break;
    if (text) await keyboard.type(text);
    if (macro.config.pressEnter) {
      await keyboard.pressKey(Key.Enter);
      await keyboard.releaseKey(Key.Enter);
    }
    state.count++;
    if (!repeat) break;
    await sleep(intervalMs, state);
  } while (!state.stopped && repeat);
}
async function runMouseJiggler(macro, state) {
  const nut = loadNut();
  if (!nut) throw new Error("Input automation not installed. Run: npm install");
  const { mouse, Point } = nut;
  mouse.config.autoDelayMs = 0;
  const intervalMs = clamp(macro.config.intervalSeconds ?? 30, 1, 3600) * 1e3;
  const dist = clamp(macro.config.distance ?? 5, 1, 200);
  while (!state.stopped) {
    try {
      const pos = await mouse.getPosition();
      await mouse.setPosition(new Point(pos.x + dist, pos.y));
      await mouse.setPosition(new Point(pos.x, pos.y));
      state.count++;
    } catch {
    }
    await sleep(intervalMs, state);
  }
}
function runnerFor(type) {
  switch (type) {
    case "autoclicker":
      return runAutoclicker;
    case "keypresser":
      return runKeyPresser;
    case "autotyper":
      return runAutoTyper;
    case "mousejiggler":
      return runMouseJiggler;
    default:
      return null;
  }
}
async function startMacro(macro) {
  if (!(macro == null ? void 0 : macro.id)) return { ok: false, error: "Invalid macro." };
  if (running.has(macro.id)) return { ok: true };
  const runner = runnerFor(macro.type);
  if (!runner) return { ok: false, error: `Unknown macro type: ${macro.type}` };
  const state = { stopped: false, count: 0, startedAt: Date.now() };
  running.set(macro.id, state);
  macroMap.set(macro.id, macro);
  broadcast();
  ensureStatsTimer();
  runner(macro, state).catch((e) => reportError(macro.id, (e == null ? void 0 : e.message) || String(e))).finally(async () => {
    var _a;
    try {
      await ((_a = state.cleanup) == null ? void 0 : _a.call(state));
    } catch {
    }
    running.delete(macro.id);
    broadcast();
  });
  return { ok: true };
}
async function stopMacro(id) {
  var _a;
  const state = running.get(id);
  if (!state) return { ok: true };
  state.stopped = true;
  try {
    await ((_a = state.cleanup) == null ? void 0 : _a.call(state));
  } catch {
  }
  return { ok: true };
}
async function stopAll() {
  const ids = Array.from(running.keys());
  await Promise.all(ids.map(stopMacro));
}
function status() {
  return Array.from(running.keys());
}
function toggleMacro(id) {
  if (running.has(id)) {
    stopMacro(id);
  } else {
    const m = macroMap.get(id);
    if (m) startMacro(m);
  }
}
function applyShortcuts() {
  globalShortcut.unregisterAll();
  for (const m of currentMacros) {
    if (m.keybind) {
      try {
        globalShortcut.register(m.keybind, () => toggleMacro(m.id));
      } catch {
      }
    }
  }
  if (panicKey) {
    try {
      globalShortcut.register(panicKey, () => {
        stopAll();
      });
    } catch {
    }
  }
}
function syncShortcuts(macros) {
  currentMacros = macros;
  macroMap = new Map(macros.map((m) => [m.id, m]));
  applyShortcuts();
}
function setPanicKey(key2) {
  panicKey = key2 || "";
  applyShortcuts();
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
let alertWin = null;
let tray = null;
let isQuitting = false;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win == null ? void 0 : win.hide();
    }
  });
  setMainWindow(win);
}
function createAlertWindow(reminder) {
  if (alertWin) {
    alertWin.close();
    alertWin = null;
  }
  const display = screen.getPrimaryDisplay();
  const { width: screenW } = display.workAreaSize;
  const w = 560;
  const h = 320;
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
    icon: path.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  alertWin.setAlwaysOnTop(true, "screen-saver");
  alertWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const params = new URLSearchParams({
    alert: "1",
    data: encodeURIComponent(JSON.stringify(reminder))
  }).toString();
  if (VITE_DEV_SERVER_URL) {
    alertWin.loadURL(`${VITE_DEV_SERVER_URL}?${params}`);
  } else {
    alertWin.loadFile(path.join(RENDERER_DIST, "index.html"), { search: params });
  }
  alertWin.on("closed", () => {
    alertWin = null;
  });
}
ipcMain.handle(
  "auth:signup",
  (_e, username, password) => signup(username, password)
);
ipcMain.handle(
  "auth:login",
  (_e, username, password) => login(username, password)
);
ipcMain.handle("auth:logout", () => logout());
ipcMain.handle("auth:session", () => getSession());
ipcMain.handle(
  "auth:changePassword",
  (_e, username, current, next) => changePassword(username, current, next)
);
ipcMain.handle(
  "data:save",
  (_e, username, data) => saveData(username, data)
);
ipcMain.handle("macros:run", (_e, macro) => startMacro(macro));
ipcMain.handle("macros:stop", (_e, id) => stopMacro(id));
ipcMain.handle("macros:stopAll", () => stopAll());
ipcMain.handle("macros:status", () => status());
ipcMain.handle("macros:sync", (_e, list) => {
  syncShortcuts(Array.isArray(list) ? list : []);
  return { ok: true };
});
ipcMain.handle("macros:panic", (_e, key2) => {
  setPanicKey(key2 || "");
  return { ok: true };
});
ipcMain.on("show-alert", (_event, reminder) => {
  createAlertWindow(reminder);
});
ipcMain.on("close-alert", () => {
  if (alertWin) {
    alertWin.close();
    alertWin = null;
  }
});
ipcMain.on("alert-action", (_event, action, reminderId) => {
  win == null ? void 0 : win.webContents.send("alert-action", action, reminderId);
  if (alertWin) {
    alertWin.close();
    alertWin = null;
  }
});
function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, "icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Lull");
  const menu = Menu.buildFromTemplate([
    { label: "Show Lull", click: () => {
      win == null ? void 0 : win.show();
      win == null ? void 0 : win.focus();
    } },
    { type: "separator" },
    { label: "Quit", click: () => {
      isQuitting = true;
      app.quit();
    } }
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    if (!win) return;
    win.isVisible() ? win.hide() : (win.show(), win.focus());
  });
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && isQuitting) {
    app.quit();
    win = null;
  }
});
app.on("before-quit", () => {
  isQuitting = true;
  stopAll();
  globalShortcut.unregisterAll();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    win == null ? void 0 : win.show();
  }
});
app.whenReady().then(() => {
  createWindow();
  createTray();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
