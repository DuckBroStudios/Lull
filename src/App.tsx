import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Image as ImageIcon, Trash2, AlarmClock, Bell, Clock, Settings, LogOut, User, Moon, Sun, Volume2, VolumeX, Eye, EyeOff, Zap, Play, Square, MousePointerClick, Keyboard, Type, Move, Pencil, ChevronLeft, AlertTriangle, Music, Pause, Lock, Flame, Trophy, Target, TrendingUp, Gift, BarChart3, Sparkles, Home, Palette, Upload, ZoomIn, ZoomOut, Users, Search, UserPlus, Check } from 'lucide-react';
import { isNative, requestReminderPermission, syncReminderNotifications } from './notifications';
import * as social from './social';
import type { CloudProfile, Friend, FriendRequest } from './social';
import { registerPlugin } from '@capacitor/core';

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
  autoAppIcon: boolean;
  // profile
  avatarType: 'monogram' | 'preset' | 'photo';
  avatarPhoto: string;   // dataURL when avatarType === 'photo'
  avatarPreset: string;  // preset background key when 'preset'/'monogram'
  avatarColor: string;   // accent / letter colour
  profileVisible: boolean; // show avatar to friends (off by default; for future social)
  // time
  timezone: string;      // IANA name, or 'auto'
  autoTimezone: boolean;
  // unlocks + layout
  unlockedIcons: string[];   // seasonal/holiday app icons earned by completing reminders
  dashboardOrder: string[];  // edit-mode ordering of home dashboard blocks
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

// pick a holiday theme when in its window, otherwise the season (used for decorations)
function decorThemeOf(d: Date): string {
  const m = d.getMonth(), day = d.getDate();
  if ((m === 11 && day >= 31) || (m === 0 && day <= 2)) return 'newyear';
  if (m === 11 && day >= 13) return 'christmas';
  if (m === 9 && day >= 18) return 'halloween';
  if ((m === 2 && day >= 22) || (m === 3 && day <= 21)) return 'easter';
  return seasonOf(d).label.toLowerCase();
}

// same idea but for the app-icon set (Valentine's instead of Easter)
function iconThemeOf(d: Date): string {
  const m = d.getMonth(), day = d.getDate();
  if ((m === 11 && day >= 31) || (m === 0 && day <= 2)) return 'newyear';
  if (m === 11 && day >= 13) return 'christmas';
  if (m === 9 && day >= 18) return 'halloween';
  if (m === 1 && day >= 7 && day <= 15) return 'valentines';
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

const APP_ICONS: { key: string; label: string; preview: string; period: string }[] = [
  { key: 'default', label: 'Ink', preview: 'icons/icon-default.png', period: 'any' },
  { key: 'terra', label: 'Terra', preview: 'icons/icon-terra.png', period: 'any' },
  { key: 'forest', label: 'Forest', preview: 'icons/icon-forest.png', period: 'any' },
  { key: 'cream', label: 'Cream', preview: 'icons/icon-cream.png', period: 'any' },
  { key: 'spring', label: 'Spring', preview: 'icons/icon-spring.png', period: 'spring' },
  { key: 'summer', label: 'Summer', preview: 'icons/icon-summer.png', period: 'summer' },
  { key: 'autumn', label: 'Autumn', preview: 'icons/icon-autumn.png', period: 'autumn' },
  { key: 'winter', label: 'Winter', preview: 'icons/icon-winter.png', period: 'winter' },
  { key: 'valentines', label: "Valentine's", preview: 'icons/icon-valentines.png', period: 'valentines' },
  { key: 'halloween', label: 'Halloween', preview: 'icons/icon-halloween.png', period: 'halloween' },
  { key: 'christmas', label: 'Christmas', preview: 'icons/icon-christmas.png', period: 'christmas' },
  { key: 'newyear', label: 'New Year', preview: 'icons/icon-newyear.png', period: 'newyear' },
];

const AppIconPlugin = registerPlugin<any>('AppIcon');
const APP_ICON_NAMES: Record<string, string> = {
  terra: 'IconTerra', forest: 'IconForest', cream: 'IconCream',
  spring: 'IconSpring', summer: 'IconSummer', autumn: 'IconAutumn', winter: 'IconWinter',
  valentines: 'IconValentines', halloween: 'IconHalloween', christmas: 'IconChristmas', newyear: 'IconNewyear',
};
async function applyAppIcon(key: string) {
  if (!isNative) return;
  try {
    if (key === 'default') {
      // dedicated reset() returns to the primary icon (change({name:null}) is unreliable)
      await AppIconPlugin.reset({ suppressNotification: true });
    } else {
      const name = APP_ICON_NAMES[key];
      if (name) await AppIconPlugin.change({ name, suppressNotification: true });
    }
  } catch { /* native plugin unavailable */ }
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
type MacroType = 'autoclicker' | 'keypresser' | 'autotyper' | 'mousejiggler';
interface Macro {
  id: string;
  type: MacroType;
  name: string;
  keybind: string;
  config: any;
}

const PRESETS: { type: MacroType; name: string; blurb: string; icon: any; keybind: string; engine: 'input' | 'browser' }[] = [
  { type: 'autoclicker', name: 'Auto Clicker', blurb: 'Rapid-fire clicks, or a hold-then-release cycle, at a speed you set. Toggle with a global hotkey.', icon: MousePointerClick, keybind: 'F6', engine: 'input' },
  { type: 'keypresser', name: 'Key Presser', blurb: 'Taps a key you choose over and over at a set interval. Great for anti-idle or spamming an action.', icon: Keyboard, keybind: 'F8', engine: 'input' },
  { type: 'autotyper', name: 'Auto Typer', blurb: 'Types a phrase for you — once, or on repeat. Useful for testing forms and chats.', icon: Type, keybind: 'F9', engine: 'input' },
  { type: 'mousejiggler', name: 'Mouse Jiggler', blurb: 'Nudges the mouse every so often so your machine stays awake and shows as active.', icon: Move, keybind: 'F10', engine: 'input' },
];

function defaultConfig(type: MacroType): any {
  switch (type) {
    case 'autoclicker': return { button: 'left', mode: 'rapid', cps: 10, holdSeconds: 1, releaseSeconds: 1 };
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
    else if (repeat === 'weekends') { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 0 && d.getDay() !== 6); }
    else d.setFullYear(d.getFullYear() + 100);
  };
  let guard = 0;
  do { advance(); guard++; } while (d.getTime() <= now && guard < 5000);
  return d.getTime();
}

// The first time a recurring reminder should fire: the picked time if it's
// already a valid future occurrence, otherwise the next matching day. Keeps
// weekdays/weekends reminders from firing "now" on a non-matching day.
function firstValidTrigger(ts: number, repeat: string, now: number): number {
  if (!repeat || repeat === 'none') return ts;
  const g = new Date(ts).getDay();
  const dayOk =
    repeat === 'weekdays' ? (g !== 0 && g !== 6) :
    repeat === 'weekends' ? (g === 0 || g === 6) :
    true; // daily and weekly are valid on the chosen day
  if (ts > now && dayOk) return ts;
  return nextReminderTrigger(ts, repeat, now);
}

const repeatLabel = (r: string) => r === 'weekdays' ? 'Weekdays' : r === 'weekends' ? 'Weekends' : r === 'weekly' ? 'Weekly' : r === 'daily' ? 'Daily' : '';

// ============================================================
// GAMIFICATION — points, streaks, stats, achievements.
// All of this is cross-platform (no native APIs) and persists to
// localStorage per account, so it survives restarts on desktop and mobile.
// ============================================================
interface DayStat { completed: number; missed: number }
interface CustomReward { goalType: 'completions' | 'streak'; goal: number; text: string; claimed: boolean }
interface GameState {
  xp: number;
  completedTotal: number;
  missedTotal: number;
  streak: number;
  bestStreak: number;
  lastStreakDay: string;        // 'YYYY-MM-DD' the streak was last credited
  achievements: string[];       // unlocked achievement ids
  history: Record<string, DayStat>; // keyed by 'YYYY-MM-DD'
  reward: CustomReward | null;
  celebratedDay: string;        // 'YYYY-MM-DD' confetti last fired
  iconProgress: Record<string, number>; // completions per season/holiday, for icon unlocks
}

// Completions in a season/holiday needed to permanently unlock its app icon.
const ICON_UNLOCK_THRESHOLD = 3;

const DEFAULT_GAME: GameState = {
  xp: 0, completedTotal: 0, missedTotal: 0, streak: 0, bestStreak: 0,
  lastStreakDay: '', achievements: [], history: {}, reward: null, celebratedDay: '', iconProgress: {},
};

const dayKey = (ts: number): string => {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// XP → level. Each level costs a bit more than the last (100, 250, 450, …).
function levelFromXp(xp: number): { level: number; into: number; span: number } {
  let level = 1, need = 100, acc = 0;
  while (xp >= acc + need) { acc += need; level++; need += 150; }
  return { level, into: xp - acc, span: need };
}

const XP_PER_COMPLETION = 10;
const XP_ONTIME_BONUS = 5;
// How close to the due time still counts as "on time" (fuels the streak).
const ONTIME_WINDOW_MS = 30 * 60 * 1000;

interface AchievementDef { id: string; label: string; desc: string; test: (g: GameState) => boolean }
const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first',    label: 'First Step',    desc: 'Complete your first reminder',   test: g => g.completedTotal >= 1 },
  { id: 'ten',      label: 'Getting Going', desc: 'Complete 10 reminders',          test: g => g.completedTotal >= 10 },
  { id: 'fifty',    label: 'Committed',     desc: 'Complete 50 reminders',          test: g => g.completedTotal >= 50 },
  { id: 'hundred',  label: 'Centurion',     desc: 'Complete 100 reminders',         test: g => g.completedTotal >= 100 },
  { id: 'streak3',  label: 'Warming Up',    desc: 'Reach a 3-day streak',           test: g => g.bestStreak >= 3 },
  { id: 'streak7',  label: 'On Fire',       desc: 'Reach a 7-day streak',           test: g => g.bestStreak >= 7 },
  { id: 'streak30', label: 'Unstoppable',   desc: 'Reach a 30-day streak',          test: g => g.bestStreak >= 30 },
  { id: 'level5',   label: 'Seasoned',      desc: 'Reach level 5',                  test: g => levelFromXp(g.xp).level >= 5 },
];

// Record a completion and return the next game state (+ any newly unlocked ids).
function applyCompletion(g: GameState, onTime: boolean, now: number): { next: GameState; unlocked: string[] } {
  const today = dayKey(now);
  const hist = { ...g.history };
  const d = hist[today] || { completed: 0, missed: 0 };
  hist[today] = { ...d, completed: d.completed + 1 };

  let { streak, bestStreak, lastStreakDay } = g;
  if (onTime && lastStreakDay !== today) {
    const yesterday = dayKey(now - 86400000);
    streak = lastStreakDay === yesterday ? streak + 1 : 1;
    lastStreakDay = today;
    bestStreak = Math.max(bestStreak, streak);
  }

  const next: GameState = {
    ...g,
    xp: g.xp + XP_PER_COMPLETION + (onTime ? XP_ONTIME_BONUS : 0),
    completedTotal: g.completedTotal + 1,
    streak, bestStreak, lastStreakDay,
    history: hist,
  };

  const unlocked = ACHIEVEMENTS.filter(a => !next.achievements.includes(a.id) && a.test(next)).map(a => a.id);
  if (unlocked.length) next.achievements = [...next.achievements, ...unlocked];
  return { next, unlocked };
}

function applyMiss(g: GameState, now: number): GameState {
  const today = dayKey(now);
  const hist = { ...g.history };
  const d = hist[today] || { completed: 0, missed: 0 };
  hist[today] = { ...d, missed: d.missed + 1 };
  return { ...g, missedTotal: g.missedTotal + 1, history: hist };
}

// Pre-computed confetti pieces (fixed set so the burst is deterministic per render).
const CONFETTI_COLORS = ['#C8553D', '#E4A05B', '#6B8F71', '#D98E48', '#EAD7B7', '#8C5A3C'];
const CONFETTI_PIECES = Array.from({ length: 70 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 7 + (i % 4) * 2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  dur: 1.8 + (i % 5) * 0.3,
  delay: (i % 10) * 0.08,
}));

// ============================================================
// PROFILE AVATAR — photo, preset gradient, or coloured monogram.
// ============================================================
const AVATAR_PRESETS: Record<string, string> = {
  terra:  'linear-gradient(135deg,#C8553D,#E4A05B)',
  forest: 'linear-gradient(135deg,#6B8F71,#A9C3A0)',
  dusk:   'linear-gradient(135deg,#8C6BA9,#C9A0EA)',
  ocean:  'linear-gradient(135deg,#3D7EA6,#7FBFD8)',
  rose:   'linear-gradient(135deg,#C85B7C,#E9A0BC)',
  gold:   'linear-gradient(135deg,#D98E48,#EAD7B7)',
  mint:   'linear-gradient(135deg,#4FA890,#9FE0CF)',
  ink:    'linear-gradient(135deg,#2B2B2B,#4A4A4A)',
};

function Avatar({ settings, name, size }: { settings: UserSettings; name: string; size: number }) {
  const letter = ((settings.displayName || name || '?').trim().charAt(0) || '?').toUpperCase();
  const common: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  if (settings.avatarType === 'photo' && settings.avatarPhoto) {
    return <span style={common}><img src={settings.avatarPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>;
  }
  if (settings.avatarType === 'monogram') {
    return (
      <span style={{ ...common, background: settings.avatarColor || '#C8553D' }}>
        <span style={{ fontSize: size * 0.46, fontWeight: 700, color: '#FFF8EE', lineHeight: 1 }}>{letter}</span>
      </span>
    );
  }
  const bg = AVATAR_PRESETS[settings.avatarPreset] || AVATAR_PRESETS.terra;
  return (
    <span style={{ ...common, background: bg }}>
      <span style={{ fontSize: size * 0.46, fontWeight: 700, color: '#FFF8EE', lineHeight: 1, WebkitTextStroke: '1px rgba(0,0,0,0.18)' }}>{letter}</span>
    </span>
  );
}

// ============================================================
// NOTEPAD — a starfield you tap to drop notes. Each note is a
// gradient card (1+ colours) and nearby notes link up into a
// constellation with soft grey lines.
// ============================================================
interface Note { id: string; x: number; y: number; text: string; colors: string[] }

const NOTE_PALETTE = ['#C8553D', '#E4A05B', '#EAD7B7', '#6B8F71', '#3D7EA6', '#8C6BA9', '#C85B7C', '#4FA890'];

function gradientCss(colors: string[]): string {
  if (!colors || colors.length === 0) return '#C8553D';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors.join(', ')})`;
}

function NotepadPanel({ notes, setNotes, theme, onClose }: {
  notes: Note[];
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  theme: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [colorMode, setColorMode] = useState<'menu' | 'solid' | 'gradient'>('menu');
  const dragRef = useRef<{ id: string } | null>(null);
  const dot = theme === 'dark' ? 'rgba(255,255,255,0.30)' : 'rgba(31,36,33,0.22)';

  // pan + zoom view. viewRef mirrors state so pointer handlers read live values.
  const [view, setViewState] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const setView = (v: { scale: number; tx: number; ty: number }) => { viewRef.current = v; setViewState(v); };
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<any>(null);

  const canvasXY = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { sx: clientX - (r?.left || 0), sy: clientY - (r?.top || 0), w: r?.width || 1, h: r?.height || 1 };
  };
  // screen point → world fraction (accounts for pan + zoom)
  const worldFrac = (clientX: number, clientY: number) => {
    const { sx, sy, w, h } = canvasXY(clientX, clientY);
    const v = viewRef.current;
    return { x: (sx - v.tx) / (w * v.scale), y: (sy - v.ty) / (h * v.scale) };
  };
  const zoomAround = (sx: number, sy: number, factor: number) => {
    const v = viewRef.current;
    const ns = clamp(v.scale * factor, 0.35, 3.5);
    const k = ns / v.scale;
    setView({ scale: ns, tx: sx - (sx - v.tx) * k, ty: sy - (sy - v.ty) * k });
  };
  const zoomButton = (factor: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    zoomAround((r?.width || 0) / 2, (r?.height || 0) / 2, factor);
  };

  const addNote = (fx: number, fy: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setNotes(ns => [...ns, { id, x: fx, y: fy, text: '', colors: [NOTE_PALETTE[ns.length % NOTE_PALETTE.length]] }]);
    // colour editor stays closed until the pencil is tapped
  };

  const onWheel = (e: React.WheelEvent) => {
    const { sx, sy } = canvasXY(e.clientX, e.clientY);
    zoomAround(sx, sy, e.deltaY < 0 ? 1.12 : 1 / 1.12);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      const { sx, sy } = canvasXY((p.x + q.x) / 2, (p.y + q.y) / 2);
      gesture.current = { mode: 'pinch', startDist: Math.hypot(p.x - q.x, p.y - q.y), startScale: v.scale, startTx: v.tx, startTy: v.ty, midX: sx, midY: sy };
    } else {
      gesture.current = { mode: 'tap', sx: e.clientX, sy: e.clientY, startTx: v.tx, startTy: v.ty, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragRef.current) { const f = worldFrac(e.clientX, e.clientY); setNotes(ns => ns.map(n => (n.id === dragRef.current!.id ? { ...n, x: f.x, y: f.y } : n))); return; }
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    const v = viewRef.current;
    if (g.mode === 'pinch' && pointers.current.size >= 2) {
      const [p, q] = [...pointers.current.values()];
      const dist = Math.hypot(p.x - q.x, p.y - q.y);
      const ns = clamp(g.startScale * (dist / g.startDist), 0.35, 3.5);
      const k = ns / g.startScale;
      setView({ scale: ns, tx: g.midX - (g.midX - g.startTx) * k, ty: g.midY - (g.midY - g.startTy) * k });
    } else if (g.mode === 'tap' || g.mode === 'pan') {
      const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 6) { g.moved = true; g.mode = 'pan'; }
      if (g.mode === 'pan') setView({ scale: v.scale, tx: g.startTx + dx, ty: g.startTy + dy });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (dragRef.current) { dragRef.current = null; return; }
    const g = gesture.current;
    if (g && g.mode === 'tap' && !g.moved) { const f = worldFrac(g.sx, g.sy); addNote(f.x, f.y); }
    if (pointers.current.size === 0) gesture.current = null;
  };

  const patch = (id: string, fn: (n: Note) => Note) => setNotes(ns => ns.map(n => (n.id === id ? fn(n) : n)));

  // connect every note to every other note → a full constellation web
  const edges: number[][] = [];
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) edges.push([i, j]);
  }
  const bg = theme === 'dark' ? '#1B1712' : '#F3EBDD';

  return (
    <div className="fixed inset-0 z-40 animate-fade-in">
      {/* fullscreen blurred starfield canvas */}
      <div
        ref={canvasRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 overflow-hidden"
        style={{
          backgroundColor: bg,
          backgroundImage: `radial-gradient(${dot} 1.3px, transparent 1.4px)`,
          backgroundSize: '26px 26px',
          touchAction: 'none',
          cursor: gesture.current?.mode === 'pan' ? 'grabbing' : 'crosshair',
        }}
      >
        {/* world layer (pans + zooms) */}
        <div className="absolute top-0 left-0 w-full h-full" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0' }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            {edges.map(([a, b], k) => (
              <line key={k} x1={notes[a].x * 100} y1={notes[a].y * 100} x2={notes[b].x * 100} y2={notes[b].y * 100} stroke="rgba(130,130,130,0.6)" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>

          {notes.map(n => (
            <div
              key={n.id}
              className="absolute"
              style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, transform: 'translate(-50%,-50%)', width: 248 }}
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="rounded-2xl shadow-lg overflow-hidden border border-black/10" style={{ background: gradientCss(n.colors) }}>
                <div
                  className="flex items-center justify-between px-2.5 py-2 cursor-move select-none"
                  onPointerDown={e => { e.stopPropagation(); dragRef.current = { id: n.id }; }}
                >
                  <button onClick={e => { e.stopPropagation(); const open = editing === n.id; setEditing(open ? null : n.id); setColorMode('menu'); }} className="w-7 h-7 rounded-full bg-white/85 flex items-center justify-center text-ink hover:bg-white transition-colors" aria-label="Edit colour"><Pencil size={14} strokeWidth={2}/></button>
                  <button onClick={e => { e.stopPropagation(); setNotes(ns => ns.filter(x => x.id !== n.id)); if (editing === n.id) setEditing(null); }} className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-ink hover:bg-white transition-colors" aria-label="Delete note"><X size={14} strokeWidth={2}/></button>
                </div>
                <textarea
                  value={n.text}
                  onChange={e => patch(n.id, x => ({ ...x, text: e.target.value }))}
                  onClick={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  placeholder="Write…"
                  className="w-full h-36 resize-none bg-white/85 text-ink text-[15px] p-3 focus:outline-none"
                />
              </div>

              {editing === n.id && (
                <div className="mt-2 bg-cream border border-cream-dark rounded-2xl p-4 shadow-xl" style={{ width: 288 }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      onClick={() => { patch(n.id, x => ({ ...x, colors: [x.colors[0] || '#C8553D'] })); setColorMode('solid'); }}
                      className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${colorMode === 'solid' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}
                    >
                      Change colour
                    </button>
                    <button
                      onClick={() => { patch(n.id, x => ({ ...x, colors: x.colors.length >= 2 ? x.colors : [x.colors[0] || '#C8553D', NOTE_PALETTE[(x.colors.length + 1) % NOTE_PALETTE.length]] })); setColorMode('gradient'); }}
                      className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${colorMode === 'gradient' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}
                    >
                      Add gradient
                    </button>
                  </div>

                  {colorMode === 'solid' && (
                    <input
                      type="color"
                      value={n.colors[0] || '#C8553D'}
                      onChange={e => patch(n.id, x => ({ ...x, colors: [e.target.value] }))}
                      className="w-full h-12 rounded-lg border border-cream-dark bg-transparent cursor-pointer p-0"
                      aria-label="Pick note colour"
                    />
                  )}

                  {colorMode === 'gradient' && (
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        {n.colors.map((c, ci) => (
                          <div key={ci} className="relative">
                            <input type="color" value={c} onChange={e => patch(n.id, x => ({ ...x, colors: x.colors.map((cc, k) => (k === ci ? e.target.value : cc)) }))} className="w-10 h-10 rounded-md border border-cream-dark bg-transparent cursor-pointer p-0" />
                            {n.colors.length > 1 && (
                              <button onClick={() => patch(n.id, x => ({ ...x, colors: x.colors.filter((_, k) => k !== ci) }))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ink text-cream text-[9px] leading-none flex items-center justify-center" aria-label="Remove colour">×</button>
                            )}
                          </div>
                        ))}
                        {n.colors.length < 5 && (
                          <button onClick={() => patch(n.id, x => ({ ...x, colors: [...x.colors, NOTE_PALETTE[x.colors.length % NOTE_PALETTE.length]] }))} className="w-10 h-10 rounded-md border-2 border-dashed border-cream-dark text-ink-muted flex items-center justify-center hover:border-terra transition-colors" aria-label="Add colour">+</button>
                        )}
                      </div>
                      <div className="h-8 rounded-lg mt-3 border border-black/5" style={{ background: gradientCss(n.colors) }} />
                      <p className="text-[11px] text-ink-muted mt-2">Add colours for effects like red → orange → yellow.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center px-8">
            <div>
              <Sparkles size={28} className="text-terra mx-auto mb-3" strokeWidth={1.5}/>
              <p className="font-display text-2xl italic text-ink-muted">A quiet sky, waiting for stars</p>
              <p className="text-sm text-ink-muted mt-2">Tap anywhere to place your first note</p>
            </div>
          </div>
        )}
      </div>

      {/* floating title + close (top-right, clear of the Home button) */}
      <div className="absolute top-5 right-5 flex items-center gap-3" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <span className="hidden sm:flex items-center gap-2 bg-card/80 backdrop-blur border border-cream-dark rounded-full px-4 py-2 text-sm text-ink"><Pencil size={15} className="text-terra" strokeWidth={2}/> Notepad</span>
        <button onClick={onClose} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink-muted hover:text-terra hover:border-terra transition-colors" aria-label="Close notepad"><X size={20}/></button>
      </div>

      {/* zoom controls (bottom-right) */}
      <div className="absolute bottom-6 right-5 flex flex-col items-center gap-2" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <button onClick={() => zoomButton(1.2)} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink hover:text-terra hover:border-terra transition-colors" aria-label="Zoom in"><ZoomIn size={18} strokeWidth={2}/></button>
        <button onClick={() => setView({ scale: 1, tx: 0, ty: 0 })} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink-muted hover:text-terra hover:border-terra transition-colors text-[10px] font-semibold" aria-label="Reset zoom">{Math.round(view.scale * 100)}%</button>
        <button onClick={() => zoomButton(1 / 1.2)} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink hover:text-terra hover:border-terra transition-colors" aria-label="Zoom out"><ZoomOut size={18} strokeWidth={2}/></button>
      </div>
    </div>
  );
}

// ============================================================
// SHARED NOTEPAD — a constellation co-edited with a friend, live over Firebase.
// ============================================================
function SharedNotepad({ space, theme, onClose }: {
  space: { id: string; withName: string };
  theme: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<social.SpaceNote[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const dragRef = useRef<{ id: string } | null>(null);
  const dot = theme === 'dark' ? 'rgba(255,255,255,0.30)' : 'rgba(31,36,33,0.22)';
  const bg = theme === 'dark' ? '#1B1712' : '#F3EBDD';

  useEffect(() => {
    const off = social.watchSpaceNotes(space.id, setNotes);
    return () => off();
  }, [space.id]);

  const frac = (cx: number, cy: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { x: Math.min(0.95, Math.max(0.04, (cx - (r?.left || 0)) / (r?.width || 1))), y: Math.min(0.95, Math.max(0.05, (cy - (r?.top || 0)) / (r?.height || 1))) };
  };
  const onCanvasClick = (e: React.MouseEvent) => {
    if (e.target !== canvasRef.current) return;
    const { x, y } = frac(e.clientX, e.clientY);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    social.setSpaceNote(space.id, { id, x, y, text: '', colors: [NOTE_PALETTE[notes.length % NOTE_PALETTE.length]] }).catch(() => {});
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { x, y } = frac(e.clientX, e.clientY);
    setNotes(ns => ns.map(n => (n.id === dragRef.current!.id ? { ...n, x, y } : n)));
  };
  const endDrag = () => {
    const d = dragRef.current; dragRef.current = null;
    if (d) { const n = notes.find(x => x.id === d.id); if (n) social.setSpaceNote(space.id, n).catch(() => {}); }
  };
  const setColor = (id: string, color: string) => {
    setNotes(ns => ns.map(n => (n.id === id ? { ...n, colors: [color] } : n)));
    const n = notes.find(x => x.id === id); if (n) social.setSpaceNote(space.id, { ...n, colors: [color] }).catch(() => {});
  };
  const setText = (id: string, text: string) => setNotes(ns => ns.map(n => (n.id === id ? { ...n, text } : n)));
  const commitText = (id: string) => { const n = notes.find(x => x.id === id); if (n) social.setSpaceNote(space.id, n).catch(() => {}); };
  const removeNote = (id: string) => { social.deleteSpaceNote(space.id, id).catch(() => {}); if (editing === id) setEditing(null); };

  const edges: number[][] = [];
  for (let i = 0; i < notes.length; i++) for (let j = i + 1; j < notes.length; j++) edges.push([i, j]);

  return (
    <div className="fixed inset-0 z-40 animate-fade-in">
      <div
        ref={canvasRef}
        onClick={onCanvasClick}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className="absolute inset-0 overflow-hidden"
        style={{ backgroundColor: bg, backgroundImage: `radial-gradient(${dot} 1.3px, transparent 1.4px)`, backgroundSize: '26px 26px', touchAction: 'none', cursor: 'crosshair' }}
      >
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
          {edges.map(([a, b], k) => (<line key={k} x1={notes[a].x * 100} y1={notes[a].y * 100} x2={notes[b].x * 100} y2={notes[b].y * 100} stroke="rgba(130,130,130,0.6)" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />))}
        </svg>
        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center px-8">
            <div><Sparkles size={28} className="text-terra mx-auto mb-3" strokeWidth={1.5} /><p className="font-display text-2xl italic text-ink-muted">A shared sky with {space.withName}</p><p className="text-sm text-ink-muted mt-2">Tap anywhere — you'll both see it live</p></div>
          </div>
        )}
        {notes.map(n => (
          <div key={n.id} className="absolute" style={{ left: `${n.x * 100}%`, top: `${n.y * 100}%`, transform: 'translate(-50%,-50%)', width: 200 }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
            <div className="rounded-2xl shadow-lg overflow-hidden border border-black/10" style={{ background: gradientCss(n.colors) }}>
              <div className="flex items-center justify-between px-2 py-1.5 cursor-move select-none" onPointerDown={e => { e.stopPropagation(); dragRef.current = { id: n.id }; }}>
                <button onClick={e => { e.stopPropagation(); setEditing(editing === n.id ? null : n.id); }} className="w-7 h-7 rounded-full bg-white/85 flex items-center justify-center text-ink hover:bg-white transition-colors" aria-label="Colour"><Pencil size={13} strokeWidth={2} /></button>
                <button onClick={e => { e.stopPropagation(); removeNote(n.id); }} className="w-7 h-7 rounded-full bg-white/60 flex items-center justify-center text-ink hover:bg-white transition-colors" aria-label="Delete"><X size={13} strokeWidth={2} /></button>
              </div>
              <textarea value={n.text} onChange={e => setText(n.id, e.target.value)} onBlur={() => commitText(n.id)} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} placeholder="Write…" className="w-full h-28 resize-none bg-white/85 text-ink text-sm p-2.5 focus:outline-none" />
            </div>
            {editing === n.id && (
              <div className="mt-2 bg-cream border border-cream-dark rounded-2xl p-3 shadow-xl" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-2">Note colour</div>
                <input type="color" value={n.colors[0] || '#C8553D'} onChange={e => setColor(n.id, e.target.value)} className="w-full h-10 rounded-lg border border-cream-dark bg-transparent cursor-pointer p-0" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="absolute top-5 right-5 flex items-center gap-3" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <span className="hidden sm:flex items-center gap-2 bg-card/80 backdrop-blur border border-cream-dark rounded-full px-4 py-2 text-sm text-ink"><Users size={15} className="text-terra" strokeWidth={2} /> Shared with {space.withName}</span>
        <button onClick={onClose} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink-muted hover:text-terra hover:border-terra transition-colors" aria-label="Close"><X size={20} /></button>
      </div>
    </div>
  );
}

// ============================================================
// FRIENDS — optional cloud account, user search, requests, list.
// Backed by src/social.ts (Firebase). Fully separate from local login.
// ============================================================
function FriendsPanel({ localUsername, settings, game, reminders, onOpenSpace, onClose }: {
  localUsername: string;
  settings: UserSettings;
  game: GameState;
  reminders: any[];
  onOpenSpace: (id: string, withName: string) => void;
  onClose: () => void;
}) {
  const fInput = 'w-full bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-terra transition-colors';
  const [me, setMe] = useState<CloudProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [handle, setHandle] = useState(localUsername);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'friends' | 'requests' | 'find' | 'board'>('friends');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<CloudProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentTo, setSentTo] = useState<string[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [spaces, setSpaces] = useState<social.Space[]>([]);
  const [sharing, setSharing] = useState<Friend | null>(null); // friend we're sharing a reminder with
  const [shareMode, setShareMode] = useState<'new' | 'select'>('new');
  const [srTitle, setSrTitle] = useState('');
  const [srDate, setSrDate] = useState('');
  const [srTime, setSrTime] = useState('');
  const [srRepeat, setSrRepeat] = useState('none');

  const profileInput = (): social.ProfileInput => ({
    displayName: settings.displayName || localUsername,
    avatarType: settings.avatarType,
    avatarPreset: settings.avatarPreset,
    avatarColor: settings.avatarColor,
    avatarPhoto: settings.avatarPhoto,
    profileVisible: settings.profileVisible,
    xp: game.xp,
    streak: game.streak,
  });
  const avatarOf = (p: any): any => ({
    avatarType: p.avatarType || 'monogram', avatarPhoto: p.avatarPhoto || '',
    avatarPreset: p.avatarPreset || 'terra', avatarColor: p.avatarColor || '#C8553D',
    displayName: p.displayName || p.username || '?',
  });

  useEffect(() => {
    const off = social.watchCloudAuth(async (u) => {
      if (u) {
        try {
          let prof = await social.getProfile(u.uid);
          if (!prof) { await social.syncProfile(u.uid, (localUsername || 'user').toLowerCase(), profileInput()); prof = await social.getProfile(u.uid); }
          setMe(prof);
        } catch { setMe(null); }
      } else setMe(null);
      setReady(true);
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doAuth = async () => {
    setError(''); setBusy(true);
    try {
      if (mode === 'up') { const prof = await social.cloudSignUp(email, password, handle, profileInput()); setMe(prof); }
      else { const prof = await social.cloudSignIn(email, password); setMe(prof); }
    } catch (e: any) { setError(e?.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  };
  const doSignOut = async () => { try { await social.cloudSignOut(); } catch { /* ignore */ } setMe(null); setFriends([]); setRequests([]); setResults([]); };
  const doSearch = async () => {
    if (!me) return;
    setSearching(true);
    try { setResults(await social.searchUsers(term, me.uid)); } catch { setResults([]); } finally { setSearching(false); }
  };
  const doSend = async (to: CloudProfile) => { if (!me) return; try { await social.sendFriendRequest(me, to.uid); setSentTo(s => [...s, to.uid]); } catch (e: any) { setError(e?.message || 'Could not send request.'); } };
  const doAccept = async (r: FriendRequest) => { if (!me) return; try { await social.acceptFriendRequest(me, r); } catch { /* ignore */ } };
  const doDecline = async (r: FriendRequest) => { if (!me) return; try { await social.declineFriendRequest(me.uid, r.fromUid); setRequests(rs => rs.filter(x => x.fromUid !== r.fromUid)); } catch { /* ignore */ } };
  const doRemove = async (f: Friend) => { if (!me) return; try { await social.removeFriend(me.uid, f.uid); setFriends(fs => fs.filter(x => x.uid !== f.uid)); } catch { /* ignore */ } };

  // live subscriptions: friends, requests, shared spaces — keep both devices in sync
  useEffect(() => {
    if (!me) { setSpaces([]); setFriends([]); setRequests([]); return; }
    const offS = social.watchSpaces(me.uid, setSpaces);
    const offF = social.watchFriends(me.uid, setFriends);
    const offR = social.watchRequests(me.uid, setRequests);
    return () => { offS(); offF(); offR(); };
  }, [me]);

  // open (or create) the shared notepad with a friend
  const openNotepad = async (f: Friend) => {
    if (!me) return;
    const existing = spaces.find(s => s.members.includes(f.uid));
    try {
      const id = existing ? existing.id : await social.createSpace(me, f);
      onOpenSpace(id, f.displayName);
    } catch (e: any) { setError(e?.message || 'Could not open the shared notepad. Re-check the Firestore rules.'); }
  };

  // share-a-reminder flow
  const openShare = (f: Friend) => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const p = (n: number) => String(n).padStart(2, '0');
    setShareMode('new'); setSrTitle(''); setSrRepeat('none');
    setSrDate(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    setSrTime(`${p(d.getHours())}:${p(d.getMinutes())}`);
    setSharing(f);
  };
  const submitShare = async () => {
    if (!me || !sharing || !srTitle.trim() || !srDate || !srTime) return;
    const triggerAt = new Date(`${srDate}T${srTime}:00`).getTime();
    try { await social.createSharedReminder(me, sharing, { title: srTitle.trim(), description: '', triggerAt, repeat: srRepeat }); setSharing(null); }
    catch (e: any) { setError(e?.message || 'Could not share.'); }
  };
  const shareExisting = async (r: any) => {
    if (!me || !sharing) return;
    try { await social.createSharedReminder(me, sharing, { title: r.title, description: r.description || '', triggerAt: r.triggerAt, repeat: r.repeat || 'none' }); setSharing(null); }
    catch (e: any) { setError(e?.message || 'Could not share.'); }
  };

  const level = (xp?: number) => levelFromXp(xp || 0).level;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6">
      <div className="bg-cream rounded-3xl w-full max-w-lg h-[86vh] border border-cream-dark shadow-2xl overflow-hidden flex flex-col animate-slide-down" style={{ boxShadow: '0 30px 80px -20px rgba(31,36,33,0.4)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-dark shrink-0">
          <div className="flex items-center gap-2"><Users size={18} className="text-terra" strokeWidth={1.9}/><h2 className="font-display text-xl text-ink font-medium">Friends</h2></div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink transition-colors p-1.5" aria-label="Close friends"><X size={20}/></button>
        </div>

        {!ready ? (
          <div className="flex-1 flex items-center justify-center text-ink-muted">Connecting…</div>
        ) : !me ? (
          <div className="flex-1 overflow-y-auto p-6">
            <p className="text-ink-muted text-sm mb-5">Friends use a free cloud account, separate from your local login. {mode === 'up' ? 'Create one' : 'Sign in'} to find people and share.</p>
            <div className="space-y-3">
              {mode === 'up' && <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="Username (how friends find you)" className={fInput} />}
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email" className={fInput} />
              <input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Password" className={fInput} />
              {error && <p className="text-sm text-terra-dark bg-terra-light rounded-xl px-4 py-2.5">{error}</p>}
              <button onClick={doAuth} disabled={busy} className="w-full py-3.5 rounded-full bg-terra text-cream font-medium hover:bg-terra-dark disabled:opacity-50 transition-colors">{busy ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
            </div>
            <button onClick={() => { setMode(mode === 'up' ? 'in' : 'up'); setError(''); }} className="mt-4 text-sm text-terra hover:text-terra-dark transition-colors">{mode === 'up' ? 'Already have a cloud account? Sign in' : 'New here? Create a cloud account'}</button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-3 px-6 py-3 border-b border-cream-dark">
              <Avatar settings={avatarOf(me)} name={me.username} size={36} />
              <div className="min-w-0 flex-1"><div className="font-medium text-ink truncate">{me.displayName}</div><div className="text-xs text-ink-muted">@{me.username}</div></div>
              <button onClick={doSignOut} className="text-xs text-ink-muted hover:text-terra transition-colors">Sign out</button>
            </div>
            <div className="flex gap-1 px-4 pt-3">
              {([['friends', `Friends (${friends.length})`], ['requests', `Requests (${requests.length})`], ['find', 'Find'], ['board', 'Board']] as [typeof tab, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${tab === k ? 'bg-terra-light text-terra-dark' : 'text-ink-muted hover:text-ink'}`}>{l}</button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {tab === 'find' && (<>
                <div className="flex gap-2">
                  <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') doSearch(); }} placeholder="Search by username" className={fInput} />
                  <button onClick={doSearch} className="px-4 rounded-2xl bg-ink text-cream shrink-0" aria-label="Search"><Search size={16} /></button>
                </div>
                {searching && <p className="text-sm text-ink-muted">Searching…</p>}
                {results.map(u => (
                  <div key={u.uid} className="flex items-center gap-3 bg-card border border-cream-dark rounded-2xl p-3">
                    <Avatar settings={avatarOf(u)} name={u.username} size={38} />
                    <div className="flex-1 min-w-0"><div className="font-medium text-ink truncate">{u.displayName}</div><div className="text-xs text-ink-muted">@{u.username}</div></div>
                    {friends.some(f => f.uid === u.uid) ? <span className="text-xs text-ink-muted">Friends</span>
                      : sentTo.includes(u.uid) ? <span className="text-xs text-ink-muted">Sent</span>
                      : <button onClick={() => doSend(u)} className="flex items-center gap-1 text-sm text-terra border border-terra-light hover:border-terra rounded-full px-3 py-1.5 transition-colors"><UserPlus size={14} /> Add</button>}
                  </div>
                ))}
                {!searching && term && results.length === 0 && <p className="text-sm text-ink-muted">No one found with that username.</p>}
              </>)}
              {tab === 'requests' && (<>
                {requests.length === 0 && <p className="text-sm text-ink-muted">No pending requests.</p>}
                {requests.map(r => (
                  <div key={r.fromUid} className="flex items-center gap-3 bg-card border border-cream-dark rounded-2xl p-3">
                    <div className="flex-1 min-w-0"><div className="font-medium text-ink truncate">{r.fromName}</div><div className="text-xs text-ink-muted">@{r.fromUsername}</div></div>
                    <button onClick={() => doAccept(r)} className="w-8 h-8 rounded-full bg-terra text-cream flex items-center justify-center" aria-label="Accept"><Check size={15} /></button>
                    <button onClick={() => doDecline(r)} className="w-8 h-8 rounded-full bg-cream-dark text-ink flex items-center justify-center" aria-label="Decline"><X size={15} /></button>
                  </div>
                ))}
              </>)}
              {tab === 'friends' && (<>
                {friends.length === 0 && <p className="text-sm text-ink-muted">No friends yet — use Find to add some.</p>}
                {friends.map(f => (
                  <div key={f.uid} className="bg-card border border-cream-dark rounded-2xl p-3">
                    <div className="flex items-center gap-3">
                      <Avatar settings={avatarOf(f)} name={f.username} size={38} />
                      <div className="flex-1 min-w-0"><div className="font-medium text-ink truncate">{f.displayName}</div><div className="text-xs text-ink-muted">@{f.username}</div></div>
                      <button onClick={() => doRemove(f)} className="text-ink-muted hover:text-terra transition-colors p-1" aria-label="Remove friend"><Trash2 size={15} /></button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => openShare(f)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-terra border border-terra-light hover:border-terra rounded-xl py-2 transition-colors"><Bell size={14} strokeWidth={2} /> Share reminder</button>
                      <button onClick={() => openNotepad(f)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-terra border border-terra-light hover:border-terra rounded-xl py-2 transition-colors"><Pencil size={14} strokeWidth={2} /> Notepad</button>
                    </div>
                  </div>
                ))}
              </>)}
              {tab === 'board' && (<>
                <p className="text-xs text-ink-muted mb-1">You and your friends, ranked by XP.</p>
                {[{ uid: me.uid, displayName: me.displayName + ' (you)', username: me.username, xp: game.xp, streak: game.streak, avatarType: me.avatarType, avatarPreset: me.avatarPreset, avatarColor: me.avatarColor, avatarPhoto: me.avatarPhoto } as any, ...friends]
                  .sort((a, b) => (b.xp || 0) - (a.xp || 0))
                  .map((p, i) => (
                    <div key={p.uid} className="flex items-center gap-3 bg-card border border-cream-dark rounded-2xl p-3">
                      <div className="w-6 text-center font-display text-lg text-ink-muted">{i + 1}</div>
                      <Avatar settings={avatarOf(p)} name={p.username} size={36} />
                      <div className="flex-1 min-w-0"><div className="font-medium text-ink truncate">{p.displayName}</div><div className="text-xs text-ink-muted flex items-center gap-1"><Flame size={11} className={p.streak ? 'text-terra' : 'text-ink-muted'} /> {p.streak || 0} · Lv {level(p.xp)}</div></div>
                      <div className="text-sm font-medium text-terra">{p.xp || 0} XP</div>
                    </div>
                  ))}
              </>)}
            </div>
          </div>
        )}

        {/* share-a-reminder mini form */}
        {sharing && (
          <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm" onClick={() => setSharing(null)}>
            <div className="bg-cream w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl border border-cream-dark p-6 animate-slide-down" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-xl text-ink font-medium">Share with {sharing.displayName}</h3>
                <button onClick={() => setSharing(null)} className="text-ink-muted hover:text-ink p-1"><X size={18} /></button>
              </div>
              {/* New vs Select existing */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => setShareMode('new')} className={`py-2 rounded-xl border-2 text-sm font-medium transition-colors ${shareMode === 'new' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}>New</button>
                <button onClick={() => setShareMode('select')} className={`py-2 rounded-xl border-2 text-sm font-medium transition-colors ${shareMode === 'select' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}>Select</button>
              </div>
              {shareMode === 'new' ? (
                <div className="space-y-3">
                  <input value={srTitle} onChange={e => setSrTitle(e.target.value)} placeholder="Reminder title" className={fInput} autoFocus />
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={srDate} onChange={e => setSrDate(e.target.value)} className={fInput} />
                    <input type="time" value={srTime} onChange={e => setSrTime(e.target.value)} className={fInput} />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[['none', 'Once'], ['daily', 'Daily'], ['weekly', 'Weekly']].map(([v, l]) => (
                      <button key={v} onClick={() => setSrRepeat(v)} className={`py-2 rounded-xl border-2 text-sm font-medium transition-colors ${srRepeat === v ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}>{l}</button>
                    ))}
                  </div>
                  <button onClick={submitShare} className="w-full py-3 rounded-full bg-terra text-cream font-medium hover:bg-terra-dark transition-colors">Share reminder</button>
                  <p className="text-[11px] text-ink-muted text-center">It shows up for both of you and reminds you both.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {reminders.filter(r => !r.dismissed && !r.shared).length === 0 && <p className="text-sm text-ink-muted text-center py-4">You have no reminders to share yet.</p>}
                  {reminders.filter(r => !r.dismissed && !r.shared).map(r => (
                    <button key={r.id} onClick={() => shareExisting(r)} className="w-full text-left bg-card border border-cream-dark rounded-2xl p-3 hover:border-terra transition-colors">
                      <div className="font-medium text-ink text-sm truncate">{r.title}</div>
                      <div className="text-xs text-ink-muted mt-0.5">{new Date(r.triggerAt).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}{r.repeat && r.repeat !== 'none' ? ` · ${r.repeat}` : ''}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  // ============ AUTH STATE ============
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(isAlertWindow); // alert window skips auth
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  // ============ GAMIFICATION STATE ============
  const [game, setGame] = useState<GameState>(DEFAULT_GAME);
  const [showStats, setShowStats] = useState(false);
  const [toast, setToast] = useState<string>('');       // achievement / unlock toast
  const [confettiOn, setConfettiOn] = useState(false);   // one-shot celebration burst
  const [rewardBanner, setRewardBanner] = useState<string>(''); // custom-reward achieved

  // ============ NAVIGATION (sidebar + windowed panels) ============
  const [showSidebar, setShowSidebar] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [cloudUid, setCloudUid] = useState<string | null>(null);
  const [sharedReminders, setSharedReminders] = useState<any[]>([]);
  const [openSpace, setOpenSpace] = useState<{ id: string; withName: string } | null>(null);
  const [settingsCat, setSettingsCat] = useState('account'); // active settings category
  const anyPanelOpen = showSettings || showStats || showNotepad || showFriends || !!openSpace;
  const closeAllPanels = () => { setShowSettings(false); setShowStats(false); setShowNotepad(false); setShowFriends(false); setOpenSpace(null); };

  // shared reminders (from friends) mapped into the same shape as local ones
  const sharedAsReminders = sharedReminders.map((s: any) => ({
    id: s.id, title: s.title, description: s.description, triggerAt: s.triggerAt,
    repeat: s.repeat, dismissed: false, shared: true, sharedId: s.id, withName: s.withName,
  }));

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
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const remindersRef = useRef<any[]>([]); // latest reminders, for stable IPC callbacks
  useEffect(() => { remindersRef.current = reminders; }, [reminders]);

  // profile photo upload → dataURL stored in settings
  const onAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setSettings(s => ({ ...s, avatarType: 'photo', avatarPhoto: r.result as string }));
    r.readAsDataURL(f);
  };

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
    // gamification: per-account progress lives in localStorage so it persists everywhere
    try {
      const raw = localStorage.getItem(`lull-game-${u.username.toLowerCase()}`);
      setGame(raw ? { ...DEFAULT_GAME, ...JSON.parse(raw) } : DEFAULT_GAME);
    } catch { setGame(DEFAULT_GAME); }
    try {
      const rawN = localStorage.getItem(`lull-notes-${u.username.toLowerCase()}`);
      setNotes(rawN ? JSON.parse(rawN) : []);
    } catch { setNotes([]); }
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

  // persist gamification progress to localStorage whenever it changes
  useEffect(() => {
    if (!loaded || isAlertWindow || !user) return;
    try { localStorage.setItem(`lull-game-${user.username.toLowerCase()}`, JSON.stringify(game)); } catch { /* quota */ }
  }, [game, loaded]);

  // persist notepad notes to localStorage whenever they change
  useEffect(() => {
    if (!loaded || isAlertWindow || !user) return;
    try { localStorage.setItem(`lull-notes-${user.username.toLowerCase()}`, JSON.stringify(notes)); } catch { /* quota */ }
  }, [notes, loaded]);

  // cloud auth at app level (verified users only) — powers shared reminders on the home screen
  useEffect(() => {
    if (isAlertWindow) return;
    const off = social.watchCloudAuth(u => setCloudUid(u ? u.uid : null));
    return () => off();
  }, []);
  // live subscription to shared reminders that include me
  useEffect(() => {
    if (isAlertWindow || !cloudUid) { setSharedReminders([]); return; }
    const off = social.watchSharedReminders(cloudUid, list => setSharedReminders(list));
    return () => off();
  }, [cloudUid]);

  // keep my cloud profile (avatar, name, XP, streak) current for friends + leaderboard
  useEffect(() => {
    if (isAlertWindow || !cloudUid || !loaded || !user) return;
    social.updateMyProfile(cloudUid, {
      displayName: settings.displayName || user.username,
      avatarType: settings.avatarType, avatarPreset: settings.avatarPreset, avatarColor: settings.avatarColor,
      avatarPhoto: settings.avatarPhoto, profileVisible: settings.profileVisible,
      xp: game.xp, streak: game.streak,
    }).catch(() => {});
  }, [cloudUid, game.xp, game.streak, settings.displayName, settings.avatarType, settings.avatarPreset, settings.avatarColor, settings.avatarPhoto, settings.profileVisible, loaded]);

  // Record a completed reminder: award XP, extend the streak if on time, and
  // surface a toast for any freshly-unlocked achievement. Used by every "done" path.
  const recordCompletion = (r: any) => {
    if (isAlertWindow) return;
    const nowTs = Date.now();
    const onTime = Math.abs(nowTs - (r?.triggerAt ?? nowTs)) <= ONTIME_WINDOW_MS;
    // which seasonal/holiday icon this completion counts toward
    const period = iconThemeOf(new Date(nowTs));
    const iconExists = APP_ICONS.some(ic => ic.key === period && ic.period !== 'any');
    const newCount = (game.iconProgress[period] || 0) + 1;
    const alreadyUnlocked = settings.unlockedIcons.includes(period);

    setGame(g => {
      const { next, unlocked } = applyCompletion(g, onTime, nowTs);
      next.iconProgress = { ...next.iconProgress, [period]: (next.iconProgress[period] || 0) + 1 };
      if (unlocked.length) {
        const first = ACHIEVEMENTS.find(a => a.id === unlocked[0]);
        if (first) setToast(`Achievement unlocked — ${first.label}`);
      }
      return next;
    });

    // Complete enough reminders during a season/holiday and its app icon is
    // yours to keep, forever. App icons only exist on mobile.
    if (isNative && iconExists && !alreadyUnlocked && newCount >= ICON_UNLOCK_THRESHOLD) {
      const label = APP_ICONS.find(ic => ic.key === period)?.label || period;
      setSettings(s => s.unlockedIcons.includes(period) ? s : { ...s, unlockedIcons: [...s.unlockedIcons, period] });
      setToast(`New app icon unlocked — ${label}! 🎉`);
    }
  };

  // Record a missed reminder (deleted while overdue).
  const recordMiss = (r: any) => {
    if (isAlertWindow) return;
    if (!r || r.dismissed || r.triggerAt > Date.now()) return;
    setGame(g => applyMiss(g, Date.now()));
  };

  // iOS: (re)schedule OS local notifications whenever the reminder list changes.
  // No-op on desktop, so the Electron alert path is untouched.
  useEffect(() => {
    if (isAlertWindow || !isNative) return;
    syncReminderNotifications([...reminders, ...sharedAsReminders], {
      sound: settings.notifSound,
      vibrate: settings.vibrate,
      strongAlert: settings.strongAlert,
    });
  }, [reminders, sharedReminders, settings.notifSound, settings.vibrate, settings.strongAlert]);

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

  // manual mode: if the set seasonal/holiday icon is now out of its window, revert to default
  useEffect(() => {
    if (!isNative || !loaded || settings.autoAppIcon) return;
    const ic = APP_ICONS.find(a => a.key === settings.appIcon);
    if (!ic) return;
    const avail = ic.period === 'any' || ic.period === iconThemeOf(new Date()) || ic.period === seasonOf(new Date()).label.toLowerCase();
    if (!avail) { setSettings(s => ({ ...s, appIcon: 'default' })); applyAppIcon('default'); }
  }, [loaded]);

  // seasonal auto-switch (#134): set the icon matching today's holiday/season when enabled
  useEffect(() => {
    if (!isNative || !loaded || !settings.autoAppIcon) return;
    const it = iconThemeOf(new Date());
    const target = APP_ICONS.some(a => a.key === it) ? it : seasonOf(new Date()).label.toLowerCase();
    if (settings.appIcon !== target) { setSettings(s => ({ ...s, appIcon: target })); applyAppIcon(target); }
  }, [loaded, settings.autoAppIcon]);

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
    const due = [...reminders.filter(r => !r.dismissed), ...sharedAsReminders].find(r => r.triggerAt <= now);
    if (due) {
      setActiveAlert(due);
      playChime();
      showNotification(due);
      if (!due.shared) ipc?.send('show-alert', due); // shared reminders alert in-app (dismiss syncs to the cloud)
    }
  }, [now, reminders, activeAlert, sharedReminders]);

  // listen for actions sent back from the alert window
  useEffect(() => {
    if (isAlertWindow) return;
    if (!ipc) return;
    const off = ipc.on('alert-action', (action: 'dismiss' | 'snooze', reminderId: number) => {
      if (action === 'dismiss') {
        const done = remindersRef.current.find(r => r.id === reminderId);
        if (done) recordCompletion(done);
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
    const picked = new Date(`${date}T${time}:00`).getTime();
    const triggerAt = firstValidTrigger(picked, repeat, Date.now());
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

  // Completing/advancing a shared reminder syncs to the cloud for both people.
  const completeShared = (sr: any) => {
    recordCompletion(sr);
    if (isRecurring(sr)) social.updateSharedReminder(sr.sharedId, { triggerAt: nextReminderTrigger(sr.triggerAt, sr.repeat, Date.now()) }).catch(() => {});
    else social.deleteSharedReminder(sr.sharedId).catch(() => {});
  };

  const dismiss = () => {
    if (isAlertWindow) {
      ipc?.send('alert-action', 'dismiss', alertData.id);
    } else if (activeAlert) {
      if (activeAlert.shared) { completeShared(activeAlert); setActiveAlert(null); return; }
      recordCompletion(activeAlert);
      setReminders(rs => rs.map(r => r.id === activeAlert.id
        ? (isRecurring(r) ? { ...r, triggerAt: nextReminderTrigger(r.triggerAt, r.repeat, Date.now()) } : { ...r, dismissed: true })
        : r));
      setActiveAlert(null);
    }
  };

  // Mark a reminder done straight from its card (works on desktop and mobile).
  const completeReminder = (id: number | string) => {
    const sr = sharedAsReminders.find(x => x.id === id);
    if (sr) { completeShared(sr); return; }
    const r = remindersRef.current.find(x => x.id === id);
    if (r) recordCompletion(r);
    setReminders(rs => rs.map(x => x.id === id
      ? (isRecurring(x) ? { ...x, triggerAt: nextReminderTrigger(x.triggerAt, x.repeat, Date.now()) } : { ...x, dismissed: true })
      : x));
  };

  const snooze = () => {
    if (isAlertWindow) {
      ipc?.send('alert-action', 'snooze', alertData.id);
    } else if (activeAlert) {
      const newTrigger = Date.now() + 5 * 60 * 1000;
      if (activeAlert.shared) { social.updateSharedReminder(activeAlert.sharedId, { triggerAt: newTrigger }).catch(() => {}); setActiveAlert(null); return; }
      const id = activeAlert.id;
      setReminders(rs => rs.map(r => r.id === id ? { ...r, triggerAt: newTrigger, dismissed: false } : r));
      setActiveAlert(null);
    }
  };

  const deleteReminder = (id: number | string) => {
    const sr = sharedAsReminders.find(x => x.id === id);
    if (sr) { social.deleteSharedReminder(sr.sharedId).catch(() => {}); return; }
    const r = remindersRef.current.find(x => x.id === id);
    if (r) recordMiss(r); // deleting an overdue reminder counts as a miss
    setReminders(rs => rs.filter(x => x.id !== id));
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setReminders([]);
    setTasks([]);
    setSettings(DEFAULT_SETTINGS);
    setGame(DEFAULT_GAME);
    setNotes([]);
    setLoaded(false);
    setShowSettings(false);
    setShowStats(false);
    setShowNotepad(false);
    setShowFriends(false);
    setShowSidebar(false);
    social.cloudSignOut().catch(() => {});
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
  // Resolve the timezone: 'auto' (or auto-toggle) follows this device; otherwise
  // an explicit IANA zone the user picked in settings.
  const activeTz = (settings.autoTimezone || !settings.timezone || settings.timezone === 'auto')
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : settings.timezone;
  const tzLabel = (settings.autoTimezone || settings.timezone === 'auto') ? 'Local time' : activeTz.split('/').pop()?.replace(/_/g, ' ') || 'Time';
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: activeTz });
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: activeTz });

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

  const upcoming = [...reminders.filter(r => !r.dismissed), ...sharedAsReminders].sort((a, b) => a.triggerAt - b.triggerAt);
  const ukNow = fmtTime(now);
  const themeClass = `theme-${settings.theme}`;

  // ---- gamification derived values ----
  const todayKey = dayKey(now);
  const todayStat = game.history[todayKey] || { completed: 0, missed: 0 };
  const doneToday = todayStat.completed;
  // reminders still scheduled to fire today (not yet done)
  const pendingToday = reminders.filter(r => !r.dismissed && dayKey(r.triggerAt) === todayKey).length;
  const dueToday = doneToday + pendingToday;
  const progressPct = dueToday > 0 ? Math.round((doneToday / dueToday) * 100) : 0;
  const lvl = levelFromXp(game.xp);

  // Confetti when the last of today's reminders is cleared (once per day).
  useEffect(() => {
    if (isAlertWindow || !loaded) return;
    if (doneToday > 0 && pendingToday === 0 && game.celebratedDay !== todayKey) {
      setGame(g => ({ ...g, celebratedDay: todayKey }));
      if (settings.microAnimations !== false) {
        setConfettiOn(true);
        setTimeout(() => setConfettiOn(false), 2600);
      }
    }
  }, [doneToday, pendingToday, loaded]);

  // Custom reward: fire the banner once the goal is reached.
  useEffect(() => {
    if (isAlertWindow || !loaded) return;
    const rw = game.reward;
    if (!rw || rw.claimed) return;
    const reached = rw.goalType === 'completions' ? game.completedTotal >= rw.goal : game.bestStreak >= rw.goal;
    if (reached) setRewardBanner(rw.text || 'You hit your goal!');
  }, [game.completedTotal, game.bestStreak, game.reward, loaded]);

  // Auto-clear the achievement toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3600);
    return () => clearTimeout(t);
  }, [toast]);
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

      /* ===== Confetti celebration ===== */
      @keyframes lull-confetti {
        0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(108vh) rotate(720deg); opacity: 0.9; }
      }

      /* ===== Sidebar slide-in ===== */
      @keyframes slide-left { from { transform: translateX(100%); } to { transform: translateX(0); } }
      .animate-slide-left { animation: slide-left 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }

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

        {confettiOn && (
          <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden="true">
            {CONFETTI_PIECES.map((c, i) => (
              <span
                key={i}
                style={{
                  position: 'absolute', top: '-5%', left: `${c.left}%`,
                  width: c.size, height: c.size * 1.6, background: c.color,
                  borderRadius: 2, opacity: 0.9,
                  animation: `lull-confetti ${c.dur}s ${c.delay}s ease-in forwards`,
                }}
              />
            ))}
          </div>
        )}

        {toast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-ink text-cream rounded-full px-5 py-3 shadow-xl flex items-center gap-2 animate-slide-down"
               style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <Trophy size={16} className="text-terra-light" strokeWidth={2}/>
            <span className="text-sm font-medium">{toast}</span>
          </div>
        )}

        {rewardBanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ink/40 backdrop-blur-sm" onClick={() => setRewardBanner('')}>
            <div className="bg-cream rounded-3xl max-w-sm w-full p-8 text-center border-2 border-terra animate-slide-down" onClick={e => e.stopPropagation()}>
              <Gift size={40} className="text-terra mx-auto mb-4" strokeWidth={1.6}/>
              <h3 className="font-display text-2xl text-ink mb-2">Reward unlocked!</h3>
              <p className="text-ink-muted mb-6">{rewardBanner}</p>
              <button
                onClick={() => { setGame(g => g.reward ? { ...g, reward: { ...g.reward, claimed: true } } : g); setRewardBanner(''); }}
                className="bg-terra text-cream rounded-full px-6 py-3 font-medium hover:bg-terra-dark transition-colors"
              >
                Claim it
              </button>
            </div>
          </div>
        )}

        {/* ============ HOME BUTTON (shown while a panel is open) ============ */}
        {anyPanelOpen && (
          <button
            onClick={closeAllPanels}
            className="fixed top-5 left-5 z-[60] bg-card border border-cream-dark rounded-full h-11 px-4 flex items-center gap-2 shadow-lg text-ink hover:text-terra hover:border-terra transition-colors"
            style={{ marginTop: 'env(safe-area-inset-top)', marginLeft: 'env(safe-area-inset-left)' }}
            aria-label="Back to home"
          >
            <Home size={17} strokeWidth={2}/>
            <span className="text-sm font-medium">Home</span>
          </button>
        )}

        {/* ============ RIGHT SIDEBAR ============ */}
        {showSidebar && (
          <div className="fixed inset-0 z-[55]" role="dialog" aria-label="Menu">
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px] animate-fade-in" onClick={() => setShowSidebar(false)} />
            <aside
              className="absolute top-0 right-0 h-full w-[86%] max-w-sm bg-cream border-l border-cream-dark shadow-2xl flex flex-col animate-slide-left"
              style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* account header */}
              <div className="p-6 border-b border-cream-dark flex items-center gap-4">
                <Avatar settings={settings} name={user.username} size={54} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl text-ink font-medium truncate">{settings.displayName || user.username}</div>
                  <div className="text-xs text-ink-muted mt-0.5 flex items-center gap-2">
                    <Flame size={12} className={game.streak > 0 ? 'text-terra' : 'text-ink-muted'} strokeWidth={2}/> {game.streak}-day streak · Lv {lvl.level}
                  </div>
                </div>
                <button onClick={() => setShowSidebar(false)} className="text-ink-muted hover:text-ink transition-colors p-1.5 -mr-1" aria-label="Close menu">
                  <X size={20}/>
                </button>
              </div>

              {/* nav */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {[
                  { key: 'home',    label: 'Home',        icon: Home,      onClick: () => { closeAllPanels(); setShowSidebar(false); } },
                  { key: 'stats',   label: 'Stats & achievements', icon: Trophy, onClick: () => { closeAllPanels(); setShowStats(true); setShowSidebar(false); } },
                  { key: 'notepad', label: 'Notepad',     icon: Pencil,    onClick: () => { closeAllPanels(); setShowNotepad(true); setShowSidebar(false); } },
                  { key: 'friends', label: 'Friends',     icon: Users,     onClick: () => { closeAllPanels(); setShowFriends(true); setShowSidebar(false); } },
                  { key: 'settings',label: 'Settings',    icon: Settings,  onClick: () => { closeAllPanels(); setShowSettings(true); setShowSidebar(false); } },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-ink hover:bg-card border border-transparent hover:border-cream-dark transition-colors text-left"
                  >
                    <item.icon size={19} strokeWidth={1.9} className="text-terra"/>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>

              {/* footer: logout */}
              <div className="p-4 border-t border-cream-dark">
                <button
                  onClick={() => { setShowSidebar(false); handleLogout(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-cream-dark text-ink hover:border-terra hover:text-terra transition-colors font-medium"
                >
                  <LogOut size={16} strokeWidth={2}/> Log out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* ============ NOTEPAD (constellation of gradient notes) ============ */}
        {showNotepad && (
          <NotepadPanel notes={notes} setNotes={setNotes} theme={settings.theme} onClose={() => setShowNotepad(false)} />
        )}

        {/* ============ FRIENDS (cloud account) ============ */}
        {showFriends && (
          <FriendsPanel localUsername={user.username} settings={settings} game={game} reminders={reminders} onOpenSpace={(id, withName) => { setShowFriends(false); setOpenSpace({ id, withName }); }} onClose={() => setShowFriends(false)} />
        )}

        {/* ============ SHARED NOTEPAD ============ */}
        {openSpace && (
          <SharedNotepad space={openSpace} theme={settings.theme} onClose={() => setOpenSpace(null)} />
        )}

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
              <button
                onClick={() => setShowStats(true)}
                className="bg-card rounded-full px-4 py-3 border border-cream-dark flex items-center gap-3 shadow-sm hover:border-terra transition-colors"
                aria-label="Stats & achievements"
                title="Stats, streak & achievements"
              >
                <span className="flex items-center gap-1.5" title={`${game.streak}-day streak`}>
                  <Flame
                    size={18 + Math.min(game.streak, 10)}
                    strokeWidth={1.8}
                    className={game.streak > 0 ? 'text-terra' : 'text-ink-muted'}
                    style={game.streak > 0 ? { filter: `drop-shadow(0 0 ${Math.min(game.streak, 8)}px rgba(200,90,40,0.55))` } : undefined}
                  />
                  <span className="font-display text-base font-semibold leading-none">{game.streak}</span>
                </span>
                <span className="w-px h-6 bg-cream-dark"/>
                <span className="text-left leading-none">
                  <span className="block font-display text-sm font-semibold">Lv {lvl.level}</span>
                  <span className="block text-[10px] uppercase tracking-wider text-ink-muted mt-0.5">{game.xp} XP</span>
                </span>
              </button>
              <div className="bg-card rounded-full px-5 py-3 border border-cream-dark flex items-center gap-3 shadow-sm lull-clock">
                <Clock size={16} className="text-terra" strokeWidth={1.8}/>
                <div className="text-right">
                  <div className="font-display text-lg leading-none font-medium">{ukNow}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted mt-0.5">{tzLabel}</div>
                </div>
              </div>
              <button
                onClick={() => setShowSidebar(true)}
                className="bg-card rounded-full h-12 pl-1.5 pr-4 border border-cream-dark flex items-center gap-2 shadow-sm text-ink-muted hover:text-terra hover:border-terra transition-colors"
                aria-label="Open menu"
                title="Menu"
              >
                <Avatar settings={settings} name={user.username} size={36} />
                <span className="hidden sm:block text-sm font-medium text-ink max-w-[8rem] truncate">{settings.displayName || user.username}</span>
              </button>
            </div>
          </header>

          <div className="mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <h2 className="font-display text-2xl sm:text-3xl text-ink-muted italic font-light">
              What do you want to remember?
            </h2>
          </div>

          {dueToday > 0 && (
            <div className="mb-10 animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-ink-muted">Today's progress</span>
                <span className="text-xs font-medium text-ink">
                  {doneToday} of {dueToday} done{progressPct === 100 ? ' · all clear! ✨' : ''}
                </span>
              </div>
              <div className="h-3 rounded-full bg-cream-dark overflow-hidden">
                <div
                  className="h-full rounded-full bg-terra transition-all duration-700 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

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
                      {r.shared && (
                        <div className="bg-terra text-cream text-[10px] font-medium px-2.5 py-1 rounded-full inline-block mb-2 ml-1 uppercase tracking-wider">
                          Shared · {r.withName}
                        </div>
                      )}
                      {isRecurring(r) && (
                        <div className="bg-cream-dark text-ink-muted text-[10px] font-medium px-2.5 py-1 rounded-full inline-block mb-2 ml-1 uppercase tracking-wider">
                          {repeatLabel(r.repeat)}
                        </div>
                      )}
                      <div className="bg-terra-light text-terra-dark text-xs font-medium px-3 py-1.5 rounded-full inline-block mb-2">
                        {fmtCountdown(r.triggerAt)}
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => completeReminder(r.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-terra hover:text-terra-dark border border-terra-light hover:border-terra rounded-full px-2.5 py-1 transition-colors"
                          aria-label="Mark done"
                          title="Mark done (+XP)"
                        >
                          <Sparkles size={12} strokeWidth={2}/> Done
                        </button>
                        <button
                          onClick={() => deleteReminder(r.id)}
                          className="text-ink-muted hover:text-terra transition-colors p-1"
                          aria-label="Delete reminder"
                        >
                          <Trash2 size={14} strokeWidth={1.8}/>
                        </button>
                      </div>
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
                  <div className="grid grid-cols-3 gap-2">
                    {[['none', 'Once'], ['daily', 'Daily'], ['weekdays', 'Weekdays'], ['weekends', 'Weekends'], ['weekly', 'Weekly']].map(([v, l]) => (
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
        {showStats && (() => {
          const total = game.completedTotal + game.missedTotal;
          const rate = total > 0 ? Math.round((game.completedTotal / total) * 100) : 0;
          // last 7 days for the mini bar chart
          const days = Array.from({ length: 7 }, (_, k) => {
            const key = dayKey(now - (6 - k) * 86400000);
            const s = game.history[key] || { completed: 0, missed: 0 };
            const label = new Date(now - (6 - k) * 86400000).toLocaleDateString('en-GB', { weekday: 'narrow' });
            return { key, label, ...s };
          });
          const maxDay = Math.max(1, ...days.map(d => d.completed));
          return (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in lull-modal-overlay" style={{ background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' }}>
              <div className="bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark lull-modal" style={{ boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)' }}>
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">Your progress</p>
                    <h2 className="font-display text-4xl font-light text-ink">Stats & <span className="italic text-terra">streaks</span></h2>
                  </div>
                  <button onClick={() => setShowStats(false)} className="text-ink-muted hover:text-ink transition-colors p-2">
                    <X size={22}/>
                  </button>
                </div>

                {/* level + xp */}
                <div className="bg-card rounded-2xl border border-cream-dark p-5 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-display text-lg font-medium">Level {lvl.level}</span>
                    <span className="text-xs text-ink-muted">{game.xp} XP total</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-cream-dark overflow-hidden">
                    <div className="h-full bg-terra rounded-full" style={{ width: `${Math.round((lvl.into / lvl.span) * 100)}%` }}/>
                  </div>
                  <div className="text-[11px] text-ink-muted mt-1.5">{lvl.span - lvl.into} XP to level {lvl.level + 1}</div>
                </div>

                {/* headline numbers */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-card rounded-2xl border border-cream-dark p-4 text-center">
                    <Flame size={18} className="text-terra mx-auto mb-1" strokeWidth={1.8}/>
                    <div className="font-display text-2xl font-medium">{game.streak}</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted">Streak</div>
                  </div>
                  <div className="bg-card rounded-2xl border border-cream-dark p-4 text-center">
                    <Sparkles size={18} className="text-terra mx-auto mb-1" strokeWidth={1.8}/>
                    <div className="font-display text-2xl font-medium">{game.completedTotal}</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted">Done</div>
                  </div>
                  <div className="bg-card rounded-2xl border border-cream-dark p-4 text-center">
                    <TrendingUp size={18} className="text-terra mx-auto mb-1" strokeWidth={1.8}/>
                    <div className="font-display text-2xl font-medium">{rate}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted">On-rate</div>
                  </div>
                </div>

                {/* 7-day chart */}
                <div className="bg-card rounded-2xl border border-cream-dark p-5 mb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 size={16} className="text-terra" strokeWidth={1.8}/>
                    <span className="text-xs uppercase tracking-wider text-ink-muted">Last 7 days</span>
                  </div>
                  <div className="flex items-end justify-between gap-2 h-24">
                    {days.map(d => (
                      <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex items-end justify-center" style={{ height: '72px' }}>
                          <div className="w-full max-w-[22px] rounded-t-md bg-terra transition-all"
                               style={{ height: `${(d.completed / maxDay) * 100}%`, minHeight: d.completed ? 4 : 0 }}
                               title={`${d.completed} done`}/>
                        </div>
                        <span className="text-[10px] text-ink-muted">{d.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-ink-muted mt-3">Best streak: {game.bestStreak} days · Missed: {game.missedTotal}</div>
                </div>

                {/* achievements */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy size={16} className="text-terra" strokeWidth={1.8}/>
                    <span className="text-xs uppercase tracking-wider text-ink-muted">Achievements ({game.achievements.length}/{ACHIEVEMENTS.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ACHIEVEMENTS.map(a => {
                      const got = game.achievements.includes(a.id);
                      return (
                        <div key={a.id} className={`rounded-2xl border p-3 ${got ? 'bg-terra-light border-terra' : 'bg-card border-cream-dark opacity-60'}`}>
                          <div className={`font-medium text-sm ${got ? 'text-terra-dark' : 'text-ink-muted'}`}>{got ? a.label : '🔒 ' + a.label}</div>
                          <div className="text-[11px] text-ink-muted mt-0.5">{a.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {showSettings && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-0 sm:p-6 animate-fade-in lull-modal-overlay" style={{ background: 'rgba(31, 36, 33, 0.35)', backdropFilter: 'blur(6px)' }}>
            <div className="bg-cream w-full h-full rounded-none sm:rounded-3xl sm:max-w-3xl sm:h-[86vh] border border-cream-dark shadow-2xl overflow-hidden animate-slide-down lull-modal flex flex-col" style={{ boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              {/* window title bar */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-cream-dark">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-terra" strokeWidth={1.9}/>
                  <h2 className="font-display text-xl text-ink font-medium">Settings</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-ink-muted hover:text-ink transition-colors p-1.5" aria-label="Close settings"><X size={20}/></button>
              </div>

              <div className="flex-1 flex flex-col sm:flex-row min-h-0">
                <div className="order-2 sm:order-1 flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

                  {settingsCat === 'account' && (<>
                    <div className="flex items-center gap-4 bg-card rounded-2xl p-4 border border-cream-dark">
                      <Avatar settings={settings} name={user.username} size={48} />
                      <div className="min-w-0">
                        <div className="font-display text-lg text-ink font-medium truncate">{user.username}</div>
                        <div className="text-xs text-ink-muted">Signed in</div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Display name</label>
                      <input type="text" value={settings.displayName} onChange={e => setSettings(s => ({ ...s, displayName: e.target.value }))} placeholder="What should we call you?" className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors font-display text-lg" />
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Profile picture</label>
                      <div className="flex items-center gap-4 mb-3">
                        <Avatar settings={settings} name={user.username} size={64} />
                        <div className="flex-1">
                          <Segmented value={settings.avatarType} onChange={v => setSettings(s => ({ ...s, avatarType: v as any }))} options={[{ value: 'monogram', label: 'Letter' }, { value: 'preset', label: 'Preset' }, { value: 'photo', label: 'Photo' }]} />
                        </div>
                      </div>
                      {settings.avatarType === 'monogram' && (
                        <div className="flex flex-wrap gap-2">
                          {['#C8553D','#D98E48','#6B8F71','#3D7EA6','#8C6BA9','#C85B7C','#4FA890','#2B2B2B'].map(col => (
                            <button key={col} type="button" onClick={() => setSettings(s => ({ ...s, avatarColor: col }))} className={`w-9 h-9 rounded-full border-2 ${settings.avatarColor === col ? 'border-ink' : 'border-transparent'}`} style={{ background: col }} aria-label={col} />
                          ))}
                        </div>
                      )}
                      {settings.avatarType === 'preset' && (
                        <div className="flex flex-wrap gap-2">
                          {Object.keys(AVATAR_PRESETS).map(k => (
                            <button key={k} type="button" onClick={() => setSettings(s => ({ ...s, avatarPreset: k }))} className={`w-9 h-9 rounded-full border-2 ${settings.avatarPreset === k ? 'border-ink' : 'border-transparent'}`} style={{ background: AVATAR_PRESETS[k] }} aria-label={k} />
                          ))}
                        </div>
                      )}
                      {settings.avatarType === 'photo' && (
                        <div>
                          <input ref={avatarInputRef} type="file" accept="image/*" onChange={onAvatarFile} className="hidden" />
                          <button onClick={() => avatarInputRef.current?.click()} className="inline-flex items-center gap-2 bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink hover:border-terra transition-colors text-sm font-medium">
                            <Upload size={15} strokeWidth={2}/> {settings.avatarPhoto ? 'Change photo' : 'Upload photo'}
                          </button>
                          {settings.avatarPhoto && (
                            <button onClick={() => setSettings(s => ({ ...s, avatarPhoto: '', avatarType: 'monogram' }))} className="ml-2 text-sm text-ink-muted hover:text-terra transition-colors">Remove</button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex"><ToggleRow label="Show my profile picture to friends" value={!!settings.profileVisible} onChange={v => setSettings(s => ({ ...s, profileVisible: v }))} /></div>
                    <p className="text-xs text-ink-muted -mt-1">Off by default. Applies when friends arrive in a future update.</p>
                  </>)}

                  {settingsCat === 'customization' && (<>
                    {/* live preview of the current theme / background / pattern */}
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Preview</label>
                      <div className={`theme-${settings.theme} rounded-2xl overflow-hidden border border-cream-dark relative`} style={{ height: 156, background: resolveBackground(settings, now) }}>
                        {settings.pattern && settings.pattern !== 'none' && (
                          <div className="absolute inset-0 pointer-events-none" style={patternStyle(settings)} aria-hidden="true" />
                        )}
                        <div className="relative h-full p-4 flex flex-col justify-between">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mb-1">{greetingText(settings, now)}</div>
                            <div className="font-display text-2xl text-ink font-light leading-none">Lull<span className="text-terra italic">.</span></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-card border border-cream-dark rounded-xl px-3 py-2 shadow-sm">
                              <div className="text-ink font-medium text-sm leading-tight">Morning walk</div>
                              <div className="text-ink-muted text-[11px] mt-0.5">in 2h 15m</div>
                            </div>
                            <div className="bg-terra text-cream rounded-full px-3 py-2 text-xs font-medium shadow-sm">New</div>
                          </div>
                        </div>
                      </div>
                      <p className="text-[11px] text-ink-muted mt-2">Updates live as you change the options below.</p>
                    </div>

                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Appearance</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setSettings(s => ({ ...s, theme: 'light' }))} className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-medium transition-all ${settings.theme === 'light' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}><Sun size={16} strokeWidth={2}/> Light</button>
                        <button onClick={() => setSettings(s => ({ ...s, theme: 'dark' }))} className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-medium transition-all ${settings.theme === 'dark' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}><Moon size={16} strokeWidth={2}/> Dark</button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Background</label>
                      <div className="grid grid-cols-5 gap-2">
                        {BACKGROUND_KEYS.map(k => {
                          const bg = BACKGROUNDS[k];
                          const g = bg ? bg[settings.theme === 'dark' ? 'dark' : 'light'] : 'linear-gradient(180deg, var(--page-top), var(--page-bottom))';
                          const active = !settings.zenMode && !settings.autoSeasonal && (settings.background || 'default') === k;
                          return (<button key={k} type="button" onClick={() => setSettings(s => ({ ...s, background: k, autoSeasonal: false, zenMode: false }))} className={`h-12 rounded-2xl border-2 transition-all ${active ? 'border-terra' : 'border-cream-dark'}`} style={{ background: g }} aria-label={k} />);
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Pattern</label>
                      <Segmented value={settings.pattern || 'none'} onChange={v => setSettings(s => ({ ...s, pattern: v }))} options={[{ value: 'none', label: 'None' }, { value: 'dots', label: 'Dots' }, { value: 'grid', label: 'Grid' }, { value: 'diagonal', label: 'Lines' }, { value: 'cross', label: 'Cross' }]} />
                    </div>
                    <div className="flex"><ToggleRow label={`Seasonal theme (${seasonOf(new Date()).label})`} value={!!settings.autoSeasonal} onChange={v => setSettings(s => ({ ...s, autoSeasonal: v, zenMode: v ? false : s.zenMode }))} /></div>
                    <div className="flex"><ToggleRow label="Zen mode (calm & minimal)" value={!!settings.zenMode} onChange={v => setSettings(s => ({ ...s, zenMode: v }))} /></div>
                    <div className="flex"><ToggleRow label="Micro-animations" value={settings.microAnimations !== false} onChange={v => setSettings(s => ({ ...s, microAnimations: v }))} /></div>
                    <div className="flex"><ToggleRow label="Ambient music (relaxing)" value={!!settings.music} onChange={v => setSettings(s => ({ ...s, music: v }))} /></div>
                  </>)}

                  {isNative && settingsCat === 'appicon' && (
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">App icon</label>
                      <div className="grid grid-cols-4 gap-3">
                        {APP_ICONS.map(ic => {
                          const inSeason = ic.period === 'any' || ic.period === iconThemeOf(new Date()) || ic.period === seasonOf(new Date()).label.toLowerCase();
                          const available = inSeason || settings.unlockedIcons.includes(ic.key);
                          return (
                            <button
                              key={ic.key}
                              type="button"
                              disabled={!available}
                              onClick={() => { if (!available) return; setSettings(s => ({ ...s, appIcon: ic.key, autoAppIcon: false })); applyAppIcon(ic.key); }}
                              className={`rounded-2xl border-2 p-1.5 transition-all ${settings.appIcon === ic.key ? 'border-terra' : 'border-cream-dark'} ${available ? '' : 'opacity-45'}`}
                              title={available ? ic.label : `${ic.label} — unlock by completing reminders in ${ic.label}`}
                            >
                              <div className="relative">
                                <img src={ic.preview} alt={ic.label} className="w-full aspect-square rounded-xl bg-cream-dark object-cover"/>
                                {!available && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-xl" style={{ background: 'rgba(31,36,33,0.35)' }}>
                                    <Lock size={16} className="text-cream"/>
                                  </div>
                                )}
                              </div>
                              <div className="text-[10px] text-center text-ink-muted mt-1 truncate">{ic.label}</div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-ink-muted mt-2">Changes your home-screen icon (device build only). Seasonal and holiday icons unlock during their season — or permanently once you complete a few reminders in them.</p>
                      <div className="flex mt-3"><ToggleRow label="Auto seasonal icon (by date)" value={!!settings.autoAppIcon} onChange={v => setSettings(s => ({ ...s, autoAppIcon: v }))} /></div>
                    </div>
                  )}

                  {settingsCat === 'sound' && (<>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Sound</label>
                      <button onClick={() => setSettings(s => ({ ...s, soundEnabled: !s.soundEnabled }))} className="w-full flex items-center justify-between bg-card border border-cream-dark rounded-2xl px-5 py-4 hover:border-terra transition-colors">
                        <span className="flex items-center gap-3 text-ink">{settings.soundEnabled ? <Volume2 size={18} className="text-terra" strokeWidth={1.8}/> : <VolumeX size={18} className="text-ink-muted" strokeWidth={1.8}/>}{settings.soundEnabled ? 'Chime & notification sound on' : 'Sound off'}</span>
                        <span className={`relative w-12 h-7 rounded-full transition-colors ${settings.soundEnabled ? 'bg-terra' : 'bg-cream-dark'}`}><span className={`absolute top-1 w-5 h-5 rounded-full bg-cream transition-all ${settings.soundEnabled ? 'left-6' : 'left-1'}`}/></span>
                      </button>
                    </div>
                    {isNative && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Notification sound</label>
                          <div className="mb-3">
                            <Segmented value={settings.soundPack} onChange={v => setSettings(st => { const files = (SOUND_PACKS[v] || SOUND_PACKS.all).files; return { ...st, soundPack: v, notifSound: files.includes(st.notifSound) ? st.notifSound : files[0] }; })} options={SOUND_PACK_KEYS.map(k => ({ value: k, label: SOUND_PACKS[k].label }))} />
                          </div>
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {visibleSounds.map(s => (
                              <div key={s.file} className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition-colors ${settings.notifSound === s.file ? 'border-terra bg-terra-light' : 'border-cream-dark'}`}>
                                <button onClick={() => playPreview(s.file)} className="w-9 h-9 rounded-full bg-card border border-cream-dark flex items-center justify-center text-terra shrink-0 hover:border-terra transition-colors" aria-label={`Preview ${s.label}`}><Play size={14} strokeWidth={2.4}/></button>
                                <button onClick={() => setSettings(st => ({ ...st, notifSound: s.file }))} className="flex-1 text-left text-ink font-medium text-sm">{s.label}</button>
                                {settings.notifSound === s.file && (<span className="text-[10px] uppercase tracking-wider text-terra font-medium">Selected</span>)}
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-ink-muted mt-2">Plays when a reminder fires. Tap ▶ to preview.</p>
                        </div>
                        <div className="flex"><ToggleRow label="Vibrate on reminders" value={settings.vibrate !== false} onChange={v => setSettings(st => ({ ...st, vibrate: v }))} /></div>
                        <div className="flex"><ToggleRow label="Strong alert (repeat buzzes)" value={!!settings.strongAlert} onChange={v => setSettings(st => ({ ...st, strongAlert: v }))} /></div>
                        <p className="text-xs text-ink-muted -mt-1">Vibration off shows a silent banner (iOS ties the buzz to the sound). Strong alert fires a few notifications a second apart.</p>
                      </div>
                    )}
                  </>)}

                  {!isNative && settingsCat === 'reminders' && (
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Stop all tasks keybind</label>
                      <input value={settings.panicHotkey} onChange={e => setSettings(s => ({ ...s, panicHotkey: e.target.value }))} placeholder="e.g. Ctrl+Shift+X" className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors" />
                      <p className="text-xs text-ink-muted mt-2">Press this anywhere to instantly stop every running task.</p>
                      <button onClick={() => api.stopAll()} className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-full bg-ink text-cream hover:bg-terra transition-colors font-medium text-sm"><Square size={14} strokeWidth={2.4}/> Stop all tasks now</button>
                    </div>
                  )}

                  {settingsCat === 'goals' && (
                    <div>
                      <div className="flex items-center gap-2 mb-2"><Target size={15} className="text-terra" strokeWidth={2}/><label className="text-xs uppercase tracking-wider text-ink-muted">Your reward goal</label></div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <select value={game.reward?.goalType || 'completions'} onChange={e => setGame(g => ({ ...g, reward: { goalType: e.target.value as 'completions' | 'streak', goal: g.reward?.goal || 10, text: g.reward?.text || '', claimed: false } }))} className="bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-terra transition-colors">
                          <option value="completions">Reminders done</option>
                          <option value="streak">Day streak</option>
                        </select>
                        <input type="number" min={1} value={game.reward?.goal || 10} onChange={e => setGame(g => ({ ...g, reward: { goalType: g.reward?.goalType || 'completions', goal: Math.max(1, parseInt(e.target.value) || 1), text: g.reward?.text || '', claimed: false } }))} className="bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-terra transition-colors" placeholder="Goal" />
                      </div>
                      <input value={game.reward?.text || ''} onChange={e => setGame(g => ({ ...g, reward: { goalType: g.reward?.goalType || 'completions', goal: g.reward?.goal || 10, text: e.target.value, claimed: false } }))} placeholder="Reward — e.g. 'Order my favourite takeaway'" className="w-full bg-card border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors" />
                      <p className="text-xs text-ink-muted mt-2">{game.reward ? (game.reward.claimed ? 'Reward claimed 🎉 — set a new goal to keep going.' : `Progress: ${game.reward.goalType === 'completions' ? game.completedTotal : game.bestStreak} / ${game.reward.goal}`) : 'Set a goal and a treat for yourself — Lull celebrates when you hit it.'}</p>
                    </div>
                  )}

                  {settingsCat === 'general' && (
                    <div className="space-y-4">
                      <div className="flex"><ToggleRow label="Set timezone automatically" value={!!settings.autoTimezone} onChange={v => setSettings(s => ({ ...s, autoTimezone: v, timezone: v ? 'auto' : (s.timezone === 'auto' ? Intl.DateTimeFormat().resolvedOptions().timeZone : s.timezone) }))} /></div>
                      <div>
                        <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Timezone</label>
                        <select disabled={settings.autoTimezone} value={settings.autoTimezone ? 'auto' : settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value, autoTimezone: e.target.value === 'auto' }))} className="w-full bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-terra transition-colors disabled:opacity-50">
                          {['auto','Pacific/Auckland','Australia/Sydney','Asia/Tokyo','Asia/Singapore','Asia/Kolkata','Asia/Dubai','Europe/Moscow','Europe/Berlin','Europe/Paris','Europe/London','Atlantic/Reykjavik','America/Sao_Paulo','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Pacific/Honolulu'].map(tz => (<option key={tz} value={tz}>{tz === 'auto' ? 'Automatic (this device)' : tz.replace(/_/g, ' ')}</option>))}
                        </select>
                        <p className="text-xs text-ink-muted mt-2">Currently {activeTz.replace(/_/g, ' ')} · {ukNow}</p>
                      </div>
                    </div>
                  )}

                  <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full border border-cream-dark text-ink hover:border-terra hover:text-terra transition-colors font-medium mt-2"><LogOut size={16} strokeWidth={2}/> Log out</button>
                  <p className="text-center text-xs text-ink-muted">Changes save automatically.</p>
                </div>

                {/* category rail — horizontal strip on mobile (top), vertical rail on desktop (right) */}
                <nav className="order-1 sm:order-2 shrink-0 sm:w-44 flex sm:flex-col gap-1 p-2 sm:p-3 border-b sm:border-b-0 sm:border-l border-cream-dark overflow-x-auto sm:overflow-y-auto">
                  {[
                    { key: 'account', label: 'Account', icon: User, show: true },
                    { key: 'customization', label: 'Customization', icon: Palette, show: true },
                    { key: 'appicon', label: 'App icon', icon: ImageIcon, show: isNative },
                    { key: 'sound', label: 'Sound', icon: Volume2, show: true },
                    { key: 'reminders', label: 'Automations', icon: Zap, show: !isNative },
                    { key: 'goals', label: 'Goals', icon: Target, show: true },
                    { key: 'general', label: 'General', icon: Clock, show: true },
                  ].filter(ct => ct.show).map(ct => (
                    <button key={ct.key} onClick={() => setSettingsCat(ct.key)} className={`shrink-0 sm:w-full flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors text-left ${settingsCat === ct.key ? 'bg-terra-light text-terra-dark' : 'text-ink-muted hover:text-ink hover:bg-card'}`}>
                      <ct.icon size={16} strokeWidth={1.9}/> <span>{ct.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
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
