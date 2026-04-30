import { ipcMain as p, app as r, BrowserWindow as u, screen as w, nativeImage as T, Tray as P, Menu as b } from "electron";
import { createRequire as v } from "node:module";
import { fileURLToPath as E } from "node:url";
import n from "node:path";
v(import.meta.url);
const d = n.dirname(E(import.meta.url));
process.env.APP_ROOT = n.join(d, "..");
const i = process.env.VITE_DEV_SERVER_URL, V = n.join(process.env.APP_ROOT, "dist-electron"), m = n.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = i ? n.join(process.env.APP_ROOT, "public") : m;
let e, o = null, a = null, c = !1;
function R() {
  e = new u({
    icon: n.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: n.join(d, "preload.mjs")
    }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), i ? e.loadURL(i) : e.loadFile(n.join(m, "index.html")), e.on("close", (s) => {
    c || (s.preventDefault(), e == null || e.hide());
  });
}
function I(s) {
  o && (o.close(), o = null);
  const t = w.getPrimaryDisplay(), { width: l } = t.workAreaSize, f = 560, _ = 320;
  o = new u({
    width: f,
    height: _,
    x: Math.round((l - f) / 2),
    y: 40,
    frame: !1,
    transparent: !0,
    resizable: !1,
    movable: !0,
    alwaysOnTop: !0,
    skipTaskbar: !0,
    focusable: !0,
    icon: n.join(process.env.VITE_PUBLIC, "icon.png"),
    webPreferences: {
      preload: n.join(d, "preload.mjs")
    }
  }), o.setAlwaysOnTop(!0, "screen-saver"), o.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 });
  const h = new URLSearchParams({
    alert: "1",
    data: encodeURIComponent(JSON.stringify(s))
  }).toString();
  i ? o.loadURL(`${i}?${h}`) : o.loadFile(n.join(m, "index.html"), { search: h }), o.on("closed", () => {
    o = null;
  });
}
p.on("show-alert", (s, t) => {
  I(t);
});
p.on("close-alert", () => {
  o && (o.close(), o = null);
});
p.on("alert-action", (s, t, l) => {
  e == null || e.webContents.send("alert-action", t, l), o && (o.close(), o = null);
});
function y() {
  const s = n.join(process.env.VITE_PUBLIC, "icon.png"), t = T.createFromPath(s);
  a = new P(t.isEmpty() ? T.createEmpty() : t), a.setToolTip("Lull");
  const l = b.buildFromTemplate([
    { label: "Show Lull", click: () => {
      e == null || e.show(), e == null || e.focus();
    } },
    { type: "separator" },
    { label: "Quit", click: () => {
      c = !0, r.quit();
    } }
  ]);
  a.setContextMenu(l), a.on("click", () => {
    e && (e.isVisible() ? e.hide() : (e.show(), e.focus()));
  });
}
r.on("window-all-closed", () => {
  process.platform !== "darwin" && c && (r.quit(), e = null);
});
r.on("before-quit", () => {
  c = !0;
});
r.on("activate", () => {
  u.getAllWindows().length === 0 ? R() : e == null || e.show();
});
r.whenReady().then(() => {
  R(), y();
});
export {
  V as MAIN_DIST,
  m as RENDERER_DIST,
  i as VITE_DEV_SERVER_URL
};
