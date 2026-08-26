import { app } from 'electron'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

// ============================================================
// Local, offline account + data store for Lull.
// Everything lives in a single JSON file inside Electron's
// userData directory, so it survives app restarts and installs.
// Passwords are never stored in plain text — we keep a random
// salt + scrypt hash and compare in constant time on login.
// ============================================================

export interface Account {
  username: string
  salt: string
  hash: string
  createdAt: number
  reminders: any[]
  tasks: any[]
  settings: UserSettings
}

export interface UserSettings {
  displayName: string
  theme: 'light' | 'dark'
  soundEnabled: boolean
  panicHotkey: string
  notifSound: string
  vibrate: boolean
  strongAlert: boolean
  background: string
  soundPack: string
  autoSeasonal: boolean
  zenMode: boolean
  microAnimations: boolean
  appIcon: string
  pattern: string
  music: boolean
  autoAppIcon: boolean
  avatarType: 'monogram' | 'preset' | 'photo'
  avatarPhoto: string
  avatarPreset: string
  avatarColor: string
  profileVisible: boolean
  timezone: string
  autoTimezone: boolean
  unlockedIcons: string[]
  dashboardOrder: string[]
  codeFont: string
  codeFontSize: number
  codeTheme: string
  codeTabSize: number
  codeWrap: boolean
  codeLivePreview: boolean
  codeLineNumbers: boolean
}

interface StoreFile {
  version: number
  session: string | null // username of the last logged-in user (auto-login)
  accounts: Record<string, Account> // keyed by lowercased username
}

const DEFAULT_SETTINGS: UserSettings = {
  displayName: '',
  theme: 'light',
  soundEnabled: true,
  panicHotkey: '',
  notifSound: 'chime.wav',
  vibrate: true,
  strongAlert: false,
  background: 'default',
  soundPack: 'all',
  autoSeasonal: false,
  zenMode: false,
  microAnimations: true,
  appIcon: 'default',
  pattern: 'none',
  music: false,
  autoAppIcon: false,
  avatarType: 'monogram',
  avatarPhoto: '',
  avatarPreset: 'terra',
  avatarColor: '#C8553D',
  profileVisible: false,
  timezone: 'auto',
  autoTimezone: true,
  unlockedIcons: [],
  dashboardOrder: [],
  codeFont: 'mono',
  codeFontSize: 13,
  codeTheme: 'match',
  codeTabSize: 2,
  codeWrap: false,
  codeLivePreview: true,
  codeLineNumbers: false,
}

function storePath(): string {
  return path.join(app.getPath('userData'), 'lull-data.json')
}

function emptyStore(): StoreFile {
  return { version: 1, session: null, accounts: {} }
}

function readStore(): StoreFile {
  try {
    const raw = fs.readFileSync(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as StoreFile
    if (!parsed.accounts) parsed.accounts = {}
    if (typeof parsed.session === 'undefined') parsed.session = null
    return parsed
  } catch {
    return emptyStore()
  }
}

function writeStore(data: StoreFile): void {
  const file = storePath()
  const tmp = `${file}.tmp`
  // write to a temp file first, then rename — avoids a half-written
  // file if the app is killed mid-save
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, file)
}

function key(username: string): string {
  return username.trim().toLowerCase()
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const attempt = scryptSync(password, salt, 64)
  const stored = Buffer.from(hash, 'hex')
  if (attempt.length !== stored.length) return false
  return timingSafeEqual(attempt, stored)
}

// Public shape returned to the renderer (never includes salt/hash)
function publicUser(acc: Account) {
  return {
    username: acc.username,
    createdAt: acc.createdAt,
    reminders: acc.reminders || [],
    tasks: acc.tasks || [],
    settings: { ...DEFAULT_SETTINGS, ...(acc.settings || {}) },
  }
}

// ============================================================
// Operations
// ============================================================

export function signup(username: string, password: string) {
  const uname = (username || '').trim()
  if (uname.length < 2) return { ok: false, error: 'Username must be at least 2 characters.' }
  if ((password || '').length < 4) return { ok: false, error: 'Password must be at least 4 characters.' }

  const store = readStore()
  if (store.accounts[key(uname)]) {
    return { ok: false, error: 'That username is already taken.' }
  }

  const salt = randomBytes(16).toString('hex')
  const acc: Account = {
    username: uname,
    salt,
    hash: hashPassword(password, salt),
    createdAt: Date.now(),
    reminders: [],
    tasks: [],
    settings: { ...DEFAULT_SETTINGS, displayName: uname },
  }
  store.accounts[key(uname)] = acc
  store.session = key(uname)
  writeStore(store)
  return { ok: true, user: publicUser(acc) }
}

export function login(username: string, password: string) {
  const store = readStore()
  const acc = store.accounts[key(username || '')]
  if (!acc) return { ok: false, error: 'No account with that username.' }
  if (!verifyPassword(password || '', acc.salt, acc.hash)) {
    return { ok: false, error: 'Incorrect password.' }
  }
  store.session = key(acc.username)
  writeStore(store)
  return { ok: true, user: publicUser(acc) }
}

export function logout() {
  const store = readStore()
  store.session = null
  writeStore(store)
  return { ok: true }
}

// Auto-login: returns the remembered user, if any
export function getSession() {
  const store = readStore()
  if (!store.session) return { ok: true, user: null }
  const acc = store.accounts[store.session]
  if (!acc) return { ok: true, user: null }
  return { ok: true, user: publicUser(acc) }
}

// Save a user's reminders + settings
export function saveData(
  username: string,
  data: { reminders?: any[]; tasks?: any[]; settings?: UserSettings }
) {
  const store = readStore()
  const acc = store.accounts[key(username || '')]
  if (!acc) return { ok: false, error: 'Account not found.' }
  if (Array.isArray(data.reminders)) acc.reminders = data.reminders
  if (Array.isArray(data.tasks)) acc.tasks = data.tasks
  if (data.settings) acc.settings = { ...DEFAULT_SETTINGS, ...acc.settings, ...data.settings }
  writeStore(store)
  return { ok: true }
}

// Change password (used from settings, optional)
export function changePassword(username: string, current: string, next: string) {
  const store = readStore()
  const acc = store.accounts[key(username || '')]
  if (!acc) return { ok: false, error: 'Account not found.' }
  if (!verifyPassword(current || '', acc.salt, acc.hash)) {
    return { ok: false, error: 'Current password is incorrect.' }
  }
  if ((next || '').length < 4) return { ok: false, error: 'New password must be at least 4 characters.' }
  const salt = randomBytes(16).toString('hex')
  acc.salt = salt
  acc.hash = hashPassword(next, salt)
  writeStore(store)
  return { ok: true }
}
