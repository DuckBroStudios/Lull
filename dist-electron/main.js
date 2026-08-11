import { app as m, globalShortcut as A, ipcMain as c, BrowserWindow as M, screen as H, nativeImage as x, Tray as Q, Menu as W } from "electron";
import { fileURLToPath as X } from "node:url";
import l from "node:path";
import { randomBytes as N, scryptSync as V, timingSafeEqual as Y } from "node:crypto";
import T from "node:fs";
import { createRequire as Z } from "node:module";
const _ = {
  displayName: "",
  theme: "light",
  soundEnabled: !0,
  panicHotkey: "",
  notifSound: "chime.wav",
  vibrate: !0,
  strongAlert: !1,
  background: "default",
  soundPack: "all",
  autoSeasonal: !1,
  zenMode: !1,
  microAnimations: !0,
  appIcon: "default",
  pattern: "none",
  music: !1,
  autoAppIcon: !1,
  avatarType: "monogram",
  avatarPhoto: "",
  avatarPreset: "terra",
  avatarColor: "#C8553D",
  profileVisible: !1,
  timezone: "auto",
  autoTimezone: !0,
  unlockedIcons: [],
  dashboardOrder: []
};
function F() {
  return l.join(m.getPath("userData"), "lull-data.json");
}
function ee() {
  return { version: 1, session: null, accounts: {} };
}
function g() {
  try {
    const e = T.readFileSync(F(), "utf-8"), t = JSON.parse(e);
    return t.accounts || (t.accounts = {}), typeof t.session > "u" && (t.session = null), t;
  } catch {
    return ee();
  }
}
function b(e) {
  const t = F(), n = `${t}.tmp`;
  T.writeFileSync(n, JSON.stringify(e, null, 2), "utf-8"), T.renameSync(n, t);
}
function h(e) {
  return e.trim().toLowerCase();
}
function K(e, t) {
  return V(e, t, 64).toString("hex");
}
function $(e, t, n) {
  const r = V(e, t, 64), o = Buffer.from(n, "hex");
  return r.length !== o.length ? !1 : Y(r, o);
}
function R(e) {
  return {
    username: e.username,
    createdAt: e.createdAt,
    reminders: e.reminders || [],
    tasks: e.tasks || [],
    settings: { ..._, ...e.settings || {} }
  };
}
function te(e, t) {
  const n = (e || "").trim();
  if (n.length < 2) return { ok: !1, error: "Username must be at least 2 characters." };
  if ((t || "").length < 4) return { ok: !1, error: "Password must be at least 4 characters." };
  const r = g();
  if (r.accounts[h(n)])
    return { ok: !1, error: "That username is already taken." };
  const o = N(16).toString("hex"), a = {
    username: n,
    salt: o,
    hash: K(t, o),
    createdAt: Date.now(),
    reminders: [],
    tasks: [],
    settings: { ..._, displayName: n }
  };
  return r.accounts[h(n)] = a, r.session = h(n), b(r), { ok: !0, user: R(a) };
}
function ne(e, t) {
  const n = g(), r = n.accounts[h(e || "")];
  return r ? $(t || "", r.salt, r.hash) ? (n.session = h(r.username), b(n), { ok: !0, user: R(r) }) : { ok: !1, error: "Incorrect password." } : { ok: !1, error: "No account with that username." };
}
function re() {
  const e = g();
  return e.session = null, b(e), { ok: !0 };
}
function oe() {
  const e = g();
  if (!e.session) return { ok: !0, user: null };
  const t = e.accounts[e.session];
  return t ? { ok: !0, user: R(t) } : { ok: !0, user: null };
}
function se(e, t) {
  const n = g(), r = n.accounts[h(e || "")];
  return r ? (Array.isArray(t.reminders) && (r.reminders = t.reminders), Array.isArray(t.tasks) && (r.tasks = t.tasks), t.settings && (r.settings = { ..._, ...r.settings, ...t.settings }), b(n), { ok: !0 }) : { ok: !1, error: "Account not found." };
}
function ae(e, t, n) {
  const r = g(), o = r.accounts[h(e || "")];
  if (!o) return { ok: !1, error: "Account not found." };
  if (!$(t || "", o.salt, o.hash))
    return { ok: !1, error: "Current password is incorrect." };
  if ((n || "").length < 4) return { ok: !1, error: "New password must be at least 4 characters." };
  const a = N(16).toString("hex");
  return o.salt = a, o.hash = K(n, a), b(r), { ok: !0 };
}
const ie = Z(import.meta.url), p = /* @__PURE__ */ new Map();
let D = /* @__PURE__ */ new Map(), z = [], I = "", u = null, S = null;
function ce(e) {
  u = e;
}
function B() {
  u == null || u.webContents.send("macro-status", Array.from(p.keys()));
}
function ue(e, t) {
  u == null || u.webContents.send("macro-error", e, t);
}
function le() {
  S || (S = setInterval(() => {
    if (p.size === 0) {
      clearInterval(S), S = null, u == null || u.webContents.send("macro-stats", []);
      return;
    }
    const e = Array.from(p.entries()).map(([t, n]) => ({ id: t, count: n.count, startedAt: n.startedAt }));
    u == null || u.webContents.send("macro-stats", e);
  }, 1e3));
}
function P() {
  try {
    return ie("@nut-tree-fork/nut-js");
  } catch {
    return null;
  }
}
const d = (e, t, n) => Math.max(t, Math.min(n, Number(e) || t));
function y(e, t) {
  return new Promise((n) => {
    let o = 0;
    const a = setInterval(() => {
      o += 40, (t.stopped || o >= e) && (clearInterval(a), n());
    }, 40);
  });
}
async function fe(e, t) {
  const n = P();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { mouse: r, Button: o } = n;
  r.config.autoDelayMs = 0, r.config.mouseSpeed = 1e5;
  const a = e.config.button === "right" ? o.RIGHT : e.config.button === "middle" ? o.MIDDLE : o.LEFT;
  if (e.config.mode === "hold") {
    const w = d(e.config.holdSeconds, 0.05, 3600) * 1e3, f = d(e.config.releaseSeconds, 0.05, 3600) * 1e3;
    for (t.cleanup = async () => {
      try {
        await r.releaseButton(a);
      } catch {
      }
    }; !t.stopped && (await r.pressButton(a), await y(w, t), await r.releaseButton(a), t.count++, !t.stopped); )
      await y(f, t);
    try {
      await r.releaseButton(a);
    } catch {
    }
  } else {
    const f = 1e3 / d(e.config.cps, 1, 200);
    for (; !t.stopped; )
      await r.click(a), t.count++, f > 1 && await y(f, t);
  }
}
function pe(e, t) {
  const { Key: n } = e, r = (t || "Space").trim(), o = {
    space: n.Space,
    enter: n.Enter,
    return: n.Enter,
    tab: n.Tab,
    up: n.Up,
    down: n.Down,
    left: n.Left,
    right: n.Right,
    shift: n.LeftShift,
    ctrl: n.LeftControl,
    control: n.LeftControl,
    alt: n.LeftAlt,
    esc: n.Escape,
    escape: n.Escape,
    backspace: n.Backspace,
    delete: n.Delete
  }, a = r.toLowerCase();
  return o[a] ? o[a] : /^f([1-9]|1[0-9]|2[0-4])$/i.test(r) ? n["F" + r.slice(1)] : /^[a-z]$/i.test(r) ? n[r.toUpperCase()] : /^[0-9]$/.test(r) ? n["Num" + r] : n.Space;
}
async function de(e, t) {
  const n = P();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { keyboard: r } = n;
  r.config.autoDelayMs = 0;
  const o = pe(n, e.config.key), a = d(e.config.intervalMs, 5, 36e5);
  for (; !t.stopped; )
    await r.pressKey(o), await r.releaseKey(o), t.count++, await y(a, t);
}
async function he(e, t) {
  const n = P();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { keyboard: r, Key: o } = n;
  r.config.autoDelayMs = 2;
  const a = String(e.config.text ?? ""), w = d(e.config.startDelayMs ?? 1500, 0, 6e4), f = d(e.config.intervalMs ?? 1e3, 50, 36e5), O = !!e.config.repeat;
  await y(w, t);
  do {
    if (t.stopped || (a && await r.type(a), e.config.pressEnter && (await r.pressKey(o.Enter), await r.releaseKey(o.Enter)), t.count++, !O)) break;
    await y(f, t);
  } while (!t.stopped && O);
}
async function ye(e, t) {
  const n = P();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { mouse: r, Point: o } = n;
  r.config.autoDelayMs = 0;
  const a = d(e.config.intervalSeconds ?? 30, 1, 3600) * 1e3, w = d(e.config.distance ?? 5, 1, 200);
  for (; !t.stopped; ) {
    try {
      const f = await r.getPosition();
      await r.setPosition(new o(f.x + w, f.y)), await r.setPosition(new o(f.x, f.y)), t.count++;
    } catch {
    }
    await y(a, t);
  }
}
function me(e) {
  switch (e) {
    case "autoclicker":
      return fe;
    case "keypresser":
      return de;
    case "autotyper":
      return he;
    case "mousejiggler":
      return ye;
    default:
      return null;
  }
}
async function q(e) {
  if (!(e != null && e.id)) return { ok: !1, error: "Invalid macro." };
  if (p.has(e.id)) return { ok: !0 };
  const t = me(e.type);
  if (!t) return { ok: !1, error: `Unknown macro type: ${e.type}` };
  const n = { stopped: !1, count: 0, startedAt: Date.now() };
  return p.set(e.id, n), D.set(e.id, e), B(), le(), t(e, n).catch((r) => ue(e.id, (r == null ? void 0 : r.message) || String(r))).finally(async () => {
    var r;
    try {
      await ((r = n.cleanup) == null ? void 0 : r.call(n));
    } catch {
    }
    p.delete(e.id), B();
  }), { ok: !0 };
}
async function L(e) {
  var n;
  const t = p.get(e);
  if (!t) return { ok: !0 };
  t.stopped = !0;
  try {
    await ((n = t.cleanup) == null ? void 0 : n.call(t));
  } catch {
  }
  return { ok: !0 };
}
async function C() {
  const e = Array.from(p.keys());
  await Promise.all(e.map(L));
}
function we() {
  return Array.from(p.keys());
}
function ge(e) {
  if (p.has(e))
    L(e);
  else {
    const t = D.get(e);
    t && q(t);
  }
}
function J() {
  A.unregisterAll();
  for (const e of z)
    if (e.keybind)
      try {
        A.register(e.keybind, () => ge(e.id));
      } catch {
      }
  if (I)
    try {
      A.register(I, () => {
        C();
      });
    } catch {
    }
}
function ke(e) {
  z = e, D = new Map(e.map((t) => [t.id, t])), J();
}
function be(e) {
  I = e || "", J();
}
const j = l.dirname(X(import.meta.url));
process.env.APP_ROOT = l.join(j, "..");
const k = process.env.VITE_DEV_SERVER_URL, _e = l.join(process.env.APP_ROOT, "dist-electron"), U = l.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = k ? l.join(process.env.APP_ROOT, "public") : U;
let s, i = null, v = null, E = !1;
function G() {
  s = new M({
    icon: l.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: l.join(j, "preload.mjs")
    }
  }), s.webContents.on("did-finish-load", () => {
    s == null || s.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), k ? s.loadURL(k) : s.loadFile(l.join(U, "index.html")), s.on("close", (e) => {
    E || (e.preventDefault(), s == null || s.hide());
  }), ce(s);
}
function Se(e) {
  i && (i.close(), i = null);
  const t = H.getPrimaryDisplay(), { width: n } = t.workAreaSize, r = 560, o = 320;
  i = new M({
    width: r,
    height: o,
    x: Math.round((n - r) / 2),
    y: 40,
    frame: !1,
    transparent: !0,
    resizable: !1,
    movable: !0,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    focusable: !0,
    icon: l.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: l.join(j, "preload.mjs")
    }
  }), i.setAlwaysOnTop(!0, "screen-saver"), i.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 });
  const a = new URLSearchParams({
    alert: "1",
    data: encodeURIComponent(JSON.stringify(e))
  }).toString();
  k ? i.loadURL(`${k}?${a}`) : i.loadFile(l.join(U, "index.html"), { search: a }), i.on("closed", () => {
    i = null;
  });
}
c.handle(
  "auth:signup",
  (e, t, n) => te(t, n)
);
c.handle(
  "auth:login",
  (e, t, n) => ne(t, n)
);
c.handle("auth:logout", () => re());
c.handle("auth:session", () => oe());
c.handle(
  "auth:changePassword",
  (e, t, n, r) => ae(t, n, r)
);
c.handle(
  "data:save",
  (e, t, n) => se(t, n)
);
c.handle("macros:run", (e, t) => q(t));
c.handle("macros:stop", (e, t) => L(t));
c.handle("macros:stopAll", () => C());
c.handle("macros:status", () => we());
c.handle("macros:sync", (e, t) => (ke(Array.isArray(t) ? t : []), { ok: !0 }));
c.handle("macros:panic", (e, t) => (be(t || ""), { ok: !0 }));
c.on("show-alert", (e, t) => {
  Se(t);
});
c.on("close-alert", () => {
  i && (i.close(), i = null);
});
c.on("alert-action", (e, t, n) => {
  s == null || s.webContents.send("alert-action", t, n), i && (i.close(), i = null);
});
function ve() {
  const e = l.join(process.env.VITE_PUBLIC, "icon.png"), t = x.createFromPath(e);
  v = new Q(t.isEmpty() ? x.createEmpty() : t), v.setToolTip("Lull");
  const n = W.buildFromTemplate([
    { label: "Show Lull", click: () => {
      s == null || s.show(), s == null || s.focus();
    } },
    { type: "separator" },
    { label: "Quit", click: () => {
      E = !0, m.quit();
    } }
  ]);
  v.setContextMenu(n), v.on("click", () => {
    s && (s.isVisible() ? s.hide() : (s.show(), s.focus()));
  });
}
m.on("window-all-closed", () => {
  process.platform !== "darwin" && E && (m.quit(), s = null);
});
m.on("before-quit", () => {
  E = !0, C(), A.unregisterAll();
});
m.on("activate", () => {
  M.getAllWindows().length === 0 ? G() : s == null || s.show();
});
m.whenReady().then(() => {
  G(), ve();
});
export {
  _e as MAIN_DIST,
  U as RENDERER_DIST,
  k as VITE_DEV_SERVER_URL
};
