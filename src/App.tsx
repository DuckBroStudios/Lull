import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Image as ImageIcon, Trash2, AlarmClock, Bell, Clock, Settings, LogOut, User, Moon, Sun, Volume2, VolumeX, Eye, EyeOff, Zap, Play, Square, MousePointerClick, Keyboard, Type, Move, Globe, Pencil, ChevronLeft, AlertTriangle, Music, Pause } from 'lucide-react';
import { isNative, requestReminderPermission, syncReminderNotifications } from './notifications';

// detect if this window is the alert popup
const urlParams = new URLSearchParams(window.location.search);
const isAlertWindow = urlParams.get('alert') === '1';
const alertData = isAlertWindow
  ? JSON.parse(decodeURIComponent(urlParams.get('data') || '{}'))
  : null;

// access electron's ipc bridge if available
const ipc: any = (window as any).lull;

// ============ TYPES ============
type Theme = 'light' | 'dark';
interface UserSettings {
  displayName: string;
  theme: Theme;
  soundEnabled: boolean;
  panicHotkey: string;
  notifSound: string;
  vibrate: boolean;
  strongAlert: boolean;
  background: string;
  soundPack: string;
  autoSeasonal: boolean;
  zenMode: boolean;
  microAnimations: boolean;
  appIcon: string;
  pattern: string;
  music: boolean;
}
interface SessionUser {
  username: string;
  reminders: any[];
  tasks: any[];
  settings: UserSettings;
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
};

// ============ DELIGHT: backgrounds, seasons, sound packs, greeting, icons ============
const BACKGROUNDS: Record<string, { light: string; dark: string } | null> = {
  default: null,
  dawn: { light: 'linear-gradient(180deg,#FDEDE2 0%,#F6D8C6 100%)', dark: 'linear-gradient(180deg,#2A211C 0%,#3A2A22 100%)' },
  dusk: { light: 'linear-gradient(180deg,#EAE2F2 0%,#D9C9EA 100%)', dark: 'linear-gradient(180deg,#211E2A 0%,#2E2838 100%)' },
  forest: { light: 'linear-gradient(180deg,#E8F0E4 0%,#CFE0C6 100%)', dark: 'linear-gradient(180deg,#1B241C 0%,#232E22 100%)' },
  ocean: { light: 'linear-gradient(180deg,#E2EEF4 0%,#C6DCE8 100%)', dark: 'linear-gradient(180deg,#1A2228 0%,#222E36 100%)' },
};
const BACKGROUND_KEYS = ['default', 'dawn', 'dusk', 'forest', 'ocean'];
const ZEN_BG = { light: 'linear-gradient(180deg,#E7EFEA 0%,#D2E2DA 100%)', dark: 'linear-gradient(180deg,#121917 0%,#182420 100%)' };

// Custom Lull-style decorations — minimal single-colour SVG motifs (viewBox 0 0 100 100).
const DECOR_ICONS: Record<string, string> = {
  sun: '<circle cx="50" cy="50" r="18" fill="currentColor"/><g stroke="currentColor" stroke-width="6" stroke-linecap="round"><line x1="50" y1="8" x2="50" y2="20"/><line x1="50" y1="80" x2="50" y2="92"/><line x1="8" y1="50" x2="20" y2="50"/><line x1="80" y1="50" x2="92" y2="50"/><line x1="20" y1="20" x2="29" y2="29"/><line x1="71" y1="71" x2="80" y2="80"/><line x1="80" y1="20" x2="71" y2="29"/><line x1="29" y1="71" x2="20" y2="80"/></g>',
  umbrella: '<path d="M16 50 A34 34 0 0 1 84 50 Q67 42 50 50 Q33 42 16 50 Z" fill="currentColor"/><rect x="47" y="50" width="6" height="30" rx="3" fill="currentColor"/><path d="M53 80 q10 0 10 -9" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
  wave: '<path d="M8 46 q11 -15 22 0 t22 0 t22 0 t22 0" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M8 66 q11 -15 22 0 t22 0 t22 0 t22 0" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
  palm: '<path d="M50 88 Q45 58 54 34" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"><path d="M52 32 Q30 24 16 32"/><path d="M52 32 Q74 24 86 34"/><path d="M52 32 Q40 16 24 14"/><path d="M52 32 Q66 16 82 16"/></g>',
  icecream: '<circle cx="42" cy="32" r="15" fill="currentColor"/><circle cx="60" cy="30" r="13" fill="currentColor"/><path d="M28 44 L72 44 L50 92 Z" fill="currentColor"/>',
  flower: '<g fill="currentColor"><circle cx="50" cy="26" r="13"/><circle cx="74" cy="44" r="13"/><circle cx="65" cy="72" r="13"/><circle cx="35" cy="72" r="13"/><circle cx="26" cy="44" r="13"/></g>',
  leaf: '<path d="M50 12 C78 30 78 68 50 90 C22 68 22 30 50 12 Z" fill="currentColor"/>',
  butterfly: '<g fill="currentColor"><ellipse cx="33" cy="38" rx="17" ry="21"/><ellipse cx="67" cy="38" rx="17" ry="21"/><ellipse cx="36" cy="67" rx="13" ry="15"/><ellipse cx="64" cy="67" rx="13" ry="15"/><rect x="47" y="28" width="6" height="46" rx="3"/></g>',
  sprout: '<g fill="currentColor"><rect x="47" y="44" width="6" height="44" rx="3"/><ellipse cx="32" cy="40" rx="15" ry="9" transform="rotate(-28 32 40)"/><ellipse cx="68" cy="40" rx="15" ry="9" transform="rotate(28 68 40)"/></g>',
  acorn: '<g fill="currentColor"><path d="M28 40 Q50 24 72 40 Q50 48 28 40 Z"/><path d="M32 43 Q50 46 68 43 L61 68 Q50 80 39 68 Z"/></g>',
  mushroom: '<g fill="currentColor"><path d="M20 52 Q50 20 80 52 Q50 60 20 52 Z"/><rect x="42" y="52" width="16" height="32" rx="7"/></g>',
  snowflake: '<g stroke="currentColor" stroke-width="5" stroke-linecap="round"><line x1="50" y1="10" x2="50" y2="90"/><line x1="15" y1="30" x2="85" y2="70"/><line x1="85" y1="30" x2="15" y2="70"/><path d="M50 24 l-9 -9 M50 24 l9 -9 M50 76 l-9 9 M50 76 l9 9"/></g>',
  snowman: '<g fill="currentColor"><circle cx="50" cy="66" r="20"/><circle cx="50" cy="36" r="13"/><rect x="38" y="15" width="24" height="7" rx="2"/><rect x="43" y="6" width="14" height="11" rx="2"/></g>',
  moon: '<path d="M64 18 A34 34 0 1 0 64 82 A27 27 0 1 1 64 18 Z" fill="currentColor"/>',
  egg: '<path d="M50 12 C69 12 79 44 79 60 A29 29 0 0 1 21 60 C21 44 31 12 50 12 Z" fill="currentColor"/>',
  bunny: '<g fill="currentColor"><ellipse cx="38" cy="24" rx="8" ry="22"/><ellipse cx="62" cy="24" rx="8" ry="22"/><circle cx="50" cy="62" r="23"/></g>',
  tree: '<g fill="currentColor"><polygon points="50,12 68,40 32,40"/><polygon points="50,30 76,64 24,64"/><rect x="44" y="64" width="12" height="16" rx="2"/></g>',
  gift: '<g fill="currentColor"><rect x="24" y="42" width="52" height="42" rx="4"/><rect x="20" y="32" width="60" height="13" rx="3"/><rect x="45" y="32" width="10" height="52"/></g>',
  star: '<path d="M50 8 L61 38 L92 38 L67 57 L76 90 L50 70 L24 90 L33 57 L8 38 L39 38 Z" fill="currentColor"/>',
  ornament: '<g fill="currentColor"><circle cx="50" cy="58" r="26"/><rect x="44" y="24" width="12" height="10" rx="2"/><rect x="46" y="16" width="8" height="9" rx="2"/></g>',
  pumpkin: '<g fill="currentColor"><ellipse cx="50" cy="58" rx="30" ry="25"/><ellipse cx="33" cy="58" rx="16" ry="25"/><ellipse cx="67" cy="58" rx="16" ry="25"/><rect x="46" y="24" width="8" height="15" rx="3"/></g>',
  ghost: '<path d="M26 56 A24 24 0 0 1 74 56 L74 86 L65 78 L57 86 L50 78 L43 86 L35 78 L26 86 Z" fill="currentColor"/>',
  bat: '<g fill="currentColor"><ellipse cx="50" cy="52" rx="8" ry="12"/><path d="M50 46 L16 34 Q26 52 12 60 Q36 55 43 64 Z"/><path d="M50 46 L84 34 Q74 52 88 60 Q64 55 57 64 Z"/></g>',
  firework: '<g stroke="currentColor" stroke-width="5" stroke-linecap="round"><line x1="50" y1="50" x2="50" y2="16"/><line x1="50" y1="50" x2="84" y2="50"/><line x1="50" y1="50" x2="50" y2="84"/><line x1="50" y1="50" x2="16" y2="50"/><line x1="50" y1="50" x2="74" y2="26"/><line x1="50" y1="50" x2="26" y2="74"/><line x1="50" y1="50" x2="74" y2="74"/><line x1="50" y1="50" x2="26" y2="26"/></g>',
  champagne: '<g fill="currentColor"><path d="M38 18 L62 18 L57 48 Q50 55 43 48 Z"/><rect x="47" y="52" width="6" height="24" rx="2"/><rect x="36" y="78" width="28" height="6" rx="3"/></g>',
  sparkle: '<path d="M50 10 C53 40 60 47 90 50 C60 53 53 60 50 90 C47 60 40 53 10 50 C40 47 47 40 50 10 Z" fill="currentColor"/>',
};

// motif set per decoration theme (season or holiday)
const DECOR_SETS: Record<string, string[]> = {
  spring: ['flower', 'leaf', 'butterfly', 'sprout', 'flower'],
  summer: ['sun', 'umbrella', 'wave', 'palm', 'icecream'],
  autumn: ['leaf', 'acorn', 'mushroom', 'leaf', 'sprout'],
  winter: ['snowflake', 'snowman', 'moon', 'snowflake', 'star'],
  easter: ['egg', 'bunny', 'flower', 'egg', 'sprout'],
  christmas: ['tree', 'gift', 'star', 'snowflake', 'ornament'],
  halloween: ['pumpkin', 'ghost', 'bat', 'moon', 'pumpkin'],
  newyear: ['firework', 'star', 'champagne', 'sparkle', 'firework'],
};

// pick a holiday theme when in its window, otherwise the season
function decorThemeOf(d: Date): string {
  const m = d.getMonth(), day = d.getDate();
  if ((m === 11 && day >= 31) || (m === 0 && day <= 2)) return 'newyear';
  if (m === 11 && day >= 13) return 'christmas';
  if (m === 9 && day >= 18) return 'halloween';
  if ((m === 2 && day >= 22) || (m === 3 && day <= 21)) return 'easter';
  return seasonOf(d).label.toLowerCase();
}

const DECOR_SLOTS: { pos: React.CSSProperties; size: number; delay: string }[] = [
  { pos: { top: '5%', left: '3%' }, size: 90, delay: '0s' },
  { pos: { top: '11%', right: '4%' }, size: 108, delay: '0.8s' },
  { pos: { top: '40%', left: '1%' }, size: 74, delay: '1.5s' },
  { pos: { top: '52%', right: '2%' }, size: 98, delay: '0.4s' },
  { pos: { bottom: '15%', left: '5%' }, size: 84, delay: '1.1s' },
  { pos: { bottom: '5%', right: '7%' }, size: 78, delay: '1.9s' },
  { pos: { top: '73%', left: '42%' }, size: 64, delay: '0.6s' },
  { pos: { top: '26%', left: '45%' }, size: 60, delay: '1.3s' },
];

function DecorIcon({ motif, size, delay }: { motif: string; size: number; delay: string }) {
  const inner = DECOR_ICONS[motif];
  if (!inner) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className="lull-float text-terra"
      style={{ animationDelay: delay, opacity: 0.18 }}
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}

function patternStyle(settings: UserSettings): React.CSSProperties {
  const c = settings.theme === 'dark' ? 'rgba(245,239,230,0.14)' : 'rgba(31,36,33,0.12)';
  switch (settings.pattern) {
    case 'dots': return { backgroundImage: `radial-gradient(${c} 2.6px, transparent 2.6px)`, backgroundSize: '20px 20px' };
    case 'grid': return { backgroundImage: `linear-gradient(${c} 1.6px, transparent 1.6px), linear-gradient(90deg, ${c} 1.6px, transparent 1.6px)`, backgroundSize: '24px 24px' };
    case 'diagonal': return { backgroundImage: `repeating-linear-gradient(45deg, ${c} 0, ${c} 2.2px, transparent 2.2px, transparent 12px)` };
    case 'cross': return { backgroundImage: `radial-gradient(${c} 2.4px, transparent 2.4px), radial-gradient(${c} 2.4px, transparent 2.4px)`, backgroundSize: '26px 26px', backgroundPosition: '0 0, 13px 13px' };
    default: return {};
  }
}

function seasonOf(d: Date): { label: string; bg: string } {
  const m = d.getMonth();
  if (m >= 2 && m <= 4) return { label: 'Spring', bg: 'forest' };
  if (m >= 5 && m <= 7) return { label: 'Summer', bg: 'ocean' };
  if (m >= 8 && m <= 10) return { label: 'Autumn', bg: 'dawn' };
  return { label: 'Winter', bg: 'dusk' };
}

function resolveBackground(settings: UserSettings, now: number): string {
  const theme = settings.theme === 'dark' ? 'dark' : 'light';
  if (settings.zenMode) return ZEN_BG[theme];
  let key = settings.background || 'default';
  if (settings.autoSeasonal) key = seasonOf(new Date(now)).bg;
  const bg = BACKGROUNDS[key];
  if (!bg) return 'linear-gradient(180deg, var(--page-top) 0%, var(--page-bottom) 100%)';
  return bg[theme];
}

function greetingText(settings: UserSettings, now: number): string {
  const h = new Date(now).getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return settings.displayName ? `${part}, ${settings.displayName}` : part;
}

const SOUND_PACKS: Record<string, { label: string; files: string[] }> = {
  all: { label: 'All', files: ['chime.wav', 'ding.wav', 'soft-bell.wav', 'beep.wav', 'double-beep.wav', 'marimba.wav', 'pluck.wav', 'triad.wav', 'rising.wav', 'descending.wav', 'bloop.wav', 'alert.wav'] },
  soft: { label: 'Soft', files: ['soft-bell.wav', 'chime.wav', 'marimba.wav', 'triad.wav'] },
  retro: { label: 'Retro', files: ['beep.wav', 'double-beep.wav', 'alert.wav', 'bloop.wav'] },
  nature: { label: 'Nature', files: ['rising.wav', 'descending.wav', 'pluck.wav', 'ding.wav'] },
};
const SOUND_PACK_KEYS = ['all', 'soft', 'retro', 'nature'];

const APP_ICONS = [
  { key: 'default', label: 'Ink', preview: 'icons/icon-default.png' },
  { key: 'terra', label: 'Terra', preview: 'icons/icon-terra.png' },
  { key: 'forest', label: 'Forest', preview: 'icons/icon-forest.png' },
  { key: 'cream', label: 'Cream', preview: 'icons/icon-cream.png' },
];

async function applyAppIcon(key: string) {
  if (!isNative) return;
  try {
    // Uses a native alternate-icon plugin if present; no-ops (build-safe) until one is wired.
    const plugins = (window as any)?.Capacitor?.Plugins;
    const p = plugins?.DynamicIcon || plugins?.AlternateIcon;
    if (p?.setIcon) await p.setIcon({ name: key === 'default' ? null : key });
  } catch { /* no-op */ }
}

// iOS notification sound presets (bundled .wav files; also in public/sounds for preview)
const NOTIF_SOUNDS: { file: string; label: string }[] = [
  { file: 'chime.wav', label: 'Chime' },
  { file: 'ding.wav', label: 'Ding' },
  { file: 'soft-bell.wav', label: 'Soft Bell' },
  { file: 'beep.wav', label: 'Beep' },
  { file: 'double-beep.wav', label: 'Double Beep' },
  { file: 'marimba.wav', label: 'Marimba' },
  { file: 'pluck.wav', label: 'Pluck' },
  { file: 'triad.wav', label: 'Triad' },
  { file: 'rising.wav', label: 'Rising' },
  { file: 'descending.wav', label: 'Descending' },
  { file: 'bloop.wav', label: 'Bloop' },
  { file: 'alert.wav', label: 'Alert' },
];

let previewAudio: HTMLAudioElement | null = null;
function playPreview(file: string) {
  try {
    if (previewAudio) previewAudio.pause();
    previewAudio = new Audio(`sounds/${file}`);
    previewAudio.play().catch(() => {});
  } catch { /* ignore */ }
}

// ============ STORAGE API ============
// Uses Electron IPC (accounts stored on disk, passwords hashed) when
// available, and falls back to localStorage for in-browser dev.
const api = {
  async signup(username: string, password: string) {
    if (ipc?.invoke) return ipc.invoke('auth:signup', username, password);
    return localSignup(username, password);
  },
  async login(username: string, password: string) {
    if (ipc?.invoke) return ipc.invoke('auth:login', username, password);
    return localLogin(username, password);
  },
  async logout() {
    if (ipc?.invoke) return ipc.invoke('auth:logout');
    localStorage.removeItem('lull-session');
    return { ok: true };
  },
  async session() {
    if (ipc?.invoke) return ipc.invoke('auth:session');
    return localSession();
  },
  async save(username: string, data: { reminders?: any[]; tasks?: any[]; settings?: UserSettings }) {
    if (ipc?.invoke) return ipc.invoke('data:save', username, data);
    return localSave(username, data);
  },
  async runMacro(macro: Macro) {
    if (ipc?.invoke) return ipc.invoke('macros:run', macro);
    return { ok: false, error: 'Automation is only available in the desktop app.' };
  },
  async stopMacro(id: string) {
    if (ipc?.invoke) return ipc.invoke('macros:stop', id);
    return { ok: true };
  },
  async syncMacros(list: Macro[]) {
    if (ipc?.invoke) return ipc.invoke('macros:sync', list);
    return { ok: true };
  },
  async setPanic(key: string) {
    if (ipc?.invoke) return ipc.invoke('macros:panic', key);
    return { ok: true };
  },
  async stopAll() {
    if (ipc?.invoke) return ipc.invoke('macros:stopAll');
    return { ok: true };
  },
};

// --- localStorage fallback (dev / non-electron only) ---
function readLocalAccounts(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem('lull-accounts') || '{}'); } catch { return {}; }
}
function writeLocalAccounts(a: Record<string, any>) {
  localStorage.setItem('lull-accounts', JSON.stringify(a));
}
function localSignup(username: string, password: string) {
  const uname = username.trim();
  if (uname.length < 2) return { ok: false, error: 'Username must be at least 2 characters.' };
  if (password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
  const accounts = readLocalAccounts();
  const k = uname.toLowerCase();
  if (accounts[k]) return { ok: false, error: 'That username is already taken.' };
  accounts[k] = { username: uname, password, reminders: [], tasks: [], settings: { ...DEFAULT_SETTINGS, displayName: uname } };
  writeLocalAccounts(accounts);
  localStorage.setItem('lull-session', k);
  return { ok: true, user: publicLocal(accounts[k]) };
}
function localLogin(username: string, password: string) {
  const accounts = readLocalAccounts();
  const acc = accounts[(username || '').trim().toLowerCase()];
  if (!acc) return { ok: false, error: 'No account with that username.' };
  if (acc.password !== password) return { ok: false, error: 'Incorrect password.' };
  localStorage.setItem('lull-session', acc.username.toLowerCase());
  return { ok: true, user: publicLocal(acc) };
}
function localSession() {
  const k = localStorage.getItem('lull-session');
  if (!k) return { ok: true, user: null };
  const acc = readLocalAccounts()[k];
  return { ok: true, user: acc ? publicLocal(acc) : null };
}
function localSave(username: string, data: { reminders?: any[]; tasks?: any[]; settings?: UserSettings }) {
  const accounts = readLocalAccounts();
  const acc = accounts[(username || '').trim().toLowerCase()];
  if (!acc) return { ok: false, error: 'Account not found.' };
  if (Array.isArray(data.reminders)) acc.reminders = data.reminders;
  if (Array.isArray(data.tasks)) acc.tasks = data.tasks;
  if (data.settings) acc.settings = { ...DEFAULT_SETTINGS, ...acc.settings, ...data.settings };
  writeLocalAccounts(accounts);
  return { ok: true };
}
function publicLocal(acc: any): SessionUser {
  return { username: acc.username, reminders: acc.reminders || [], tasks: acc.tasks || [], settings: { ...DEFAULT_SETTINGS, ...(acc.settings || {}) } };
}

// ============ MACRO / TASK MODEL ============
type MacroType = 'autoclicker' | 'browsersearch' | 'keypresser' | 'autotyper' | 'mousejiggler';
interface Macro {
  id: string;
  type: MacroType;
  name: string;
  keybind: string;
  config: any;
}

const PRESETS: { type: MacroType; name: string; blurb: string; icon: any; keybind: string; engine: 'input' | 'browser' }[] = [
  { type: 'autoclicker', name: 'Auto Clicker', blurb: 'Rapid-fire clicks, or a hold-then-release cycle, at a speed you set. Toggle with a global hotkey.', icon: MousePointerClick, keybind: 'F6', engine: 'input' },
  { type: 'browsersearch', name: 'Browser Searcher', blurb: 'Opens a browser, then searches random letters + numbers in a new tab on a loop. Keeps going even while minimized.', icon: Globe, keybind: 'F7', engine: 'browser' },
  { type: 'keypresser', name: 'Key Presser', blurb: 'Taps a key you choose over and over at a set interval. Great for anti-idle or spamming an action.', icon: Keyboard, keybind: 'F8', engine: 'input' },
  { type: 'autotyper', name: 'Auto Typer', blurb: 'Types a phrase for you — once, or on repeat. Useful for testing forms and chats.', icon: Type, keybind: 'F9', engine: 'input' },
  { type: 'mousejiggler', name: 'Mouse Jiggler', blurb: 'Nudges the mouse every so often so your machine stays awake and shows as active.', icon: Move, keybind: 'F10', engine: 'input' },
];

function defaultConfig(type: MacroType): any {
  switch (type) {
    case 'autoclicker': return { button: 'left', mode: 'rapid', cps: 10, holdSeconds: 1, releaseSeconds: 1 };
    case 'browsersearch': return { browser: 'chrome', searchEngine: 'google', delaySeconds: 3, persistProfile: false, signInFirst: false, signInGraceSeconds: 45, keepOpenOnStop: false };
    case 'keypresser': return { key: 'Space', intervalMs: 1000 };
    case 'autotyper': return { text: 'Hello from Lull', pressEnter: true, repeat: true, intervalMs: 1000, startDelayMs: 1500 };
    case 'mousejiggler': return { intervalSeconds: 30, distance: 5 };
    default: return {};
  }
}

function newMacro(type: MacroType): Macro {
  const preset = PRESETS.find(p => p.type === type)!;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    name: preset.name,
    keybind: preset.keybind,
    config: defaultConfig(type),
  };
}

function iconForType(type: MacroType) {
  return (PRESETS.find(p => p.type === type) || PRESETS[0]).icon;
}

function taskSummary(t: Macro): string {
  const c = t.config || {};
  switch (t.type) {
    case 'autoclicker':
      return c.mode === 'hold'
        ? `Hold ${c.holdSeconds}s · release ${c.releaseSeconds}s · ${c.button} button`
        : `${c.cps} clicks/sec · ${c.button} button`;
    case 'browsersearch':
      return `${c.browser} · ${c.searchEngine} · new search every ${c.delaySeconds}s`;
    case 'keypresser':
      return `Key "${c.key}" · every ${c.intervalMs}ms`;
    case 'autotyper':
      return `"${String(c.text || '').slice(0, 24)}"${c.repeat ? ` · every ${c.intervalMs}ms` : ' · once'}`;
    case 'mousejiggler':
      return `Every ${c.intervalSeconds}s · ${c.distance}px nudge`;
    default:
      return '';
  }
}

function statLabel(type: MacroType): string {
  switch (type) {
    case 'autoclicker': return 'clicks';
    case 'browsersearch': return 'searches';
    case 'keypresser': return 'presses';
    case 'autotyper': return 'types';
    case 'mousejiggler': return 'jiggles';
    default: return 'actions';
  }
}

function fmtElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = String(s % 60).padStart(2, '0');
  return `${m}:${ss}`;
}

// ============ RECURRING REMINDERS ============
const isRecurring = (r: any) => r && r.repeat && r.repeat !== 'none';

function nextReminderTrigger(ts: number, repeat: string, now: number): number {
  const d = new Date(ts);
  const advance = () => {
    if (repeat === 'daily') d.setDate(d.getDate() + 1);
    else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
    else if (repeat === 'weekdays') { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); }
    else d.setFullYear(d.getFullYear() + 100);
  };
  let guard = 0;
  do { advance(); guard++; } while (d.getTime() <= now && guard < 5000);
  return d.getTime();
}

const repeatLabel = (r: string) => r === 'weekdays' ? 'Weekdays' : r === 'weekly' ? 'Weekly' : r === 'daily' ? 'Daily' : '';

export default function App() {
  // ============ AUTH STATE ============
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(isAlertWindow); // alert window skips auth
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  // ============ TASK / MACRO STATE ============
  const [tasks, setTasks] = useState<Macro[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Macro | null>(null);
  const [runningIds, setRunningIds] = useState<string[]>([]);
  const [macroError, setMacroError] = useState<string>('');
  const [macroStats, setMacroStats] = useState<Record<string, { count: number; startedAt: number }>>({});

  // ============ REMINDER STATE ============
  const [reminders, setReminders] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [now, setNow] = useState(Date.now());
  const [loaded, setLoaded] = useState(false);

  // form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState('none');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  // ============ EFFECTS ============

  // load Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Geist:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch (_) {} };
  }, []);

  // check for an existing session on startup (auto-login), main window only
  useEffect(() => {
    if (isAlertWindow) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.session();
        if (!cancelled && res?.ok && res.user) {
          applyUser(res.user);
        }
      } catch (_) { /* ignore */ }
      if (!cancelled) setAuthChecked(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // load the logged-in user's reminders + settings into state
  const applyUser = (u: SessionUser) => {
    let rems = Array.isArray(u.reminders) ? u.reminders : [];
    // one-time migration: pull in reminders from the old pre-account storage
    try {
      if (rems.length === 0) {
        const legacy = JSON.parse(localStorage.getItem('lull-reminders') || '[]');
        if (Array.isArray(legacy) && legacy.length) {
          rems = legacy;
          localStorage.removeItem('lull-reminders');
        }
      }
    } catch (_) { /* ignore */ }
    setUser(u);
    setSettings({ ...DEFAULT_SETTINGS, ...u.settings });
    setReminders([...rems].sort((a, b) => a.triggerAt - b.triggerAt));
    setTasks(Array.isArray(u.tasks) ? u.tasks : []);
    setLoaded(true);
  };

  // tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // save reminders whenever they change (per-account, after initial load)
  useEffect(() => {
    if (!loaded || isAlertWindow || !user) return;
    api.save(user.username, { reminders });
  }, [reminders, loaded]);

  // iOS: (re)schedule OS local notifications whenever the reminder list changes.
  // No-op on desktop, so the Electron alert path is untouched.
  useEffect(() => {
    if (isAlertWindow || !isNative) return;
    syncReminderNotifications(reminders, {
      sound: settings.notifSound,
      vibrate: settings.vibrate,
      strongAlert: settings.strongAlert,
    });
  }, [reminders, settings.notifSound, settings.vibrate, settings.strongAlert]);

  // save settings whenever they change (per-account, after initial load)
  useEffect(() => {
    if (!loaded || isAlertWindow || !user) return;
    api.save(user.username, { settings });
  }, [settings, loaded]);

  // save tasks + (re)register their global keybinds whenever they change
  useEffect(() => {
    if (!loaded || isAlertWindow || !user) return;
    api.save(user.username, { tasks });
    api.syncMacros(tasks);
  }, [tasks, loaded]);

  // reflect which macros are actually running + surface engine errors
  useEffect(() => {
    if (isAlertWindow || !ipc) return;
    const offStatus = ipc.on('macro-status', (ids: string[]) => setRunningIds(ids || []));
    const offError = ipc.on('macro-error', (_id: string, message: string) => setMacroError(message));
    const offStats = ipc.on('macro-stats', (arr: any[]) => {
      const map: Record<string, { count: number; startedAt: number }> = {};
      (arr || []).forEach(s => { map[s.id] = { count: s.count, startedAt: s.startedAt }; });
      setMacroStats(map);
    });
    return () => { offStatus?.(); offError?.(); offStats?.(); };
  }, []);

  // push the panic-stop hotkey to the engine whenever it changes
  useEffect(() => {
    if (isAlertWindow || !user) return;
    api.setPanic(settings.panicHotkey || '');
  }, [settings.panicHotkey, user]);

  // ambient music: play the mode-appropriate track (zen / season / default) when enabled
  const musicTrack = settings.zenMode ? 'zen' : settings.autoSeasonal ? seasonOf(new Date()).label.toLowerCase() : 'default';
  useEffect(() => {
    if (isAlertWindow) return;
    const a = musicRef.current;
    if (!a) return;
    if (settings.music) {
      const src = `music/${musicTrack}.wav`;
      if (!a.src.endsWith(src)) a.src = src;
      a.volume = 0.5;
      a.loop = true;
      a.play().catch(() => { /* needs a user gesture; the music button handles that */ });
    } else {
      a.pause();
    }
  }, [settings.music, musicTrack]);

  // ask for notification permission once
  useEffect(() => {
    if (isAlertWindow) return;
    if (isNative) { requestReminderPermission(); return; } // iOS: Capacitor LocalNotifications permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // fire reminders when due (main window only)
  useEffect(() => {
    if (isAlertWindow) return;
    if (isNative) return; // on iOS reminders fire via scheduled local notifications, not the polling/floating-window path
    if (activeAlert) return;
    const due = reminders.find(r => !r.dismissed && r.triggerAt <= now);
    if (due) {
      setActiveAlert(due);
      playChime();
      showNotification(due);
      ipc?.send('show-alert', due);
    }
  }, [now, reminders, activeAlert]);

  // listen for actions sent back from the alert window
  useEffect(() => {
    if (isAlertWindow) return;
    if (!ipc) return;
    const off = ipc.on('alert-action', (action: 'dismiss' | 'snooze', reminderId: number) => {
      if (action === 'dismiss') {
        setReminders(rs => rs.map(r => r.id === reminderId
          ? (isRecurring(r) ? { ...r, triggerAt: nextReminderTrigger(r.triggerAt, r.repeat, Date.now()) } : { ...r, dismissed: true })
          : r));
      } else if (action === 'snooze') {
        const newTrigger = Date.now() + 5 * 60 * 1000;
        setReminders(rs => rs.map(r => r.id === reminderId ? { ...r, triggerAt: newTrigger, dismissed: false } : r));
      }
      setActiveAlert(null);
    });
    return () => { off?.(); };
  }, []);

  // ============ SOUND ============
  const playChime = () => {
    if (!settings.soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const t0 = ctx.currentTime;
      const notes = [659.25, 783.99, 987.77, 1318.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = t0 + i * 0.16;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 1.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.4);
      });
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 2200);
    } catch (e) { /* audio blocked */ }
  };

  // ============ NOTIFICATIONS ============
  const showNotification = (reminder: any) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(reminder.title, {
        body: reminder.description || 'Reminder',
        silent: !settings.soundEnabled,
      });
    }
  };

  // ============ ACTIONS ============
  const resetForm = () => {
    setTitle(''); setDescription(''); setImageUrl(''); setDate(''); setTime(''); setRepeat('none');
  };

  const openForm = () => {
    resetForm();
    const d = new Date(Date.now() + 60_000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`);
    setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    setShowForm(true);
  };

  const saveReminder = () => {
    if (!title.trim() || !date || !time) return;
    const triggerAt = new Date(`${date}T${time}:00`).getTime();
    const newR = {
      id: Date.now() + Math.random(),
      title: title.trim(),
      description: description.trim(),
      imageUrl,
      triggerAt,
      dismissed: false,
      repeat,
    };
    setReminders(rs => [...rs, newR].sort((a, b) => a.triggerAt - b.triggerAt));
    setShowForm(false);
    resetForm();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const dismiss = () => {
    if (isAlertWindow) {
      ipc?.send('alert-action', 'dismiss', alertData.id);
    } else if (activeAlert) {
      setReminders(rs => rs.map(r => r.id === activeAlert.id
        ? (isRecurring(r) ? { ...r, triggerAt: nextReminderTrigger(r.triggerAt, r.repeat, Date.now()) } : { ...r, dismissed: true })
        : r));
      setActiveAlert(null);
    }
  };

  const snooze = () => {
    if (isAlertWindow) {
      ipc?.send('alert-action', 'snooze', alertData.id);
    } else if (activeAlert) {
      const id = activeAlert.id;
      const newTrigger = Date.now() + 5 * 60 * 1000;
      setReminders(rs => rs.map(r => r.id === id ? { ...r, triggerAt: newTrigger, dismissed: false } : r));
      setActiveAlert(null);
    }
  };

  const deleteReminder = (id: number) => {
    setReminders(rs => rs.filter(r => r.id !== id));
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setReminders([]);
    setTasks([]);
    setSettings(DEFAULT_SETTINGS);
    setLoaded(false);
    setShowSettings(false);
  };

  // ============ TASK / MACRO ACTIONS ============
  const openNewTask = () => { setEditingTask(null); setShowTaskModal(true); };
  const editTask = (t: Macro) => { setEditingTask(t); setShowTaskModal(true); };

  const saveTask = (t: Macro) => {
    setTasks(ts => {
      const exists = ts.some(x => x.id === t.id);
      return exists ? ts.map(x => (x.id === t.id ? t : x)) : [...ts, t];
    });
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const deleteTask = (id: string) => {
    api.stopMacro(id);
    setTasks(ts => ts.filter(t => t.id !== id));
  };

  const toggleTask = async (t: Macro) => {
    setMacroError('');
    if (runningIds.includes(t.id)) {
      await api.stopMacro(t.id);
    } else {
      const res: any = await api.runMacro(t);
      if (res && res.ok === false) setMacroError(res.error || 'Could not start that macro.');
    }
  };

  // ============ FORMATTERS ============
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

  const fmtCountdown = (ts: number) => {
    const ms = ts - now;
    if (ms <= 0) return 'now';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `in ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `in ${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    if (h < 24) return `in ${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    return `in ${d}d ${h % 24}h`;
  };

  const upcoming = reminders.filter(r => !r.dismissed).sort((a, b) => a.triggerAt - b.triggerAt);
  const ukNow = fmtTime(now);
  const themeClass = `theme-${settings.theme}`;
  const packFiles = (SOUND_PACKS[settings.soundPack] || SOUND_PACKS.all).files;
  const visibleSounds = NOTIF_SOUNDS.filter(s => packFiles.includes(s.file));

  // ============ SHARED STYLES ============
  const styleBlock = (
    <style>{`
      :root {
        --cream: #F5EFE6;
        --cream-dark: #E5D9C5;
        --ink: #1F2421;
        --ink-muted: #6B6862;
        --terra: #C8553D;
        --terra-dark: #A03E2D;
        --terra-light: #F5DDD2;
        --card: #FFFFFF;
        --page-top: #F5EFE6;
        --page-bottom: #ECDFCC;
      }
      .theme-dark {
        --cream: #20241F;
        --cream-dark: #333831;
        --ink: #F1EBDF;
        --ink-muted: #A29D93;
        --terra: #E0715A;
        --terra-dark: #C8553D;
        --terra-light: #3B2A24;
        --card: #2A2E28;
        --page-top: #1B1E1A;
        --page-bottom: #23271F;
      }
      .bg-cream { background-color: var(--cream); }
      .bg-cream-dark { background-color: var(--cream-dark); }
      .bg-card { background-color: var(--card); }
      .bg-terra { background-color: var(--terra); }
      .bg-terra-dark { background-color: var(--terra-dark); }
      .bg-terra-light { background-color: var(--terra-light); }
      .bg-ink { background-color: var(--ink); }
      .text-ink { color: var(--ink); }
      .text-ink-muted { color: var(--ink-muted); }
      .text-terra { color: var(--terra); }
      .text-terra-dark { color: var(--terra-dark); }
      .text-cream { color: var(--cream); }
      .border-cream-dark { border-color: var(--cream-dark); }
      .border-terra { border-color: var(--terra); }
      .focus\\:border-terra:focus { border-color: var(--terra); }
      .hover\\:bg-terra:hover { background-color: var(--terra); }
      .hover\\:bg-terra-dark:hover { background-color: var(--terra-dark); }
      .hover\\:text-terra:hover { color: var(--terra); }
      .hover\\:text-ink:hover { color: var(--ink); }
      .hover\\:border-terra:hover { border-color: var(--terra); }
      .group:hover .group-hover\\:text-terra { color: var(--terra); }

      .font-display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
      .font-body { font-family: 'Geist', system-ui, -apple-system, sans-serif; }

      @keyframes slide-down {
        from { opacity: 0; transform: translateY(-30px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes fade-up {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse-glow {
        0%, 100% { box-shadow: 0 25px 60px -10px rgba(200, 85, 61, 0.4), 0 10px 20px -5px rgba(200, 85, 61, 0.2); }
        50% { box-shadow: 0 30px 70px -10px rgba(200, 85, 61, 0.55), 0 15px 30px -5px rgba(200, 85, 61, 0.35); }
      }
      .animate-slide-down { animation: slide-down 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      .animate-fade-in { animation: fade-in 0.3s ease both; }
      .animate-fade-up { animation: fade-up 0.5s ease both; }
      .animate-pulse-glow { animation: pulse-glow 2.4s ease-in-out infinite; }

      body { margin: 0; }
      input[type="date"]::-webkit-calendar-picker-indicator,
      input[type="time"]::-webkit-calendar-picker-indicator {
        opacity: 0.5; cursor: pointer;
      }
      .theme-dark input[type="date"]::-webkit-calendar-picker-indicator,
      .theme-dark input[type="time"]::-webkit-calendar-picker-indicator {
        filter: invert(1); opacity: 0.6;
      }

      /* ===== Zen mode: calm sage accents, flat soft surfaces, gentle motion ===== */
      .zen { --terra: #8FA79A; --terra-dark: #748E80; --terra-light: #E1EBE5; --ink-muted: #869089; }
      .zen article, .zen .shadow-lg, .zen .shadow-sm, .zen .bg-card { box-shadow: none !important; }
      .zen .animate-fade-up, .zen .animate-slide-down { animation-duration: 1.3s !important; }
      .zen .animate-pulse-glow { animation: none !important; }
      .zen .border-cream-dark { border-color: rgba(140,150,140,0.18) !important; }
      .zen h1, .zen h2 { font-weight: 300 !important; }

      /* ===== Seasonal accent colours (stronger seasonal identity) ===== */
      .season-spring { --terra: #6FA36B; --terra-dark: #54894F; --terra-light: #E4F0DF; }
      .season-summer { --terra: #E0925A; --terra-dark: #C87840; --terra-light: #F6E6D2; }
      .season-autumn { --terra: #C8663D; --terra-dark: #A34E2C; --terra-light: #F3DDCE; }
      .season-winter { --terra: #5B84B0; --terra-dark: #456A93; --terra-light: #DDE6F0; }

      /* ===== Micro-animations: satisfying tap + pop feedback ===== */
      .micro-anim button { transition: transform 0.09s ease, background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease; }
      .micro-anim button:active { transform: scale(0.94); }
      @keyframes lull-pop { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
      .micro-anim .lull-pop { animation: lull-pop 0.35s ease; }

      /* ===== Seasonal floating decorations ===== */
      @keyframes lull-float { 0%, 100% { transform: translateY(0) rotate(-4deg); } 50% { transform: translateY(-14px) rotate(4deg); } }
      .lull-float { animation: lull-float 6s ease-in-out infinite; will-change: transform; }

      /* ===== Mobile layout only (desktop >600px untouched) ===== */
      @media (max-width: 600px) {
        /* honour iOS safe areas: keep content clear of the status bar, battery,
           Dynamic Island (top) and the home indicator (bottom) */
        .lull-page {
          padding-top: calc(24px + env(safe-area-inset-top)) !important;
          padding-bottom: calc(24px + env(safe-area-inset-bottom)) !important;
          padding-left: calc(18px + env(safe-area-inset-left)) !important;
          padding-right: calc(18px + env(safe-area-inset-right)) !important;
        }
        .lull-header { flex-direction: column !important; gap: 16px; margin-bottom: 32px !important; }
        .lull-header-right { width: 100%; justify-content: space-between; }
        .lull-actions { flex-direction: column !important; align-items: stretch !important; margin-bottom: 32px !important; }
        .lull-actions > button { width: 100%; justify-content: center; padding: 16px 20px !important; }
        .lull-modal-overlay { padding: calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom)) 12px !important; }
        .lull-modal { padding: 22px !important; border-radius: 24px; max-height: 94vh; }
        .lull-form-2col { grid-template-columns: 1fr !important; }
        .lull-iconbtn { padding: 11px !important; }
        .lull-page, .lull-modal { overflow-wrap: anywhere; }
      }
    `}</style>
  );

  // ============ ALERT WINDOW MODE ============
  if (isAlertWindow) {
    return (
      <>
        {styleBlock}
        {alertData && (
          <div className={`${themeClass} font-body min-h-screen p-4 flex items-start justify-center`} style={{ background: 'transparent' }}>
            <div
              className="bg-cream rounded-3xl w-full max-w-lg p-7 sm:p-8 animate-slide-down animate-pulse-glow border-2 border-terra"
              style={{ WebkitAppRegion: 'drag' } as any}
            >
              <div className="flex items-center gap-3 mb-5" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="bg-terra text-cream rounded-full w-10 h-10 flex items-center justify-center">
                  <AlarmClock size={18} strokeWidth={2}/>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-terra font-medium">Reminder</p>
                  <p className="text-xs text-ink-muted">{fmtTime(alertData.triggerAt)} · {fmtDate(alertData.triggerAt)}</p>
                </div>
              </div>
              {alertData.imageUrl && (
                <div className="rounded-2xl overflow-hidden aspect-[16/9] mb-5 bg-cream-dark">
                  <img src={alertData.imageUrl} alt="" className="w-full h-full object-cover"/>
                </div>
              )}
              <h3 className="font-display text-3xl sm:text-4xl text-ink leading-tight mb-3 font-medium">{alertData.title}</h3>
              {alertData.description && (
                <p className="text-ink-muted leading-relaxed mb-7 text-base">{alertData.description}</p>
              )}
              <div className="flex gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button onClick={snooze} className="flex-1 py-4 px-5 rounded-full border-2 border-cream-dark text-ink hover:border-terra transition-all font-medium flex items-center justify-center gap-2">
                  <Clock size={16} strokeWidth={2}/>
                  Wait 5 minutes
                </button>
                <button onClick={dismiss} className="flex-1 py-4 px-5 rounded-full bg-ink text-cream hover:bg-terra transition-colors font-medium">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ============ AUTH LOADING ============
  if (!authChecked) {
    return (
      <>
        {styleBlock}
        <div className="theme-light min-h-screen font-body flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #F5EFE6 0%, #ECDFCC 100%)' }}>
          <div className="text-ink-muted font-display text-2xl italic animate-fade-in">Lull<span className="text-terra">.</span></div>
        </div>
      </>
    );
  }

  // ============ LOGIN / SIGNUP SCREEN ============
  if (!user) {
    return (
      <>
        {styleBlock}
        <AuthScreen onAuthed={applyUser} />
      </>
    );
  }

  // ============ MAIN WINDOW MODE ============
  return (
    <>
      {styleBlock}
      <div className={`${themeClass} min-h-screen font-body text-ink relative ${settings.zenMode ? 'zen' : (settings.autoSeasonal ? `season-${seasonOf(new Date(now)).label.toLowerCase()}` : '')} ${settings.microAnimations !== false ? 'micro-anim' : ''}`} style={{ background: resolveBackground(settings, now) }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(200,85,61,0.12), transparent 70%)' }}/>

        {settings.pattern && settings.pattern !== 'none' && (
          <div className="pointer-events-none fixed inset-0" style={{ zIndex: 0, ...patternStyle(settings) }} aria-hidden="true"/>
        )}

        {settings.autoSeasonal && !settings.zenMode && (() => {
          const set = DECOR_SETS[decorThemeOf(new Date(now))] || [];
          return set.length ? (
            <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }} aria-hidden="true">
              {DECOR_SLOTS.map((slot, i) => (
                <span key={i} style={{ position: 'absolute', ...slot.pos }}>
                  <DecorIcon motif={set[i % set.length]} size={slot.size} delay={slot.delay} />
                </span>
              ))}
            </div>
          ) : null;
        })()}

        <audio ref={musicRef} loop preload="none" />
        <button
          onClick={() => {
            const on = !settings.music;
            setSettings(s => ({ ...s, music: on }));
            const a = musicRef.current;
            if (a) {
              if (on) { a.src = `music/${musicTrack}.wav`; a.volume = 0.5; a.loop = true; a.play().catch(() => {}); }
              else { a.pause(); }
            }
          }}
          className="fixed bottom-5 right-5 z-30 w-12 h-12 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink-muted hover:text-terra transition-colors"
          style={{ marginBottom: 'env(safe-area-inset-bottom)', marginRight: 'env(safe-area-inset-right)' }}
          aria-label="Toggle ambient music"
          title="Ambient music"
        >
          {settings.music ? <Pause size={18} strokeWidth={2}/> : <Music size={18} strokeWidth={2}/>}
        </button>

        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14 relative lull-page">
          <header className="flex items-start justify-between mb-12 sm:mb-16 animate-fade-up lull-header">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">
                {greetingText(settings, now)}
              </p>
              <h1 className="font-display text-5xl sm:text-7xl font-light text-ink leading-none">
                Lull<span className="text-terra italic font-normal">.</span>
              </h1>
            </div>
            <div className="flex items-center gap-3 lull-header-right">
              <div className="bg-card rounded-full px-5 py-3 border border-cream-dark flex items-center gap-3 shadow-sm">
                <Clock size={16} className="text-terra" strokeWidth={1.8}/>
                <div className="text-right">
                  <div className="font-display text-lg leading-none font-medium">{ukNow}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted mt-0.5">UK time</div>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="bg-card rounded-full w-12 h-12 border border-cream-dark flex items-center justify-center shadow-sm text-ink-muted hover:text-terra hover:border-terra transition-colors"
                aria-label="Account settings"
                title="Account & settings"
              >
                <Settings size={18} strokeWidth={1.8}/>
              </button>
            </div>
          </header>

          <div className="mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="font-display text-2xl sm:text-3xl text-ink-muted italic font-light">
              What do you want to remember?
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-12 sm:mb-16 animate-fade-up lull-actions" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={openForm}
              className="bg-ink text-cream rounded-full px-7 py-4 inline-flex items-center gap-3 font-medium hover:bg-terra transition-colors duration-300 group shadow-lg"
            >
              <span className="bg-cream text-ink rounded-full w-7 h-7 flex items-center justify-center transition-colors">
                <Plus size={16} strokeWidth={2.5}/>
              </span>
              New reminder
            </button>
            {!isNative && (
              <button
                onClick={openNewTask}
                className="bg-card text-ink rounded-full px-7 py-4 inline-flex items-center gap-3 font-medium border-2 border-cream-dark hover:border-terra hover:text-terra transition-colors duration-300 group shadow-sm"
              >
                <span className="bg-terra text-cream rounded-full w-7 h-7 flex items-center justify-center transition-colors">
                  <Zap size={15} strokeWidth={2.5}/>
                </span>
                New task
              </button>
            )}
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-card border-2 border-dashed border-cream-dark rounded-3xl py-20 px-6 text-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Bell size={32} className="text-terra mx-auto mb-4" strokeWidth={1.4}/>
              <p className="font-display text-2xl italic text-ink-muted">Nothing on your mind yet</p>
              <p className="text-sm text-ink-muted mt-2">Tap "new reminder" to add one</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((r, i) => (
                <article
                  key={r.id}
                  className="bg-card rounded-3xl p-6 border border-cream-dark hover:shadow-xl transition-all duration-500 animate-fade-up flex flex-col"
                  style={{ animationDelay: `${0.3 + Math.min(i, 6) * 0.05}s`, boxShadow: '0 4px 20px -8px rgba(31, 36, 33, 0.1)' }}
                >
                  {!isNative && r.imageUrl && (
                    <div className="rounded-2xl overflow-hidden mb-5 aspect-[4/3] bg-cream-dark">
                      <img src={r.imageUrl} alt="" className="w-full h-full object-cover"/>
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="font-display text-2xl text-ink leading-tight mb-2 font-medium">{r.title}</h3>
                    {r.description && (
                      <p className="text-ink-muted text-sm leading-relaxed mb-4">{r.description}</p>
                    )}
                  </div>

                  <div className="flex items-end justify-between mt-4 pt-4 border-t border-cream-dark">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">When</div>
                      <div className="font-display text-base font-medium">{fmtTime(r.triggerAt)}</div>
                      <div className="text-xs text-ink-muted">{fmtDate(r.triggerAt)}</div>
                    </div>
                    <div className="text-right">
                      {isRecurring(r) && (
                        <div className="bg-cream-dark text-ink-muted text-[10px] font-medium px-2.5 py-1 rounded-full inline-block mb-2 ml-1 uppercase tracking-wider">
                          {repeatLabel(r.repeat)}
                        </div>
                      )}
                      <div className="bg-terra-light text-terra-dark text-xs font-medium px-3 py-1.5 rounded-full inline-block mb-2">
                        {fmtCountdown(r.triggerAt)}
                      </div>
                      <button
                        onClick={() => deleteReminder(r.id)}
                        className="block ml-auto text-ink-muted hover:text-terra transition-colors p-1"
                        aria-label="Delete reminder"
                      >
                        <Trash2 size={14} strokeWidth={1.8}/>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!isNative && tasks.length > 0 && (
            <div className="mt-16 animate-fade-up">
              <div className="flex items-center gap-3 mb-6">
                <Zap className="text-terra" size={22} strokeWidth={1.8}/>
                <h2 className="font-display text-2xl sm:text-3xl text-ink font-light">Automations</h2>
              </div>

              {macroError && (
                <div className="mb-5 flex items-start gap-3 bg-terra-light border border-terra rounded-2xl px-4 py-3">
                  <AlertTriangle size={18} className="text-terra-dark mt-0.5 shrink-0" strokeWidth={2}/>
                  <p className="text-sm text-terra-dark flex-1">{macroError}</p>
                  <button onClick={() => setMacroError('')} className="text-terra-dark hover:text-ink transition-colors"><X size={16}/></button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.map(t => {
                  const Icon = iconForType(t.type);
                  const isRunning = runningIds.includes(t.id);
                  const st = macroStats[t.id];
                  return (
                    <article key={t.id} className="bg-card rounded-3xl p-6 border border-cream-dark flex flex-col" style={{ boxShadow: '0 4px 20px -8px rgba(31, 36, 33, 0.1)' }}>
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`rounded-full w-11 h-11 flex items-center justify-center shrink-0 transition-colors ${isRunning ? 'bg-terra text-cream' : 'bg-terra-light text-terra'}`}>
                          <Icon size={18} strokeWidth={1.9}/>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display text-xl text-ink font-medium leading-tight truncate">{t.name}</h3>
                          <p className="text-xs text-ink-muted mt-1 leading-relaxed">{taskSummary(t)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mb-5">
                        {isRunning ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-terra">
                            <span className="w-2 h-2 rounded-full bg-terra animate-pulse"/>
                            {st ? `${st.count} ${statLabel(t.type)} · ${fmtElapsed(now - st.startedAt)}` : 'Running'}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">Idle</span>
                        )}
                        {t.keybind && (
                          <span className="ml-auto text-[10px] uppercase tracking-wider bg-cream-dark text-ink-muted px-2.5 py-1 rounded-full">{t.keybind}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-cream-dark">
                        <button
                          onClick={() => toggleTask(t)}
                          className={`flex-1 py-2.5 rounded-full font-medium text-sm inline-flex items-center justify-center gap-2 transition-colors ${isRunning ? 'bg-ink text-cream hover:bg-terra' : 'bg-terra text-cream hover:bg-terra-dark'}`}
                        >
                          {isRunning ? <><Square size={14} strokeWidth={2.4}/> Stop</> : <><Play size={14} strokeWidth={2.4}/> Start</>}
                        </button>
                        <button onClick={() => editTask(t)} className="p-2.5 rounded-full border border-cream-dark text-ink-muted hover:text-terra hover:border-terra transition-colors lull-iconbtn" aria-label="Edit task">
                          <Pencil size={14} strokeWidth={1.9}/>
                        </button>
                        <button onClick={() => deleteTask(t.id)} className="p-2.5 rounded-full border border-cream-dark text-ink-muted hover:text-terra hover:border-terra transition-colors lull-iconbtn" aria-label="Delete task">
                          <Trash2 size={14} strokeWidth={1.9}/>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-ink-muted mt-16 animate-fade-up" style={{ animationDelay: '0.5s' }}>
            Signed in as {user.username} · Reminders persist across restarts and float above any window.
          </p>
        </div>

        {/* ============ FORM MODAL ============ */}
        {showForm && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in lull-modal-overlay" style={{ background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark lull-modal" style={{ boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)' }}>
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">Compose</p>
                  <h2 className="font-display text-4xl font-light text-ink">New <span className="italic text-terra">reminder</span></h2>
                </div>
                <button onClick={() => setShowForm(false)} className="text-ink-muted hover:text-ink transition-colors p-2">
                  <X size={22}/>
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Take the bins out"
                    className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors font-display text-lg"
                  />
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Optional details..."
                    rows={3}
                    className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 lull-form-2col">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full bg-card border border-cream-dark rounded-2xl px-4 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Time</label>
                    <input
                      type="time"
                      value={time}
                      onChange={e => setTime(e.target.value)}
                      className="w-full bg-card border border-cream-dark rounded-2xl px-4 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Repeat</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[['none', 'Once'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekly', 'Weekly']].map(([v, l]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRepeat(v)}
                        className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${repeat === v ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {!isNative && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Image (optional)</label>
                  {imageUrl ? (
                    <div className="relative rounded-2xl overflow-hidden aspect-[4/3] bg-cream-dark">
                      <img src={imageUrl} alt="" className="w-full h-full object-cover"/>
                      <button
                        onClick={() => setImageUrl('')}
                        className="absolute top-3 right-3 bg-ink text-cream rounded-full w-8 h-8 flex items-center justify-center hover:bg-terra transition-colors"
                      >
                        <X size={14}/>
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-card border-2 border-dashed border-cream-dark rounded-2xl py-8 hover:border-terra transition-all group"
                      >
                        <ImageIcon size={22} className="mx-auto text-ink-muted group-hover:text-terra mb-2 transition-colors" strokeWidth={1.5}/>
                        <span className="text-sm text-ink-muted">Click to upload an image</span>
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden"/>
                    </>
                  )}
                </div>
                )}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-3.5 px-6 rounded-full border border-cream-dark text-ink hover:bg-card transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={saveReminder}
                  disabled={!title.trim() || !date || !time}
                  className="flex-1 py-3.5 px-6 rounded-full bg-terra text-cream hover:bg-terra-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Save reminder
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ SETTINGS MODAL ============ */}
        {showSettings && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in lull-modal-overlay" style={{ background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark lull-modal" style={{ boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)' }}>
              <div className="flex items-start justify-between mb-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">Account</p>
                  <h2 className="font-display text-4xl font-light text-ink">Your <span className="italic text-terra">settings</span></h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-ink-muted hover:text-ink transition-colors p-2">
                  <X size={22}/>
                </button>
              </div>

              <div className="space-y-7">
                {/* Account identity */}
                <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-cream-dark">
                  <div className="bg-terra text-cream rounded-full w-12 h-12 flex items-center justify-center shrink-0">
                    <User size={20} strokeWidth={1.8}/>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-lg text-ink font-medium truncate">{user.username}</div>
                    <div className="text-xs text-ink-muted">Signed in</div>
                  </div>
                </div>

                {/* Display name */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Display name</label>
                  <input
                    type="text"
                    value={settings.displayName}
                    onChange={e => setSettings(s => ({ ...s, displayName: e.target.value }))}
                    placeholder="What should we call you?"
                    className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors font-display text-lg"
                  />
                </div>

                {/* Theme */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Appearance</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSettings(s => ({ ...s, theme: 'light' }))}
                      className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-medium transition-all ${settings.theme === 'light' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}
                    >
                      <Sun size={16} strokeWidth={2}/> Light
                    </button>
                    <button
                      onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))}
                      className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-medium transition-all ${settings.theme === 'dark' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}
                    >
                      <Moon size={16} strokeWidth={2}/> Dark
                    </button>
                  </div>
                </div>

                {/* Sound */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Sound</label>
                  <button
                    onClick={() => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))}
                    className="w-full flex items-center justify-between bg-card border border-cream-dark rounded-2xl px-5 py-4 hover:border-terra transition-colors"
                  >
                    <span className="flex items-center gap-3 text-ink">
                      {settings.soundEnabled ? <Volume2 size={18} className="text-terra" strokeWidth={1.8}/> : <VolumeX size={18} className="text-ink-muted" strokeWidth={1.8}/>}
                      {settings.soundEnabled ? 'Chime & notification sound on' : 'Sound off'}
                    </span>
                    <span className={`relative w-12 h-7 rounded-full transition-colors ${settings.soundEnabled ? 'bg-terra' : 'bg-cream-dark'}`}>
                      <span className={`absolute top-1 w-5 h-5 rounded-full bg-cream transition-all ${settings.soundEnabled ? 'left-6' : 'left-1'}`}/>
                    </span>
                  </button>
                </div>

                {/* Background gradients */}
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Background</label>
                  <div className="grid grid-cols-5 gap-2">
                    {BACKGROUND_KEYS.map(k => {
                      const bg = BACKGROUNDS[k];
                      const g = bg ? bg[settings.theme === 'dark' ? 'dark' : 'light'] : 'linear-gradient(180deg, var(--page-top), var(--page-bottom))';
                      const active = !settings.zenMode && !settings.autoSeasonal && (settings.background || 'default') === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setSettings(s => ({ ...s, background: k, autoSeasonal: false, zenMode: false }))}
                          className={`h-12 rounded-2xl border-2 transition-all ${active ? 'border-terra' : 'border-cream-dark'}`}
                          style={{ background: g }}
                          aria-label={k}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Pattern</label>
                  <Segmented
                    value={settings.pattern || 'none'}
                    onChange={v => setSettings(s => ({ ...s, pattern: v }))}
                    options={[{ value: 'none', label: 'None' }, { value: 'dots', label: 'Dots' }, { value: 'grid', label: 'Grid' }, { value: 'diagonal', label: 'Lines' }, { value: 'cross', label: 'Cross' }]}
                  />
                </div>

                <div className="flex"><ToggleRow label={`Seasonal theme (${seasonOf(new Date()).label})`} value={!!settings.autoSeasonal} onChange={v => setSettings(s => ({ ...s, autoSeasonal: v, zenMode: v ? false : s.zenMode }))} /></div>
                <div className="flex"><ToggleRow label="Zen mode (calm & minimal)" value={!!settings.zenMode} onChange={v => setSettings(s => ({ ...s, zenMode: v }))} /></div>
                <div className="flex"><ToggleRow label="Micro-animations" value={settings.microAnimations !== false} onChange={v => setSettings(s => ({ ...s, microAnimations: v }))} /></div>
                <div className="flex"><ToggleRow label="Ambient music (relaxing)" value={!!settings.music} onChange={v => setSettings(s => ({ ...s, music: v }))} /></div>

                {/* App icon (iOS) */}
                {isNative && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">App icon</label>
                    <div className="grid grid-cols-4 gap-3">
                      {APP_ICONS.map(ic => (
                        <button
                          key={ic.key}
                          type="button"
                          onClick={() => { setSettings(s => ({ ...s, appIcon: ic.key })); applyAppIcon(ic.key); }}
                          className={`rounded-2xl border-2 p-1.5 transition-all ${settings.appIcon === ic.key ? 'border-terra' : 'border-cream-dark'}`}
                        >
                          <img src={ic.preview} alt={ic.label} className="w-full aspect-square rounded-xl bg-cream-dark object-cover"/>
                          <div className="text-[10px] text-center text-ink-muted mt-1">{ic.label}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-muted mt-2">Home-screen icon changes apply on a device build once the alternate-icon plugin is added.</p>
                  </div>
                )}

                {/* Notification sound + vibration (iOS only) */}
                {isNative && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Notification sound</label>
                      <div className="mb-3">
                        <Segmented
                          value={settings.soundPack}
                          onChange={v => setSettings(st => { const files = (SOUND_PACKS[v] || SOUND_PACKS.all).files; return { ...st, soundPack: v, notifSound: files.includes(st.notifSound) ? st.notifSound : files[0] }; })}
                          options={SOUND_PACK_KEYS.map(k => ({ value: k, label: SOUND_PACKS[k].label }))}
                        />
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {visibleSounds.map(s => (
                          <div
                            key={s.file}
                            className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition-colors ${settings.notifSound === s.file ? 'border-terra bg-terra-light' : 'border-cream-dark'}`}
                          >
                            <button
                              onClick={() => playPreview(s.file)}
                              className="w-9 h-9 rounded-full bg-card border border-cream-dark flex items-center justify-center text-terra shrink-0 hover:border-terra transition-colors"
                              aria-label={`Preview ${s.label}`}
                            >
                              <Play size={14} strokeWidth={2.4}/>
                            </button>
                            <button
                              onClick={() => setSettings(st => ({ ...st, notifSound: s.file }))}
                              className="flex-1 text-left text-ink font-medium text-sm"
                            >
                              {s.label}
                            </button>
                            {settings.notifSound === s.file && (
                              <span className="text-[10px] uppercase tracking-wider text-terra font-medium">Selected</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-ink-muted mt-2">Plays when a reminder fires. Tap ▶ to preview.</p>
                    </div>

                    <div className="flex">
                      <ToggleRow label="Vibrate on reminders" value={settings.vibrate !== false} onChange={v => setSettings(st => ({ ...st, vibrate: v }))} />
                    </div>
                    <div className="flex">
                      <ToggleRow label="Strong alert (repeat buzzes)" value={!!settings.strongAlert} onChange={v => setSettings(st => ({ ...st, strongAlert: v }))} />
                    </div>
                    <p className="text-xs text-ink-muted -mt-1">
                      Vibration off shows a silent banner (iOS ties the buzz to the sound). Strong alert fires a few notifications a second apart.
                    </p>
                  </div>
                )}

                {/* Panic stop (desktop only — tasks don't exist on iOS) */}
                {!isNative && (
                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Panic-stop hotkey</label>
                  <input
                    value={settings.panicHotkey}
                    onChange={e => setSettings(s => ({ ...s, panicHotkey: e.target.value }))}
                    placeholder="e.g. Ctrl+Shift+X"
                    className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors"
                  />
                  <p className="text-xs text-ink-muted mt-2">Press this anywhere to instantly stop every running task.</p>
                  <button
                    onClick={() => api.stopAll()}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-full bg-ink text-cream hover:bg-terra transition-colors font-medium text-sm"
                  >
                    <Square size={14} strokeWidth={2.4}/> Stop all tasks now
                  </button>
                </div>
                )}

                {/* Logout */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border border-cream-dark text-ink hover:border-terra hover:text-terra transition-colors font-medium mt-2"
                >
                  <LogOut size={16} strokeWidth={2}/> Log out
                </button>
              </div>

              <p className="text-center text-xs text-ink-muted mt-6">Changes save automatically.</p>
            </div>
          </div>
        )}

        {/* ============ TASK / MACRO MODAL ============ */}
        {showTaskModal && (
          <TaskModal
            initial={editingTask}
            onCancel={() => { setShowTaskModal(false); setEditingTask(null); }}
            onSave={saveTask}
          />
        )}
      </div>
    </>
  );
}

// ============ AUTH SCREEN COMPONENT ============
function AuthScreen({ onAuthed }: { onAuthed: (u: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('Please enter a username and password.');
      return;
    }
    setBusy(true);
    try {
      const res = mode === 'signup'
        ? await api.signup(username, password)
        : await api.login(username, password);
      if (res?.ok && res.user) {
        onAuthed(res.user);
      } else {
        setError(res?.error || 'Something went wrong.');
      }
    } catch (e: any) {
      setError('Unexpected error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  return (
    <div className="theme-light min-h-screen font-body text-ink flex items-center justify-center p-6" style={{ background: 'linear-gradient(180deg, #F5EFE6 0%, #ECDFCC 100%)' }}>
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(200,85,61,0.12), transparent 70%)' }}/>
      <div className="w-full max-w-md relative animate-fade-up">
        <div className="text-center mb-8">
          <h1 className="font-display text-6xl font-light text-ink leading-none mb-3">
            Lull<span className="text-terra italic font-normal">.</span>
          </h1>
          <p className="font-display text-xl italic text-ink-muted font-light">
            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
          </p>
        </div>

        <div className="bg-card rounded-3xl p-8 border border-cream-dark" style={{ boxShadow: '0 20px 60px -20px rgba(31, 36, 33, 0.25)' }}>
          <div className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyDown={onKey}
                autoFocus
                placeholder="your name"
                className="w-full bg-cream border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors font-display text-lg"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="••••••••"
                  className="w-full bg-cream border border-cream-dark rounded-2xl px-5 py-3.5 pr-14 text-ink focus:outline-none focus:border-terra transition-colors font-display text-lg"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-terra transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={20} strokeWidth={1.8}/> : <Eye size={20} strokeWidth={1.8}/>}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-terra-dark bg-terra-light rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full py-4 px-6 rounded-full bg-terra text-cream hover:bg-terra-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
            >
              {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
            </button>
          </div>

          <div className="text-center mt-6 text-sm text-ink-muted">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); }}
              className="text-terra hover:text-terra-dark font-medium transition-colors"
            >
              {mode === 'signup' ? 'Log in' : 'Sign up'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted mt-6">
          Your account and reminders are stored privately on this computer.
        </p>
      </div>
    </div>
  );
}

// ============ TASK MODAL HELPERS ============
const numVal = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clampVal = (v: string, lo: number, hi: number) => Math.max(lo, Math.min(hi, numVal(v)));
const inputCls = 'w-full bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-terra transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">{label}</label>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`py-3 rounded-2xl border-2 font-medium text-sm transition-all ${value === o.value ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex-1 flex items-center justify-between bg-card border border-cream-dark rounded-2xl px-4 py-3 hover:border-terra transition-colors"
    >
      <span className="text-sm text-ink text-left">{label}</span>
      <span className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${value ? 'bg-terra' : 'bg-cream-dark'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-cream transition-all ${value ? 'left-6' : 'left-1'}`}/>
      </span>
    </button>
  );
}

// ============ TASK / MACRO MODAL ============
function TaskModal({ initial, onCancel, onSave }: { initial: Macro | null; onCancel: () => void; onSave: (m: Macro) => void }) {
  const [draft, setDraft] = useState<Macro | null>(initial);

  const setConfig = (patch: any) => setDraft(d => (d ? { ...d, config: { ...d.config, ...patch } } : d));

  const overlay = 'fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in lull-modal-overlay';
  const overlayStyle = { background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' } as any;
  const panel = 'bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark lull-modal';
  const panelStyle = { boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)' } as any;

  // ----- Step 1: preset picker -----
  if (!draft) {
    return (
      <div className={overlay} style={overlayStyle}>
        <div className={panel} style={panelStyle}>
          <div className="flex items-start justify-between mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">New task</p>
              <h2 className="font-display text-4xl font-light text-ink">Pick a <span className="italic text-terra">preset</span></h2>
            </div>
            <button onClick={onCancel} className="text-ink-muted hover:text-ink transition-colors p-2"><X size={22}/></button>
          </div>
          <div className="space-y-3">
            {PRESETS.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.type}
                  onClick={() => setDraft(newMacro(p.type))}
                  className="w-full text-left flex items-start gap-4 bg-card border border-cream-dark rounded-2xl p-4 hover:border-terra transition-colors group"
                >
                  <div className="bg-terra-light text-terra rounded-full w-11 h-11 flex items-center justify-center shrink-0 group-hover:bg-terra group-hover:text-cream transition-colors">
                    <Icon size={19} strokeWidth={1.9}/>
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-lg text-ink font-medium leading-tight">{p.name}</div>
                    <div className="text-xs text-ink-muted mt-1 leading-relaxed">{p.blurb}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ----- Step 2: config form -----
  const c = draft.config;
  const isNew = !initial;

  return (
    <div className={overlay} style={overlayStyle}>
      <div className={panel} style={panelStyle}>
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start gap-3">
            {isNew && (
              <button onClick={() => setDraft(null)} className="text-ink-muted hover:text-terra transition-colors mt-1" aria-label="Back to presets">
                <ChevronLeft size={22}/>
              </button>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">{isNew ? 'Configure' : 'Edit task'}</p>
              <h2 className="font-display text-3xl sm:text-4xl font-light text-ink">{(PRESETS.find(p => p.type === draft.type) || PRESETS[0]).name}</h2>
            </div>
          </div>
          <button onClick={onCancel} className="text-ink-muted hover:text-ink transition-colors p-2"><X size={22}/></button>
        </div>

        <div className="space-y-5">
          <Field label="Name">
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className={inputCls} />
          </Field>

          {draft.type === 'autoclicker' && (
            <>
              <Field label="Mouse button">
                <Segmented value={c.button} onChange={v => setConfig({ button: v })} options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }, { value: 'middle', label: 'Middle' }]} />
              </Field>
              <Field label="Mode">
                <Segmented value={c.mode} onChange={v => setConfig({ mode: v })} options={[{ value: 'rapid', label: 'Rapid click' }, { value: 'hold', label: 'Hold / release' }]} />
              </Field>
              {c.mode === 'rapid' ? (
                <Field label="Clicks per second">
                  <input type="number" min={1} max={200} value={c.cps} onChange={e => setConfig({ cps: clampVal(e.target.value, 1, 200) })} className={inputCls} />
                </Field>
              ) : (
                <div className="grid grid-cols-2 gap-4 lull-form-2col">
                  <Field label="Hold (seconds)">
                    <input type="number" min={0.05} step={0.05} value={c.holdSeconds} onChange={e => setConfig({ holdSeconds: numVal(e.target.value) })} className={inputCls} />
                  </Field>
                  <Field label="Release (seconds)">
                    <input type="number" min={0.05} step={0.05} value={c.releaseSeconds} onChange={e => setConfig({ releaseSeconds: numVal(e.target.value) })} className={inputCls} />
                  </Field>
                </div>
              )}
            </>
          )}

          {draft.type === 'browsersearch' && (
            <>
              <Field label="Browser">
                <Segmented value={c.browser} onChange={v => setConfig({ browser: v })} options={[{ value: 'chrome', label: 'Chrome' }, { value: 'msedge', label: 'Edge' }, { value: 'chromium', label: 'Chromium' }]} />
              </Field>
              <Field label="Search engine">
                <Segmented value={c.searchEngine} onChange={v => setConfig({ searchEngine: v })} options={[{ value: 'google', label: 'Google' }, { value: 'bing', label: 'Bing' }, { value: 'duckduckgo', label: 'DuckDuckGo' }]} />
              </Field>
              <Field label="Seconds between searches">
                <input type="number" min={0.5} step={0.5} value={c.delaySeconds} onChange={e => setConfig({ delaySeconds: numVal(e.target.value) })} className={inputCls} />
              </Field>
              <div className="flex">
                <ToggleRow label="Keep browser open when stopped" value={!!c.keepOpenOnStop} onChange={v => setConfig({ keepOpenOnStop: v })} />
              </div>
              <div className="flex">
                <ToggleRow label="Stay signed in (saved profile)" value={!!c.persistProfile} onChange={v => setConfig({ persistProfile: v })} />
              </div>
              {c.persistProfile && (
                <>
                  <div className="flex">
                    <ToggleRow label="Sign in first (opens login, then waits)" value={!!c.signInFirst} onChange={v => setConfig({ signInFirst: v })} />
                  </div>
                  {c.signInFirst && (
                    <Field label="Sign-in wait (seconds)">
                      <input type="number" min={5} max={600} value={c.signInGraceSeconds} onChange={e => setConfig({ signInGraceSeconds: clampVal(e.target.value, 5, 600) })} className={inputCls} />
                    </Field>
                  )}
                </>
              )}
              <p className="text-xs text-ink-muted leading-relaxed bg-card border border-cream-dark rounded-2xl px-4 py-3">
                Opens its own automated browser window (separate from your normal browsing) so it keeps searching even when minimized. Chrome and Edge use your installed browser; Chromium uses Playwright's bundled one. <span className="text-ink">"Stay signed in"</span> saves the session in a private profile so you can sign into a Microsoft account once — manually; Lull never stores your password. Heads up: automated Bing searches while signed in can violate Microsoft's terms and put the account at risk.
              </p>
            </>
          )}

          {draft.type === 'keypresser' && (
            <>
              <Field label="Key to press">
                <input value={c.key} onChange={e => setConfig({ key: e.target.value })} placeholder="Space, A, Enter, F5, Up..." className={inputCls} />
              </Field>
              <Field label="Interval (ms)">
                <input type="number" min={5} value={c.intervalMs} onChange={e => setConfig({ intervalMs: clampVal(e.target.value, 5, 3600000) })} className={inputCls} />
              </Field>
            </>
          )}

          {draft.type === 'autotyper' && (
            <>
              <Field label="Text to type">
                <textarea rows={3} value={c.text} onChange={e => setConfig({ text: e.target.value })} className={`${inputCls} resize-none`} />
              </Field>
              <div className="grid grid-cols-2 gap-4 lull-form-2col">
                <Field label="Start delay (ms)">
                  <input type="number" min={0} value={c.startDelayMs} onChange={e => setConfig({ startDelayMs: numVal(e.target.value) })} className={inputCls} />
                </Field>
                <Field label="Repeat every (ms)">
                  <input type="number" min={50} value={c.intervalMs} onChange={e => setConfig({ intervalMs: numVal(e.target.value) })} className={inputCls} disabled={!c.repeat} />
                </Field>
              </div>
              <div className="flex gap-3">
                <ToggleRow label="Press Enter after" value={!!c.pressEnter} onChange={v => setConfig({ pressEnter: v })} />
                <ToggleRow label="Repeat" value={!!c.repeat} onChange={v => setConfig({ repeat: v })} />
              </div>
            </>
          )}

          {draft.type === 'mousejiggler' && (
            <div className="grid grid-cols-2 gap-4 lull-form-2col">
              <Field label="Every (seconds)">
                <input type="number" min={1} value={c.intervalSeconds} onChange={e => setConfig({ intervalSeconds: numVal(e.target.value) })} className={inputCls} />
              </Field>
              <Field label="Nudge distance (px)">
                <input type="number" min={1} max={200} value={c.distance} onChange={e => setConfig({ distance: numVal(e.target.value) })} className={inputCls} />
              </Field>
            </div>
          )}

          <Field label="Global hotkey (start / stop)">
            <input value={draft.keybind} onChange={e => setDraft({ ...draft, keybind: e.target.value })} placeholder="F6" className={inputCls} />
            <p className="text-xs text-ink-muted mt-2">Press this anywhere to toggle the task on/off. Try F6–F10, or combos like Ctrl+Shift+K.</p>
          </Field>
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={onCancel} className="flex-1 py-3.5 px-6 rounded-full border border-cream-dark text-ink hover:bg-card transition-colors font-medium">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...draft, name: draft.name.trim() || (PRESETS.find(p => p.type === draft.type) || PRESETS[0]).name })}
            className="flex-1 py-3.5 px-6 rounded-full bg-terra text-cream hover:bg-terra-dark transition-colors font-medium"
          >
            Save task
          </button>
        </div>
      </div>
    </div>
  );
}
