import { app as m, globalShortcut as T, ipcMain as l, BrowserWindow as L, screen as re, nativeImage as K, Tray as se, Menu as ae } from "electron";
import { createRequire as J } from "node:module";
import { fileURLToPath as ie } from "node:url";
import f from "node:path";
import { randomBytes as G, scryptSync as Q, timingSafeEqual as ce } from "node:crypto";
import x from "node:fs";
const C = {
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
  autoAppIcon: !1
};
function H() {
  return f.join(m.getPath("userData"), "lull-data.json");
}
function le() {
  return { version: 1, session: null, accounts: {} };
}
function S() {
  try {
    const e = x.readFileSync(H(), "utf-8"), t = JSON.parse(e);
    return t.accounts || (t.accounts = {}), typeof t.session > "u" && (t.session = null), t;
  } catch {
    return le();
  }
}
function A(e) {
  const t = H(), n = `${t}.tmp`;
  x.writeFileSync(n, JSON.stringify(e, null, 2), "utf-8"), x.renameSync(n, t);
}
function k(e) {
  return e.trim().toLowerCase();
}
function W(e, t) {
  return Q(e, t, 64).toString("hex");
}
function X(e, t, n) {
  const o = Q(e, t, 64), r = Buffer.from(n, "hex");
  return o.length !== r.length ? !1 : ce(o, r);
}
function U(e) {
  return {
    username: e.username,
    createdAt: e.createdAt,
    reminders: e.reminders || [],
    tasks: e.tasks || [],
    settings: { ...C, ...e.settings || {} }
  };
}
function ue(e, t) {
  const n = (e || "").trim();
  if (n.length < 2) return { ok: !1, error: "Username must be at least 2 characters." };
  if ((t || "").length < 4) return { ok: !1, error: "Password must be at least 4 characters." };
  const o = S();
  if (o.accounts[k(n)])
    return { ok: !1, error: "That username is already taken." };
  const r = G(16).toString("hex"), s = {
    username: n,
    salt: r,
    hash: W(t, r),
    createdAt: Date.now(),
    reminders: [],
    tasks: [],
    settings: { ...C, displayName: n }
  };
  return o.accounts[k(n)] = s, o.session = k(n), A(o), { ok: !0, user: U(s) };
}
function fe(e, t) {
  const n = S(), o = n.accounts[k(e || "")];
  return o ? X(t || "", o.salt, o.hash) ? (n.session = k(o.username), A(n), { ok: !0, user: U(o) }) : { ok: !1, error: "Incorrect password." } : { ok: !1, error: "No account with that username." };
}
function pe() {
  const e = S();
  return e.session = null, A(e), { ok: !0 };
}
function de() {
  const e = S();
  if (!e.session) return { ok: !0, user: null };
  const t = e.accounts[e.session];
  return t ? { ok: !0, user: U(t) } : { ok: !0, user: null };
}
function he(e, t) {
  const n = S(), o = n.accounts[k(e || "")];
  return o ? (Array.isArray(t.reminders) && (o.reminders = t.reminders), Array.isArray(t.tasks) && (o.tasks = t.tasks), t.settings && (o.settings = { ...C, ...o.settings, ...t.settings }), A(n), { ok: !0 }) : { ok: !1, error: "Account not found." };
}
function we(e, t, n) {
  const o = S(), r = o.accounts[k(e || "")];
  if (!r) return { ok: !1, error: "Account not found." };
  if (!X(t || "", r.salt, r.hash))
    return { ok: !1, error: "Current password is incorrect." };
  if ((n || "").length < 4) return { ok: !1, error: "New password must be at least 4 characters." };
  const s = G(16).toString("hex");
  return r.salt = s, r.hash = W(n, s), A(o), { ok: !0 };
}
const Y = J(import.meta.url), d = /* @__PURE__ */ new Map();
let j = /* @__PURE__ */ new Map(), Z = [], D = "", p = null, M = null;
function ge(e) {
  p = e;
}
function z() {
  p == null || p.webContents.send("macro-status", Array.from(d.keys()));
}
function ye(e, t) {
  p == null || p.webContents.send("macro-error", e, t);
}
function me() {
  M || (M = setInterval(() => {
    if (d.size === 0) {
      clearInterval(M), M = null, p == null || p.webContents.send("macro-stats", []);
      return;
    }
    const e = Array.from(d.entries()).map(([t, n]) => ({ id: t, count: n.count, startedAt: n.startedAt }));
    p == null || p.webContents.send("macro-stats", e);
  }, 1e3));
}
function _() {
  try {
    return Y("@nut-tree-fork/nut-js");
  } catch {
    return null;
  }
}
function ke() {
  try {
    return Y("playwright");
  } catch {
    return null;
  }
}
const h = (e, t, n) => Math.max(t, Math.min(n, Number(e) || t));
function y(e, t) {
  return new Promise((n) => {
    let r = 0;
    const s = setInterval(() => {
      r += 40, (t.stopped || r >= e) && (clearInterval(s), n());
    }, 40);
  });
}
function be() {
  const e = "abcdefghijklmnopqrstuvwxyz0123456789", t = 5 + Math.floor(Math.random() * 8);
  let n = "";
  for (let o = 0; o < t; o++) n += e[Math.floor(Math.random() * e.length)];
  return n;
}
async function Se(e, t) {
  const n = _();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { mouse: o, Button: r } = n;
  o.config.autoDelayMs = 0, o.config.mouseSpeed = 1e5;
  const s = e.config.button === "right" ? r.RIGHT : e.config.button === "middle" ? r.MIDDLE : r.LEFT;
  if (e.config.mode === "hold") {
    const w = h(e.config.holdSeconds, 0.05, 3600) * 1e3, i = h(e.config.releaseSeconds, 0.05, 3600) * 1e3;
    for (t.cleanup = async () => {
      try {
        await o.releaseButton(s);
      } catch {
      }
    }; !t.stopped && (await o.pressButton(s), await y(w, t), await o.releaseButton(s), t.count++, !t.stopped); )
      await y(i, t);
    try {
      await o.releaseButton(s);
    } catch {
    }
  } else {
    const i = 1e3 / h(e.config.cps, 1, 200);
    for (; !t.stopped; )
      await o.click(s), t.count++, i > 1 && await y(i, t);
  }
}
function Pe(e, t) {
  const { Key: n } = e, o = (t || "Space").trim(), r = {
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
  }, s = o.toLowerCase();
  return r[s] ? r[s] : /^f([1-9]|1[0-9]|2[0-4])$/i.test(o) ? n["F" + o.slice(1)] : /^[a-z]$/i.test(o) ? n[o.toUpperCase()] : /^[0-9]$/.test(o) ? n["Num" + o] : n.Space;
}
async function Ae(e, t) {
  const n = _();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { keyboard: o } = n;
  o.config.autoDelayMs = 0;
  const r = Pe(n, e.config.key), s = h(e.config.intervalMs, 5, 36e5);
  for (; !t.stopped; )
    await o.pressKey(r), await o.releaseKey(r), t.count++, await y(s, t);
}
async function Ee(e, t) {
  const n = _();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { keyboard: o, Key: r } = n;
  o.config.autoDelayMs = 2;
  const s = String(e.config.text ?? ""), w = h(e.config.startDelayMs ?? 1500, 0, 6e4), i = h(e.config.intervalMs ?? 1e3, 50, 36e5), E = !!e.config.repeat;
  await y(w, t);
  do {
    if (t.stopped || (s && await o.type(s), e.config.pressEnter && (await o.pressKey(r.Enter), await o.releaseKey(r.Enter)), t.count++, !E)) break;
    await y(i, t);
  } while (!t.stopped && E);
}
async function ve(e, t) {
  const n = _();
  if (!n) throw new Error("Input automation not installed. Run: npm install");
  const { mouse: o, Point: r } = n;
  o.config.autoDelayMs = 0;
  const s = h(e.config.intervalSeconds ?? 30, 1, 3600) * 1e3, w = h(e.config.distance ?? 5, 1, 200);
  for (; !t.stopped; ) {
    try {
      const i = await o.getPosition();
      await o.setPosition(new r(i.x + w, i.y)), await o.setPosition(new r(i.x, i.y)), t.count++;
    } catch {
    }
    await y(s, t);
  }
}
async function Me(e, t) {
  const n = ke();
  if (!n) throw new Error("Playwright not installed. Run: npm install && npx playwright install chromium");
  const { chromium: o } = n, r = e.config.browser, s = { headless: !1 };
  (r === "chrome" || r === "msedge") && (s.channel = r);
  const w = {
    google: { url: "https://www.google.com", box: 'textarea[name="q"], input[name="q"]' },
    bing: { url: "https://www.bing.com", box: 'textarea[name="q"], input[name="q"]' },
    duckduckgo: { url: "https://duckduckgo.com", box: 'input[name="q"]' }
  }, i = w[e.config.searchEngine] || w.google, E = h(e.config.delaySeconds ?? 3, 0.5, 3600) * 1e3, q = !!e.config.persistProfile, V = !!e.config.keepOpenOnStop;
  let v = null, b;
  try {
    if (q) {
      const u = f.join(m.getPath("userData"), "lull-browser-profiles", e.id);
      b = await o.launchPersistentContext(u, s);
    } else
      v = await o.launch(s), b = await v.newContext();
  } catch (u) {
    throw new Error(`Could not launch ${r || "browser"}: ${(u == null ? void 0 : u.message) || u}`);
  }
  const $ = async () => {
    try {
      v ? await v.close() : await b.close();
    } catch {
    }
  };
  if (t.cleanup = V ? void 0 : $, q && e.config.signInFirst && !t.stopped) {
    try {
      const u = await b.newPage(), g = e.config.searchEngine === "bing" ? "https://login.live.com" : i.url;
      await u.goto(g, { waitUntil: "domcontentloaded", timeout: 3e4 });
    } catch {
    }
    await y(h(e.config.signInGraceSeconds ?? 45, 5, 600) * 1e3, t);
  }
  for (; !t.stopped; ) {
    let u;
    try {
      u = await b.newPage(), await u.goto(i.url, { waitUntil: "domcontentloaded", timeout: 3e4 });
      const g = u.locator(i.box).first();
      await g.click({ timeout: 8e3 }), await g.fill(be()), await g.press("Enter"), t.count++, await u.waitForTimeout(1200);
      try {
        await u.locator(i.box).first().click({ timeout: 4e3 });
      } catch {
      }
    } catch {
    }
    try {
      const g = b.pages();
      if (g.length > 6)
        for (const oe of g.slice(0, g.length - 3))
          try {
            await oe.close();
          } catch {
          }
    } catch {
    }
    await y(E, t);
  }
  V || await $();
}
function Ie(e) {
  switch (e) {
    case "autoclicker":
      return Se;
    case "keypresser":
      return Ae;
    case "autotyper":
      return Ee;
    case "mousejiggler":
      return ve;
    case "browsersearch":
      return Me;
    default:
      return null;
  }
}
async function ee(e) {
  if (!(e != null && e.id)) return { ok: !1, error: "Invalid macro." };
  if (d.has(e.id)) return { ok: !0 };
  const t = Ie(e.type);
  if (!t) return { ok: !1, error: `Unknown macro type: ${e.type}` };
  const n = { stopped: !1, count: 0, startedAt: Date.now() };
  return d.set(e.id, n), j.set(e.id, e), z(), me(), t(e, n).catch((o) => ye(e.id, (o == null ? void 0 : o.message) || String(o))).finally(async () => {
    var o;
    try {
      await ((o = n.cleanup) == null ? void 0 : o.call(n));
    } catch {
    }
    d.delete(e.id), z();
  }), { ok: !0 };
}
async function O(e) {
  var n;
  const t = d.get(e);
  if (!t) return { ok: !0 };
  t.stopped = !0;
  try {
    await ((n = t.cleanup) == null ? void 0 : n.call(t));
  } catch {
  }
  return { ok: !0 };
}
async function B() {
  const e = Array.from(d.keys());
  await Promise.all(e.map(O));
}
function Te() {
  return Array.from(d.keys());
}
function _e(e) {
  if (d.has(e))
    O(e);
  else {
    const t = j.get(e);
    t && ee(t);
  }
}
function te() {
  T.unregisterAll();
  for (const e of Z)
    if (e.keybind)
      try {
        T.register(e.keybind, () => _e(e.id));
      } catch {
      }
  if (D)
    try {
      T.register(D, () => {
        B();
      });
    } catch {
    }
}
function Re(e) {
  Z = e, j = new Map(e.map((t) => [t.id, t])), te();
}
function xe(e) {
  D = e || "", te();
}
J(import.meta.url);
const F = f.dirname(ie(import.meta.url));
process.env.APP_ROOT = f.join(F, "..");
const P = process.env.VITE_DEV_SERVER_URL, Ne = f.join(process.env.APP_ROOT, "dist-electron"), N = f.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = P ? f.join(process.env.APP_ROOT, "public") : N;
let a, c = null, I = null, R = !1;
function ne() {
  a = new L({
    icon: f.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: f.join(F, "preload.mjs")
    }
  }), a.webContents.on("did-finish-load", () => {
    a == null || a.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), P ? a.loadURL(P) : a.loadFile(f.join(N, "index.html")), a.on("close", (e) => {
    R || (e.preventDefault(), a == null || a.hide());
  }), ge(a);
}
function De(e) {
  c && (c.close(), c = null);
  const t = re.getPrimaryDisplay(), { width: n } = t.workAreaSize, o = 560, r = 320;
  c = new L({
    width: o,
    height: r,
    x: Math.round((n - o) / 2),
    y: 40,
    frame: !1,
    transparent: !0,
    resizable: !1,
    movable: !0,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    focusable: !0,
    icon: f.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: f.join(F, "preload.mjs")
    }
  }), c.setAlwaysOnTop(!0, "screen-saver"), c.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 });
  const s = new URLSearchParams({
    alert: "1",
    data: encodeURIComponent(JSON.stringify(e))
  }).toString();
  P ? c.loadURL(`${P}?${s}`) : c.loadFile(f.join(N, "index.html"), { search: s }), c.on("closed", () => {
    c = null;
  });
}
l.handle(
  "auth:signup",
  (e, t, n) => ue(t, n)
);
l.handle(
  "auth:login",
  (e, t, n) => fe(t, n)
);
l.handle("auth:logout", () => pe());
l.handle("auth:session", () => de());
l.handle(
  "auth:changePassword",
  (e, t, n, o) => we(t, n, o)
);
l.handle(
  "data:save",
  (e, t, n) => he(t, n)
);
l.handle("macros:run", (e, t) => ee(t));
l.handle("macros:stop", (e, t) => O(t));
l.handle("macros:stopAll", () => B());
l.handle("macros:status", () => Te());
l.handle("macros:sync", (e, t) => (Re(Array.isArray(t) ? t : []), { ok: !0 }));
l.handle("macros:panic", (e, t) => (xe(t || ""), { ok: !0 }));
l.on("show-alert", (e, t) => {
  De(t);
});
l.on("close-alert", () => {
  c && (c.close(), c = null);
});
l.on("alert-action", (e, t, n) => {
  a == null || a.webContents.send("alert-action", t, n), c && (c.close(), c = null);
});
function Le() {
  const e = f.join(process.env.VITE_PUBLIC, "icon.png"), t = K.createFromPath(e);
  I = new se(t.isEmpty() ? K.createEmpty() : t), I.setToolTip("Lull");
  const n = ae.buildFromTemplate([
    { label: "Show Lull", click: () => {
      a == null || a.show(), a == null || a.focus();
    } },
    { type: "separator" },
    { label: "Quit", click: () => {
      R = !0, m.quit();
    } }
  ]);
  I.setContextMenu(n), I.on("click", () => {
    a && (a.isVisible() ? a.hide() : (a.show(), a.focus()));
  });
}
m.on("window-all-closed", () => {
  process.platform !== "darwin" && R && (m.quit(), a = null);
});
m.on("before-quit", () => {
  R = !0, B(), T.unregisterAll();
});
m.on("activate", () => {
  L.getAllWindows().length === 0 ? ne() : a == null || a.show();
});
m.whenReady().then(() => {
  ne(), Le();
});
export {
  Ne as MAIN_DIST,
  N as RENDERER_DIST,
  P as VITE_DEV_SERVER_URL
};
