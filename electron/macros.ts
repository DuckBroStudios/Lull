import { createRequire } from 'node:module'
import { globalShortcut, BrowserWindow } from 'electron'

// Native automation deps are heavy and platform-specific, so we load them
// lazily at run time (via require) rather than importing them. That way the
// app still boots fine even if the user hasn't run `npm install` for them yet
// — a macro just reports a friendly error instead of crashing the app.
const require = createRequire(import.meta.url)

// ============ TYPES ============
export interface Macro {
  id: string
  type: 'autoclicker' | 'keypresser' | 'autotyper' | 'mousejiggler'
  name: string
  keybind?: string
  config: any
}

interface RunState {
  stopped: boolean
  count: number
  startedAt: number
  cleanup?: () => Promise<void> | void
}

// ============ MODULE STATE ============
const running = new Map<string, RunState>()
let macroMap = new Map<string, Macro>()
let currentMacros: Macro[] = []
let panicKey = ''
let mainWin: BrowserWindow | null = null
let statsTimer: any = null

export function setMainWindow(win: BrowserWindow | null) {
  mainWin = win
}

function broadcast() {
  mainWin?.webContents.send('macro-status', Array.from(running.keys()))
}
function reportError(id: string, message: string) {
  mainWin?.webContents.send('macro-error', id, message)
}

// periodically push run stats (count + elapsed) for any running macros
function ensureStatsTimer() {
  if (statsTimer) return
  statsTimer = setInterval(() => {
    if (running.size === 0) {
      clearInterval(statsTimer)
      statsTimer = null
      mainWin?.webContents.send('macro-stats', [])
      return
    }
    const arr = Array.from(running.entries()).map(([id, st]) => ({ id, count: st.count, startedAt: st.startedAt }))
    mainWin?.webContents.send('macro-stats', arr)
  }, 1000)
}

// ============ HELPERS ============
function loadNut(): any {
  try {
    return require('@nut-tree-fork/nut-js')
  } catch {
    return null
  }
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number(n) || lo))

function sleep(ms: number, state: RunState): Promise<void> {
  return new Promise(resolve => {
    const step = 40
    let elapsed = 0
    const id = setInterval(() => {
      elapsed += step
      if (state.stopped || elapsed >= ms) {
        clearInterval(id)
        resolve()
      }
    }, step)
  })
}

// ============ MACRO IMPLEMENTATIONS ============

async function runAutoclicker(macro: Macro, state: RunState) {
  const nut = loadNut()
  if (!nut) throw new Error('Input automation not installed. Run: npm install')
  const { mouse, Button } = nut
  mouse.config.autoDelayMs = 0
  mouse.config.mouseSpeed = 100000
  const btn = macro.config.button === 'right' ? Button.RIGHT : macro.config.button === 'middle' ? Button.MIDDLE : Button.LEFT

  if (macro.config.mode === 'hold') {
    const holdMs = clamp(macro.config.holdSeconds, 0.05, 3600) * 1000
    const relMs = clamp(macro.config.releaseSeconds, 0.05, 3600) * 1000
    state.cleanup = async () => { try { await mouse.releaseButton(btn) } catch {} }
    while (!state.stopped) {
      await mouse.pressButton(btn)
      await sleep(holdMs, state)
      await mouse.releaseButton(btn)
      state.count++
      if (state.stopped) break
      await sleep(relMs, state)
    }
    try { await mouse.releaseButton(btn) } catch {}
  } else {
    const cps = clamp(macro.config.cps, 1, 200)
    const interval = 1000 / cps
    while (!state.stopped) {
      await mouse.click(btn)
      state.count++
      if (interval > 1) await sleep(interval, state)
    }
  }
}

function nutKey(nut: any, name: string) {
  const { Key } = nut
  const n = (name || 'Space').trim()
  const map: Record<string, any> = {
    'space': Key.Space, 'enter': Key.Enter, 'return': Key.Enter, 'tab': Key.Tab,
    'up': Key.Up, 'down': Key.Down, 'left': Key.Left, 'right': Key.Right,
    'shift': Key.LeftShift, 'ctrl': Key.LeftControl, 'control': Key.LeftControl, 'alt': Key.LeftAlt,
    'esc': Key.Escape, 'escape': Key.Escape, 'backspace': Key.Backspace, 'delete': Key.Delete,
  }
  const lower = n.toLowerCase()
  if (map[lower]) return map[lower]
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(n)) return Key[('F' + n.slice(1)) as keyof typeof Key]
  if (/^[a-z]$/i.test(n)) return Key[n.toUpperCase() as keyof typeof Key]
  if (/^[0-9]$/.test(n)) return Key[('Num' + n) as keyof typeof Key]
  return Key.Space
}

async function runKeyPresser(macro: Macro, state: RunState) {
  const nut = loadNut()
  if (!nut) throw new Error('Input automation not installed. Run: npm install')
  const { keyboard } = nut
  keyboard.config.autoDelayMs = 0
  const key = nutKey(nut, macro.config.key)
  const interval = clamp(macro.config.intervalMs, 5, 3600000)
  while (!state.stopped) {
    await keyboard.pressKey(key)
    await keyboard.releaseKey(key)
    state.count++
    await sleep(interval, state)
  }
}

async function runAutoTyper(macro: Macro, state: RunState) {
  const nut = loadNut()
  if (!nut) throw new Error('Input automation not installed. Run: npm install')
  const { keyboard, Key } = nut
  keyboard.config.autoDelayMs = 2
  const text = String(macro.config.text ?? '')
  const startDelay = clamp(macro.config.startDelayMs ?? 1500, 0, 60000)
  const intervalMs = clamp(macro.config.intervalMs ?? 1000, 50, 3600000)
  const repeat = !!macro.config.repeat
  await sleep(startDelay, state)
  do {
    if (state.stopped) break
    if (text) await keyboard.type(text)
    if (macro.config.pressEnter) { await keyboard.pressKey(Key.Enter); await keyboard.releaseKey(Key.Enter) }
    state.count++
    if (!repeat) break
    await sleep(intervalMs, state)
  } while (!state.stopped && repeat)
}

async function runMouseJiggler(macro: Macro, state: RunState) {
  const nut = loadNut()
  if (!nut) throw new Error('Input automation not installed. Run: npm install')
  const { mouse, Point } = nut
  mouse.config.autoDelayMs = 0
  const intervalMs = clamp(macro.config.intervalSeconds ?? 30, 1, 3600) * 1000
  const dist = clamp(macro.config.distance ?? 5, 1, 200)
  while (!state.stopped) {
    try {
      const pos = await mouse.getPosition()
      await mouse.setPosition(new Point(pos.x + dist, pos.y))
      await mouse.setPosition(new Point(pos.x, pos.y))
      state.count++
    } catch {}
    await sleep(intervalMs, state)
  }
}

// ============ ORCHESTRATION ============
function runnerFor(type: Macro['type']) {
  switch (type) {
    case 'autoclicker': return runAutoclicker
    case 'keypresser': return runKeyPresser
    case 'autotyper': return runAutoTyper
    case 'mousejiggler': return runMouseJiggler
    default: return null
  }
}

export async function startMacro(macro: Macro): Promise<{ ok: boolean; error?: string }> {
  if (!macro?.id) return { ok: false, error: 'Invalid macro.' }
  if (running.has(macro.id)) return { ok: true }
  const runner = runnerFor(macro.type)
  if (!runner) return { ok: false, error: `Unknown macro type: ${macro.type}` }

  const state: RunState = { stopped: false, count: 0, startedAt: Date.now() }
  running.set(macro.id, state)
  macroMap.set(macro.id, macro)
  broadcast()
  ensureStatsTimer()

  runner(macro, state)
    .catch((e: any) => reportError(macro.id, e?.message || String(e)))
    .finally(async () => {
      try { await state.cleanup?.() } catch {}
      running.delete(macro.id)
      broadcast()
    })

  return { ok: true }
}

export async function stopMacro(id: string): Promise<{ ok: boolean }> {
  const state = running.get(id)
  if (!state) return { ok: true }
  state.stopped = true
  try { await state.cleanup?.() } catch {}
  return { ok: true }
}

export async function stopAll() {
  const ids = Array.from(running.keys())
  await Promise.all(ids.map(stopMacro))
}

export function status(): string[] {
  return Array.from(running.keys())
}

export function toggleMacro(id: string) {
  if (running.has(id)) {
    stopMacro(id)
  } else {
    const m = macroMap.get(id)
    if (m) startMacro(m)
  }
}

// register global hotkeys: one per macro (toggle) plus the panic key (stop all)
function applyShortcuts() {
  globalShortcut.unregisterAll()
  for (const m of currentMacros) {
    if (m.keybind) {
      try { globalShortcut.register(m.keybind, () => toggleMacro(m.id)) } catch {}
    }
  }
  if (panicKey) {
    try { globalShortcut.register(panicKey, () => { stopAll() }) } catch {}
  }
}

export function syncShortcuts(macros: Macro[]) {
  currentMacros = macros
  macroMap = new Map(macros.map(m => [m.id, m]))
  applyShortcuts()
}

export function setPanicKey(key: string) {
  panicKey = key || ''
  applyShortcuts()
}
