import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Image as ImageIcon, Trash2, AlarmClock, Bell, Clock, Settings, LogOut, User, Moon, Sun, Volume2, VolumeX, Eye, EyeOff, Zap, Play, Square, MousePointerClick, Keyboard, Type, Move, Pencil, ChevronLeft, AlertTriangle, Music, Pause, Lock, Flame, Trophy, Target, TrendingUp, Gift, BarChart3, Sparkles, Home, Palette, Upload, ZoomIn, ZoomOut, Users, Search, UserPlus, Check, Code2, FilePlus, FolderPlus, BookOpen, Shield, Ban, Pin, Copy, Feather, Download, Snowflake, FileText, FolderOpen, Film, Save, Circle, Minus, Layers, SlidersHorizontal, Wand2, Crop, Eraser, Scissors, Sticker } from 'lucide-react';
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
  // coding sandbox
  codeFont: string;
  codeFontSize: number;
  codeTheme: string;         // 'match' | 'light' | 'dark' | 'contrast'
  codeTabSize: number;
  codeWrap: boolean;
  codeLivePreview: boolean;
  codeLineNumbers: boolean;
  clock24h: boolean;
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
  codeFont: 'mono',
  codeFontSize: 13,
  codeTheme: 'match',
  codeTabSize: 2,
  codeWrap: false,
  codeLivePreview: true,
  codeLineNumbers: false,
  clock24h: true,
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

// A small calming line that changes once per day (deterministic, no repeats within the set).
const CALM_QUOTES: string[] = [
  'One thing at a time is still progress.',
  'You don’t have to do it all today.',
  'Small steps count. Take one.',
  'Breathe. The list can wait a moment.',
  'Done is kinder than perfect.',
  'Rest is part of the work.',
  'Be where your feet are.',
  'Gentle and steady wins the day.',
  'Every reminder is a tiny act of care for future you.',
  'Progress, not pressure.',
  'You are allowed to begin again, anytime.',
  'A calm mind is a productive one.',
  'Today only needs the next right thing.',
  'Slow is smooth, and smooth is fast.',
  'Let the little wins add up.',
];
function dailyQuote(now: number): string {
  const dayNumber = Math.floor(now / 86400000); // days since epoch
  return CALM_QUOTES[dayNumber % CALM_QUOTES.length];
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
  freezes: number;              // streak freezes — auto-saves the streak after a missed day
}

// Completions in a season/holiday needed to permanently unlock its app icon.
const ICON_UNLOCK_THRESHOLD = 3;

const DEFAULT_GAME: GameState = {
  xp: 0, completedTotal: 0, missedTotal: 0, streak: 0, bestStreak: 0,
  lastStreakDay: '', achievements: [], history: {}, reward: null, celebratedDay: '', iconProgress: {}, freezes: 0,
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
function applyCompletion(g: GameState, onTime: boolean, now: number, mult: number = 1): { next: GameState; unlocked: string[] } {
  const today = dayKey(now);
  const hist = { ...g.history };
  const d = hist[today] || { completed: 0, missed: 0 };
  hist[today] = { ...d, completed: d.completed + 1 };

  let { streak, bestStreak, lastStreakDay, freezes } = g;
  if (onTime && lastStreakDay !== today) {
    const yesterday = dayKey(now - 86400000);
    const twoDaysAgo = dayKey(now - 2 * 86400000);
    if (lastStreakDay === yesterday) streak += 1;
    else if (lastStreakDay === twoDaysAgo && (freezes || 0) > 0) { streak += 1; freezes = (freezes || 0) - 1; } // freeze saves a single missed day
    else streak = 1;
    lastStreakDay = today;
    bestStreak = Math.max(bestStreak, streak);
    if (streak > 0 && streak % 7 === 0 && (freezes || 0) < 3) freezes = (freezes || 0) + 1; // earn a freeze each 7-day streak (max 3)
  }

  const next: GameState = {
    ...g,
    xp: g.xp + Math.round((XP_PER_COMPLETION + (onTime ? XP_ONTIME_BONUS : 0)) * mult),
    completedTotal: g.completedTotal + 1,
    streak, bestStreak, lastStreakDay, freezes,
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
    if (dragRef.current) { const id = dragRef.current.id; const f = worldFrac(e.clientX, e.clientY); setNotes(ns => ns.map(n => (n.id === id ? { ...n, x: f.x, y: f.y } : n))); return; }
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

  const [view, setViewState] = useState({ scale: 1, tx: 0, ty: 0 });
  const viewRef = useRef(view);
  const setView = (v: { scale: number; tx: number; ty: number }) => { viewRef.current = v; setViewState(v); };
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<any>(null);

  useEffect(() => {
    const off = social.watchSpaceNotes(space.id, setNotes);
    return () => off();
  }, [space.id]);

  const canvasXY = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    return { sx: clientX - (r?.left || 0), sy: clientY - (r?.top || 0), w: r?.width || 1, h: r?.height || 1 };
  };
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
  const zoomButton = (factor: number) => { const r = canvasRef.current?.getBoundingClientRect(); zoomAround((r?.width || 0) / 2, (r?.height || 0) / 2, factor); };
  const onWheel = (e: React.WheelEvent) => { const { sx, sy } = canvasXY(e.clientX, e.clientY); zoomAround(sx, sy, e.deltaY < 0 ? 1.12 : 1 / 1.12); };

  const addNote = (fx: number, fy: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    social.setSpaceNote(space.id, { id, x: fx, y: fy, text: '', colors: [NOTE_PALETTE[notes.length % NOTE_PALETTE.length]] }).catch(() => {});
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
    if (dragRef.current) { const id = dragRef.current.id; const f = worldFrac(e.clientX, e.clientY); setNotes(ns => ns.map(n => (n.id === id ? { ...n, x: f.x, y: f.y } : n))); return; }
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
    if (dragRef.current) { const d = dragRef.current; dragRef.current = null; const n = notes.find(x => x.id === d.id); if (n) social.setSpaceNote(space.id, n).catch(() => {}); return; }
    const g = gesture.current;
    if (g && g.mode === 'tap' && !g.moved) { const f = worldFrac(g.sx, g.sy); addNote(f.x, f.y); }
    if (pointers.current.size === 0) gesture.current = null;
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
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-0 overflow-hidden"
        style={{ backgroundColor: bg, backgroundImage: `radial-gradient(${dot} 1.3px, transparent 1.4px)`, backgroundSize: '26px 26px', touchAction: 'none', cursor: gesture.current?.mode === 'pan' ? 'grabbing' : 'crosshair' }}
      >
        <div className="absolute top-0 left-0 w-full h-full" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`, transformOrigin: '0 0' }}>
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100">
            {edges.map(([a, b], k) => (<line key={k} x1={notes[a].x * 100} y1={notes[a].y * 100} x2={notes[b].x * 100} y2={notes[b].y * 100} stroke="rgba(130,130,130,0.6)" strokeWidth={1.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />))}
          </svg>
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

        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-center px-8">
            <div><Sparkles size={28} className="text-terra mx-auto mb-3" strokeWidth={1.5} /><p className="font-display text-2xl italic text-ink-muted">A shared sky with {space.withName}</p><p className="text-sm text-ink-muted mt-2">Tap anywhere — you'll both see it live</p></div>
          </div>
        )}
      </div>

      <div className="absolute top-5 right-5 flex items-center gap-3" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <span className="hidden sm:flex items-center gap-2 bg-card/80 backdrop-blur border border-cream-dark rounded-full px-4 py-2 text-sm text-ink"><Users size={15} className="text-terra" strokeWidth={2} /> Shared with {space.withName}</span>
        <button onClick={onClose} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink-muted hover:text-terra hover:border-terra transition-colors" aria-label="Close"><X size={20} /></button>
      </div>

      <div className="absolute bottom-6 right-5 flex flex-col items-center gap-2" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
        <button onClick={() => zoomButton(1.2)} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink hover:text-terra hover:border-terra transition-colors" aria-label="Zoom in"><ZoomIn size={18} strokeWidth={2} /></button>
        <button onClick={() => setView({ scale: 1, tx: 0, ty: 0 })} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink-muted hover:text-terra hover:border-terra transition-colors text-[10px] font-semibold" aria-label="Reset zoom">{Math.round(view.scale * 100)}%</button>
        <button onClick={() => zoomButton(1 / 1.2)} className="w-11 h-11 rounded-full bg-card border border-cream-dark shadow-lg flex items-center justify-center text-ink hover:text-terra hover:border-terra transition-colors" aria-label="Zoom out"><ZoomOut size={18} strokeWidth={2} /></button>
      </div>
    </div>
  );
}

// ============================================================
// CODING SANDBOX — local multi-file projects with a live web preview.
// ============================================================
interface CodeFile { name: string; content: string }
interface CodeProject { id: string; name: string; files: CodeFile[]; active: string }
interface CodeData { projects: CodeProject[]; activeId: string }

function makeCodeProject(name: string, greet: string = 'there'): CodeProject {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    id, name, active: 'index.html',
    files: [
      { name: 'index.html', content: `<!doctype html>\n<html>\n  <head>\n    <meta charset="utf-8">\n    <title>My page</title>\n  </head>\n  <body>\n    <h1>Hello, ${greet}</h1>\n    <p class="note">Edit the files — the preview updates live.</p>\n    <button onclick="greet()">Click me</button>\n  </body>\n</html>` },
      { name: 'style.css', content: `body {\n  font-family: system-ui, sans-serif;\n  text-align: center;\n  padding: 40px;\n  background: #F5EFE6;\n  color: #1F2421;\n}\nh1 { color: #C8553D; }\n.note { color: #6B6862; }\nbutton {\n  margin-top: 16px;\n  padding: 10px 18px;\n  border: none;\n  border-radius: 999px;\n  background: #C8553D;\n  color: #fff;\n  font-size: 15px;\n  cursor: pointer;\n}` },
      { name: 'script.js', content: `function greet() {\n  alert('Hello from Lull!');\n}` },
    ],
  };
}

const DEFAULT_CODE_DATA = (greet: string = 'there'): CodeData => { const p = makeCodeProject('My first project', greet); return { projects: [p], activeId: p.id }; };

// Combine the project's files into one HTML document for the preview iframe.
function buildPreviewDoc(files: CodeFile[]): string {
  const html = files.find(f => f.name.endsWith('.html'))?.content ?? '';
  const css = files.filter(f => f.name.endsWith('.css')).map(f => f.content).join('\n\n');
  const js = files.filter(f => f.name.endsWith('.js')).map(f => f.content).join('\n\n');
  let doc = html.includes('</head>') ? html.replace('</head>', `<style>\n${css}\n</style>\n</head>`) : `<style>\n${css}\n</style>\n${html}`;
  doc = doc.includes('</body>') ? doc.replace('</body>', `<script>\n${js}\n</script>\n</body>`) : `${doc}\n<script>\n${js}\n</script>`;
  return doc;
}

const CODE_FONTS: Record<string, { label: string; stack: string }> = {
  mono: { label: 'Monospace', stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  menlo: { label: 'Menlo', stack: 'Menlo, Consolas, "Liberation Mono", monospace' },
  courier: { label: 'Courier', stack: '"Courier New", Courier, monospace' },
  system: { label: 'System', stack: 'system-ui, -apple-system, sans-serif' },
};

function editorColors(codeTheme: string, appTheme: string): { bg: string; fg: string } {
  const t = codeTheme === 'match' ? appTheme : codeTheme;
  if (t === 'contrast') return { bg: '#000000', fg: '#F4F4F4' };
  if (t === 'dark') return { bg: '#17150F', fg: '#F1EBDF' };
  return { bg: '#FBF7F0', fg: '#1F2421' };
}

export interface CodeCfg { font: string; size: number; theme: string; tab: number; wrap: boolean; live: boolean; lineNumbers: boolean }

function CodePanel({ data, setData, theme, greet, cfg, onLogbook, onClose }: {
  data: CodeData;
  setData: React.Dispatch<React.SetStateAction<CodeData>>;
  theme: string;
  greet: string;
  cfg: CodeCfg;
  onLogbook: () => void;
  onClose: () => void;
}) {
  const proj = data.projects.find(p => p.id === data.activeId) || data.projects[0];
  const activeFile = proj.files.find(f => f.name === proj.active) || proj.files[0];
  const [pane, setPane] = useState<'code' | 'preview'>('code');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [projName, setProjName] = useState(proj.name);
  const [previewDoc, setPreviewDoc] = useState('');
  const gutterRef = useRef<HTMLDivElement>(null);

  // build once on open / when switching project
  useEffect(() => { setPreviewDoc(buildPreviewDoc(proj.files)); }, [proj.id]);
  // live auto-refresh while typing (only when enabled)
  useEffect(() => {
    if (!cfg.live) return;
    const t = setTimeout(() => setPreviewDoc(buildPreviewDoc(proj.files)), 250);
    return () => clearTimeout(t);
  }, [proj.files, cfg.live]);
  const runPreview = () => setPreviewDoc(buildPreviewDoc(proj.files));

  const updateProject = (fn: (p: CodeProject) => CodeProject) => setData(d => ({ ...d, projects: d.projects.map(p => (p.id === d.activeId ? fn(p) : p)) }));
  const setFileContent = (content: string) => updateProject(p => ({ ...p, files: p.files.map(f => (f.name === p.active ? { ...f, content } : f)) }));
  const switchFile = (name: string) => updateProject(p => ({ ...p, active: name }));
  const addFile = () => {
    let name = newName.trim(); setNewName(''); setAdding(false);
    if (!name) return;
    if (!/\.[a-z0-9]+$/i.test(name)) name += '.js';
    updateProject(p => (p.files.some(f => f.name === name) ? { ...p, active: name } : { ...p, files: [...p.files, { name, content: '' }], active: name }));
  };
  const deleteFile = (name: string) => updateProject(p => {
    if (p.files.length <= 1) return p;
    const files = p.files.filter(f => f.name !== name);
    return { ...p, files, active: p.active === name ? files[0].name : p.active };
  });

  const newProject = () => { const np = makeCodeProject(`Project ${data.projects.length + 1}`, greet); setData(d => ({ projects: [...d.projects, np], activeId: np.id })); };
  const renameProject = () => { const n = projName.trim(); if (n) updateProject(p => ({ ...p, name: n })); setRenaming(false); };
  const deleteProject = () => setData(d => {
    if (d.projects.length <= 1) { const np = makeCodeProject('My first project', greet); return { projects: [np], activeId: np.id }; }
    const projects = d.projects.filter(p => p.id !== d.activeId);
    return { projects, activeId: projects[0].id };
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget; const s = ta.selectionStart, en = ta.selectionEnd;
      setFileContent(ta.value.slice(0, s) + '  ' + ta.value.slice(en));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
    }
  };

  const ed = editorColors(cfg.theme, theme);
  const font = CODE_FONTS[cfg.font] || CODE_FONTS.mono;
  const lineCount = activeFile.content.split('\n').length;

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-cream-dark shrink-0">
        <Code2 size={18} className="text-terra shrink-0" strokeWidth={1.9} />
        {renaming ? (
          <input value={projName} onChange={e => setProjName(e.target.value)} onBlur={renameProject} onKeyDown={e => { if (e.key === 'Enter') renameProject(); }} autoFocus className="bg-card border border-cream-dark rounded-lg px-2 py-1 text-ink text-sm" />
        ) : (
          <button onClick={() => { setProjName(proj.name); setRenaming(true); }} className="font-display text-lg text-ink font-medium truncate max-w-[36vw]" title="Rename project">{proj.name}</button>
        )}
        <select value={data.activeId} onChange={e => setData(d => ({ ...d, activeId: e.target.value }))} className="bg-card border border-cream-dark rounded-lg px-2 py-1 text-ink text-xs max-w-[28vw]" title="Switch project">
          {data.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button onClick={newProject} className="flex items-center gap-1 text-xs text-terra border border-terra-light hover:border-terra rounded-lg px-2 py-1 transition-colors" title="New project"><FolderPlus size={13} /> New</button>
        <button onClick={deleteProject} className="text-ink-muted hover:text-terra p-1" title="Delete project"><Trash2 size={14} /></button>
        <button onClick={onLogbook} className="flex items-center gap-1 text-xs text-ink-muted hover:text-terra border border-cream-dark hover:border-terra rounded-lg px-2 py-1 transition-colors" title="Logbook / reference"><BookOpen size={13} /> <span className="hidden sm:inline">Logbook</span></button>
        {!cfg.live && <button onClick={runPreview} className="flex items-center gap-1 text-xs text-cream bg-terra hover:bg-terra-dark rounded-lg px-2.5 py-1 transition-colors" title="Run preview"><Play size={12} strokeWidth={2.5} /> Run</button>}
        <div className="flex-1" />
        <div className="flex sm:hidden bg-card border border-cream-dark rounded-lg overflow-hidden text-xs">
          <button onClick={() => setPane('code')} className={`px-3 py-1 ${pane === 'code' ? 'bg-terra text-cream' : 'text-ink-muted'}`}>Code</button>
          <button onClick={() => setPane('preview')} className={`px-3 py-1 ${pane === 'preview' ? 'bg-terra text-cream' : 'text-ink-muted'}`}>Preview</button>
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5 ml-1" aria-label="Close code"><X size={20} /></button>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className={`${pane === 'code' ? 'flex' : 'hidden'} sm:flex flex-col flex-1 min-w-0 sm:border-r border-cream-dark`}>
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-cream-dark overflow-x-auto shrink-0">
            {proj.files.map(f => (
              <div key={f.name} className={`group flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs whitespace-nowrap cursor-pointer ${proj.active === f.name ? 'bg-terra-light text-terra-dark' : 'text-ink-muted hover:text-ink hover:bg-card'}`} onClick={() => switchFile(f.name)}>
                <span>{f.name}</span>
                {proj.files.length > 1 && <button onClick={e => { e.stopPropagation(); deleteFile(f.name); }} className="opacity-60 hover:opacity-100 hover:text-terra"><X size={11} /></button>}
              </div>
            ))}
            {adding ? (
              <input value={newName} onChange={e => setNewName(e.target.value)} onBlur={addFile} onKeyDown={e => { if (e.key === 'Enter') addFile(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }} autoFocus placeholder="name.js" className="bg-card border border-cream-dark rounded-lg px-2 py-1 text-xs w-24" />
            ) : (
              <button onClick={() => setAdding(true)} className="text-ink-muted hover:text-terra p-1 shrink-0" title="New file"><FilePlus size={14} /></button>
            )}
          </div>
          <div className="flex-1 flex min-h-0 overflow-hidden" style={{ background: ed.bg }}>
            {cfg.lineNumbers && (
              <div ref={gutterRef} className="select-none text-right pl-3 pr-2 py-4 overflow-hidden shrink-0" style={{ color: ed.fg, opacity: 0.4, fontFamily: font.stack, fontSize: cfg.size, lineHeight: 1.6, whiteSpace: 'pre' }}>
                {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
            )}
            <textarea
              value={activeFile.content}
              onChange={e => setFileContent(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={e => { if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop; }}
              spellCheck={false}
              wrap={cfg.wrap ? 'soft' : 'off'}
              className="flex-1 w-full resize-none py-4 pr-4 pl-2 focus:outline-none"
              style={{ background: ed.bg, color: ed.fg, fontFamily: font.stack, fontSize: cfg.size, lineHeight: 1.6, tabSize: cfg.tab, whiteSpace: cfg.wrap ? 'pre-wrap' : 'pre', overflowX: cfg.wrap ? 'hidden' : 'auto' }}
            />
          </div>
        </div>
        <div className={`${pane === 'preview' ? 'flex' : 'hidden'} sm:flex flex-col flex-1 min-w-0 bg-white`}>
          <div className="px-3 py-1.5 border-b border-cream-dark bg-cream text-[11px] uppercase tracking-wider text-ink-muted shrink-0">Preview</div>
          <iframe title="preview" srcDoc={previewDoc} sandbox="allow-scripts allow-modals" className="flex-1 w-full border-0 bg-white" />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOGBOOK — a clickable reference index for HTML / CSS / JS.
// ============================================================
interface RefEntry { name: string; syntax: string; desc: string; info: string }

const CODE_REF: { key: 'html' | 'css' | 'js'; label: string; entries: RefEntry[] }[] = [
  { key: 'html', label: 'HTML', entries: [
    { name: '<!doctype html>', syntax: '<!doctype html>', desc: 'Tells the browser this is a modern HTML5 document.', info: 'Always the very first line of an HTML file.' },
    { name: '<html>', syntax: '<html> … </html>', desc: 'The root element that wraps the whole page.', info: 'Everything else goes inside it. Add lang="en" for the page language.' },
    { name: '<head>', syntax: '<head> … </head>', desc: 'Holds info about the page that isn\'t shown directly.', info: 'Title, meta tags, links to CSS, etc. live here.' },
    { name: '<body>', syntax: '<body> … </body>', desc: 'Everything visible on the page.', info: 'Text, images, buttons and layout all go inside body.' },
    { name: '<h1>–<h6>', syntax: '<h1>Title</h1>', desc: 'Headings, from most important (h1) to least (h6).', info: 'Use one h1 per page; nest the rest for structure.' },
    { name: '<p>', syntax: '<p>Some text.</p>', desc: 'A paragraph of text.', info: 'Browsers add space above and below each paragraph.' },
    { name: '<a>', syntax: '<a href="https://…">link</a>', desc: 'A hyperlink to another page or place.', info: 'href is the destination. target="_blank" opens a new tab.' },
    { name: '<img>', syntax: '<img src="pic.png" alt="…">', desc: 'Shows an image.', info: 'alt describes it for screen readers and if it fails to load. No closing tag.' },
    { name: '<div>', syntax: '<div> … </div>', desc: 'A generic box used to group and lay out content.', info: 'Style it with CSS. The most common building block.' },
    { name: '<span>', syntax: '<span>text</span>', desc: 'A small inline container for a bit of text.', info: 'Use it to style part of a line without breaking it.' },
    { name: '<ul> / <ol> / <li>', syntax: '<ul><li>Item</li></ul>', desc: 'Bulleted (ul) or numbered (ol) lists of items (li).', info: 'Every list item goes in its own <li>.' },
    { name: '<button>', syntax: '<button onclick="fn()">Go</button>', desc: 'A clickable button.', info: 'Use onclick or JS addEventListener to make it do something.' },
    { name: '<input>', syntax: '<input type="text" placeholder="…">', desc: 'A field the user can type in or interact with.', info: 'type can be text, number, checkbox, email, password, and more.' },
    { name: '<form>', syntax: '<form> … </form>', desc: 'Groups inputs together to be submitted.', info: 'Wraps inputs and a submit button.' },
    { name: '<label>', syntax: '<label for="id">Name</label>', desc: 'A caption for an input.', info: 'Matching for and input id lets you tap the label to focus the field.' },
    { name: '<link>', syntax: '<link rel="stylesheet" href="style.css">', desc: 'Links an external file, usually a stylesheet.', info: 'Goes in the <head>. No closing tag.' },
    { name: '<script>', syntax: '<script src="script.js"></script>', desc: 'Adds JavaScript to the page.', info: 'Either link a file with src or write code between the tags.' },
    { name: '<style>', syntax: '<style> body { … } </style>', desc: 'Writes CSS directly inside the HTML.', info: 'Usually placed in the <head>.' },
    { name: '<br>', syntax: 'line one<br>line two', desc: 'A line break.', info: 'Use sparingly — prefer separate paragraphs or CSS spacing.' },
    { name: '<strong> / <em>', syntax: '<strong>bold</strong> <em>italic</em>', desc: 'Bold (strong) and italic (em) emphasis.', info: 'They also carry meaning for screen readers.' },
    { name: '<nav> / <header> / <footer>', syntax: '<header> … </header>', desc: 'Landmark sections: navigation, top, and bottom of a page.', info: 'Semantic tags that help structure and accessibility.' },
    { name: '<!-- comment -->', syntax: '<!-- note to self -->', desc: 'A comment the browser ignores.', info: 'For leaving notes in your code; never shown on the page.' },
    { name: '<meta charset>', syntax: '<meta charset="utf-8">', desc: 'Sets the character encoding.', info: 'utf-8 supports every language and emoji. Put it first in <head>.' },
    { name: '<meta viewport>', syntax: '<meta name="viewport" content="width=device-width, initial-scale=1">', desc: 'Makes the page fit phone screens.', info: 'Essential for mobile-friendly layouts.' },
    { name: '<title>', syntax: '<title>My page</title>', desc: 'The page name shown in the browser tab.', info: 'Lives inside the <head>.' },
    { name: 'class / id', syntax: '<div class="card" id="main">', desc: 'Labels for styling and scripting.', info: 'A class can repeat; an id must be unique on the page.' },
    { name: 'data-* attribute', syntax: '<li data-value="3">', desc: 'Stores custom data on an element.', info: 'Read it in JS with el.dataset.value.' },
    { name: '<table>', syntax: '<table><tr><td>cell</td></tr></table>', desc: 'A grid of rows and cells.', info: 'tr is a row, td a cell, th a header cell.' },
    { name: '<select> / <option>', syntax: '<select><option>A</option></select>', desc: 'A dropdown menu.', info: 'Each choice is an <option>.' },
    { name: '<textarea>', syntax: '<textarea rows="4"></textarea>', desc: 'A multi-line text box.', info: 'For longer input than <input>.' },
    { name: '<video>', syntax: '<video src="clip.mp4" controls></video>', desc: 'Embeds a video.', info: 'Add controls to show play and pause.' },
    { name: '<audio>', syntax: '<audio src="song.mp3" controls></audio>', desc: 'Embeds a sound clip.', info: 'controls shows a small player.' },
    { name: '<iframe>', syntax: '<iframe src="https://…"></iframe>', desc: 'Embeds another page inside this one.', info: 'Used for maps, videos and widgets.' },
    { name: '<section> / <article>', syntax: '<section> … </section>', desc: 'Meaningful content blocks.', info: 'article is self-contained; section is a themed group.' },
    { name: '<main> / <aside>', syntax: '<main> … </main>', desc: 'Primary content and side content.', info: 'One <main> per page; <aside> for sidebars.' },
    { name: '<figure> / <figcaption>', syntax: '<figure><img><figcaption>…</figcaption></figure>', desc: 'An image with a caption.', info: 'Keeps a picture and its caption together.' },
    { name: '<canvas>', syntax: '<canvas id="c"></canvas>', desc: 'A drawing surface for graphics.', info: 'Draw on it from JavaScript with getContext.' },
    { name: '<details> / <summary>', syntax: '<details><summary>More</summary>…</details>', desc: 'A built-in expandable section.', info: 'Click the summary to open or close, no JS needed.' },
    { name: '<pre> / <code>', syntax: '<code>x = 1</code>', desc: 'Code and preformatted text.', info: 'pre keeps your spacing; code shows inline code.' },
    { name: '<hr>', syntax: '<hr>', desc: 'A horizontal divider line.', info: 'Separates sections. No closing tag.' },
    { name: 'HTML entities', syntax: '&amp;  &lt;  &copy;', desc: 'Codes for special characters.', info: '&lt; makes <, &amp; makes &, &copy; makes the © symbol.' },
  ] },
  { key: 'css', label: 'CSS', entries: [
    { name: 'color', syntax: 'color: #C8553D;', desc: 'Sets the text color.', info: 'Accepts hex (#fff), names (red), rgb() and hsl().' },
    { name: 'background', syntax: 'background: #F5EFE6;', desc: 'Sets the background color or image.', info: 'Shorthand — can also take gradients: linear-gradient(...).' },
    { name: 'font-size', syntax: 'font-size: 16px;', desc: 'How big the text is.', info: 'Common units: px, rem, em, %.' },
    { name: 'font-family', syntax: 'font-family: system-ui, sans-serif;', desc: 'Which typeface to use.', info: 'List fallbacks separated by commas.' },
    { name: 'margin', syntax: 'margin: 16px;', desc: 'Space OUTSIDE an element.', info: 'margin: 10px 20px; = top/bottom then left/right. margin: 0 auto; centers.' },
    { name: 'padding', syntax: 'padding: 12px;', desc: 'Space INSIDE an element, around its content.', info: 'Same shorthand rules as margin.' },
    { name: 'border', syntax: 'border: 2px solid #E5D9C5;', desc: 'A line around an element.', info: 'Order: width style color.' },
    { name: 'border-radius', syntax: 'border-radius: 12px;', desc: 'Rounds the corners.', info: 'Use 999px or 50% for pills/circles.' },
    { name: 'width / height', syntax: 'width: 100%; height: 200px;', desc: 'The size of an element.', info: 'Try max-width to stay responsive.' },
    { name: 'display', syntax: 'display: flex;', desc: 'How an element lays out its children.', info: 'Common values: block, inline, flex, grid, none (hides it).' },
    { name: 'flex (layout)', syntax: 'display: flex; gap: 8px;', desc: 'A flexible row/column layout.', info: 'Pair with justify-content and align-items to position children.' },
    { name: 'justify-content', syntax: 'justify-content: center;', desc: 'Aligns flex children along the main axis.', info: 'center, space-between, flex-start, flex-end.' },
    { name: 'align-items', syntax: 'align-items: center;', desc: 'Aligns flex children on the cross axis.', info: 'center vertically-aligns items in a row.' },
    { name: 'gap', syntax: 'gap: 12px;', desc: 'Space between flex/grid children.', info: 'Cleaner than adding margins to each child.' },
    { name: 'position', syntax: 'position: absolute;', desc: 'How an element is placed.', info: 'relative, absolute, fixed, sticky. Use with top/left/right/bottom.' },
    { name: 'text-align', syntax: 'text-align: center;', desc: 'Aligns text horizontally.', info: 'left, right, center, justify.' },
    { name: 'box-shadow', syntax: 'box-shadow: 0 4px 12px rgba(0,0,0,.1);', desc: 'A soft shadow behind an element.', info: 'Order: x y blur spread color.' },
    { name: 'opacity', syntax: 'opacity: 0.5;', desc: 'How see-through an element is.', info: '0 = invisible, 1 = solid.' },
    { name: 'transition', syntax: 'transition: all 0.3s ease;', desc: 'Animates changes smoothly.', info: 'Great with :hover states.' },
    { name: 'transform', syntax: 'transform: scale(1.1);', desc: 'Moves, rotates, or scales an element.', info: 'translate(), rotate(), scale(). Doesn\'t affect layout.' },
    { name: 'cursor', syntax: 'cursor: pointer;', desc: 'The mouse cursor shown when hovering.', info: 'pointer signals something is clickable.' },
    { name: 'grid', syntax: 'display: grid; grid-template-columns: 1fr 1fr;', desc: 'A two-dimensional row/column layout.', info: 'fr units split available space; gap adds spacing.' },
    { name: 'box-sizing', syntax: 'box-sizing: border-box;', desc: 'Include padding and border in the width.', info: 'Set it on * to make sizing predictable.' },
    { name: 'line-height', syntax: 'line-height: 1.5;', desc: 'Vertical spacing between lines of text.', info: '1.4 to 1.6 reads nicely.' },
    { name: 'letter-spacing', syntax: 'letter-spacing: 0.05em;', desc: 'Space between letters.', info: 'Great for uppercase headings.' },
    { name: 'font-weight', syntax: 'font-weight: 700;', desc: 'How bold the text is.', info: '400 is normal, 700 is bold.' },
    { name: 'text-decoration', syntax: 'text-decoration: underline;', desc: 'Underline or strike-through text.', info: 'none removes link underlines.' },
    { name: 'text-transform', syntax: 'text-transform: uppercase;', desc: 'Changes letter case.', info: 'uppercase, lowercase, capitalize.' },
    { name: 'background-image', syntax: 'background-image: url(pic.jpg);', desc: 'Puts an image behind an element.', info: 'Pair with background-size: cover.' },
    { name: 'background-size', syntax: 'background-size: cover;', desc: 'How a background image fills its box.', info: 'cover fills the box; contain fits inside it.' },
    { name: 'object-fit', syntax: 'object-fit: cover;', desc: 'How an image fills its box.', info: 'cover crops; contain letterboxes.' },
    { name: 'overflow', syntax: 'overflow: hidden;', desc: 'What happens to content that spills out.', info: 'hidden clips it; auto or scroll add scrollbars.' },
    { name: 'z-index', syntax: 'z-index: 10;', desc: 'Stacking order of positioned elements.', info: 'Higher sits on top. Needs a position set.' },
    { name: 'flex-direction', syntax: 'flex-direction: column;', desc: 'Row or column for a flex layout.', info: 'row is the default; column stacks vertically.' },
    { name: 'flex-wrap', syntax: 'flex-wrap: wrap;', desc: 'Let flex items wrap onto new lines.', info: 'Keeps items from overflowing on small screens.' },
    { name: 'grid-template-columns', syntax: 'grid-template-columns: repeat(3, 1fr);', desc: 'Defines the grid columns.', info: 'repeat(3, 1fr) makes three equal columns.' },
    { name: ':hover', syntax: 'a:hover { color: red; }', desc: 'Styles an element on mouse-over.', info: 'Also try :focus and :active for other states.' },
    { name: ':nth-child', syntax: 'li:nth-child(2) { … }', desc: 'Targets elements by position.', info: 'odd and even are handy for striped rows.' },
    { name: '::before / ::after', syntax: '.x::before { content: "★"; }', desc: 'Adds decorative content with CSS.', info: 'Needs a content property to appear.' },
    { name: '@media (query)', syntax: '@media (max-width: 600px) { … }', desc: 'Different styles at different screen sizes.', info: 'The key to responsive design.' },
    { name: 'CSS variables', syntax: ':root { --brand: #C8553D; }  color: var(--brand);', desc: 'Reusable custom values.', info: 'Define once, use everywhere with var().' },
    { name: 'calc()', syntax: 'width: calc(100% - 40px);', desc: 'Do math inside a value.', info: 'Mix units freely, like percent minus pixels.' },
    { name: 'clamp()', syntax: 'font-size: clamp(1rem, 4vw, 2rem);', desc: 'A value that flexes between a min and max.', info: 'Great for fluid, responsive text.' },
    { name: 'aspect-ratio', syntax: 'aspect-ratio: 16 / 9;', desc: 'Keeps a fixed width-to-height ratio.', info: 'Perfect for video and image boxes.' },
    { name: 'animation / @keyframes', syntax: '@keyframes spin { to { transform: rotate(360deg); } }', desc: 'Multi-step animations.', info: 'Apply with animation: spin 1s linear infinite;' },
    { name: 'filter', syntax: 'filter: blur(4px) brightness(1.2);', desc: 'Visual effects on an element.', info: 'blur, brightness, grayscale, drop-shadow.' },
    { name: 'backdrop-filter', syntax: 'backdrop-filter: blur(8px);', desc: 'Blurs whatever sits behind an element.', info: 'The frosted-glass look.' },
    { name: 'list-style', syntax: 'list-style: none;', desc: 'Bullet or number style for lists.', info: 'none removes bullets, common for nav menus.' },
    { name: 'pointer-events', syntax: 'pointer-events: none;', desc: 'Whether an element receives clicks.', info: 'none lets clicks pass through to what is behind.' },
    { name: 'outline', syntax: 'outline: 2px solid blue;', desc: 'A line outside the border.', info: 'Do not remove focus outlines without a replacement.' },
  ] },
  { key: 'js', label: 'JavaScript', entries: [
    { name: 'let / const', syntax: 'let x = 1; const y = 2;', desc: 'Declare a variable. const can\'t be reassigned.', info: 'Prefer const; use let only when the value changes.' },
    { name: 'function', syntax: 'function greet(name) { … }', desc: 'A reusable block of code you can call.', info: 'Call it with greet("Sam"). Use return to give back a value.' },
    { name: 'arrow function', syntax: 'const add = (a, b) => a + b;', desc: 'A shorter way to write a function.', info: 'Great for callbacks like array.map(x => …).' },
    { name: 'if / else', syntax: 'if (x > 0) { … } else { … }', desc: 'Runs code only when a condition is true.', info: 'Combine conditions with && (and) and || (or).' },
    { name: 'for loop', syntax: 'for (let i = 0; i < 5; i++) { … }', desc: 'Repeats code a set number of times.', info: 'i starts at 0, runs while i < 5, adds 1 each pass.' },
    { name: 'console.log', syntax: 'console.log("hi", value);', desc: 'Prints to the developer console.', info: 'Your main tool for checking what your code is doing.' },
    { name: 'alert', syntax: 'alert("Hello!");', desc: 'Shows a popup message.', info: 'Handy for quick tests; annoying in real apps.' },
    { name: 'document.querySelector', syntax: 'document.querySelector(".note")', desc: 'Finds the first element matching a CSS selector.', info: 'Returns the element so you can read or change it.' },
    { name: 'getElementById', syntax: 'document.getElementById("box")', desc: 'Finds one element by its id.', info: 'Fast and simple when you know the id.' },
    { name: 'addEventListener', syntax: 'btn.addEventListener("click", fn)', desc: 'Runs a function when an event happens.', info: 'Events: click, input, keydown, submit, and many more.' },
    { name: 'textContent', syntax: 'el.textContent = "Hi";', desc: 'Reads or sets the text inside an element.', info: 'Use innerHTML if you need to insert HTML tags.' },
    { name: 'classList', syntax: 'el.classList.add("active")', desc: 'Add, remove, or toggle CSS classes.', info: '.toggle("open") flips it on/off — great for menus.' },
    { name: 'setTimeout', syntax: 'setTimeout(fn, 1000)', desc: 'Runs a function once after a delay (ms).', info: '1000 ms = 1 second.' },
    { name: 'setInterval', syntax: 'setInterval(fn, 1000)', desc: 'Runs a function over and over on a timer.', info: 'Stop it with clearInterval(id).' },
    { name: 'array.map', syntax: '[1,2,3].map(n => n * 2)', desc: 'Makes a new array by transforming each item.', info: 'Returns [2,4,6]; doesn\'t change the original.' },
    { name: 'array.filter', syntax: 'nums.filter(n => n > 0)', desc: 'Keeps only the items that pass a test.', info: 'Returns a new, shorter array.' },
    { name: 'array.forEach', syntax: 'items.forEach(x => …)', desc: 'Runs code once for each item.', info: 'Use it for side-effects; use map to build a new array.' },
    { name: 'push', syntax: 'arr.push(item)', desc: 'Adds an item to the end of an array.', info: 'Changes the array in place.' },
    { name: 'template literals', syntax: '`Hello ${name}`', desc: 'Strings with values plugged in.', info: 'Use backticks; put variables inside ${ }.' },
    { name: '=== (equality)', syntax: 'if (a === b)', desc: 'Checks if two values are exactly equal.', info: 'Prefer === over == (which does loose type conversion).' },
    { name: 'fetch', syntax: 'fetch(url).then(r => r.json())', desc: 'Requests data from the internet.', info: 'Returns a Promise; often used with async/await.' },
    { name: 'Math.random', syntax: 'Math.random()', desc: 'A random number from 0 up to (not including) 1.', info: 'Math.floor(Math.random()*6) gives 0–5.' },
    { name: 'else if', syntax: 'if (a) {…} else if (b) {…}', desc: 'Check more conditions in a row.', info: 'Falls to else if none of them match.' },
    { name: 'while loop', syntax: 'while (x < 5) { x++; }', desc: 'Repeats while a condition stays true.', info: 'Make sure it can end, or it loops forever.' },
    { name: 'switch', syntax: 'switch (v) { case 1: …; break; }', desc: 'Pick a branch by value.', info: 'Remember break, and add a default case.' },
    { name: 'ternary ? :', syntax: 'const s = n > 0 ? "pos" : "neg";', desc: 'A one-line if/else that returns a value.', info: 'condition ? ifTrue : ifFalse.' },
    { name: 'operators', syntax: '+   -   *   /   %', desc: 'Math operators.', info: '% is the remainder; ** raises to a power.' },
    { name: 'comparison', syntax: 'a < b,  a >= b,  a !== b', desc: 'Compare two values.', info: 'Each returns true or false.' },
    { name: 'logical && || !', syntax: 'if (a && !b) …', desc: 'Combine or flip conditions.', info: '&& is and, || is or, ! is not.' },
    { name: 'array.reduce', syntax: 'nums.reduce((sum, n) => sum + n, 0)', desc: 'Boils an array down to one value.', info: 'Great for totals; 0 is the starting value.' },
    { name: 'array.find', syntax: 'users.find(u => u.id === 3)', desc: 'Returns the first matching item.', info: 'Gives undefined if nothing matches.' },
    { name: 'array.includes', syntax: '[1,2,3].includes(2)', desc: 'Checks if an array holds a value.', info: 'Returns true or false.' },
    { name: 'array.sort', syntax: 'nums.sort((a, b) => a - b)', desc: 'Sorts an array.', info: 'Give a compare function for numbers; it sorts in place.' },
    { name: 'array.slice', syntax: 'arr.slice(0, 2)', desc: 'Copies part of an array.', info: 'Does not change the original.' },
    { name: 'array.join', syntax: '["a","b"].join(", ")', desc: 'Turns an array into a string.', info: 'The argument goes between the items.' },
    { name: 'string methods', syntax: '"Hi".toUpperCase()', desc: 'Handy text helpers.', info: '.trim(), .includes(), .split(), .replace(), .slice().' },
    { name: 'objects', syntax: 'const user = { name: "Sam", age: 9 };', desc: 'Groups related values by key.', info: 'Read them with user.name or user["name"].' },
    { name: 'Object.keys / values', syntax: 'Object.keys(obj)', desc: 'Lists the keys or values of an object.', info: 'Object.entries gives [key, value] pairs.' },
    { name: 'JSON.stringify / parse', syntax: 'JSON.stringify(obj)', desc: 'Convert objects to text and back.', info: 'stringify to save, parse to read it back.' },
    { name: 'try / catch', syntax: 'try { … } catch (e) { … }', desc: 'Handle errors without crashing.', info: 'Code that might fail goes in try.' },
    { name: 'async / await', syntax: 'const data = await fetch(url);', desc: 'Wait for slow tasks cleanly.', info: 'await only works inside an async function.' },
    { name: 'Promise .then', syntax: 'fetch(url).then(r => r.json())', desc: 'Run code when an async task finishes.', info: 'Chain .catch() to handle errors.' },
    { name: 'parseInt / Number', syntax: 'Number("42")', desc: 'Turn text into a number.', info: 'parseInt reads whole numbers from text.' },
    { name: 'typeof', syntax: 'typeof x', desc: 'Tells you what kind of value something is.', info: 'Returns "string", "number", "boolean", "object".' },
    { name: 'Math helpers', syntax: 'Math.round(2.6)', desc: 'Rounding and more.', info: 'floor, ceil, round, max, min, abs.' },
    { name: 'Date', syntax: 'new Date();  Date.now()', desc: 'Work with dates and times.', info: 'Date.now() is milliseconds since 1970.' },
    { name: 'spread ...', syntax: 'const b = [...a, 4];', desc: 'Copy or expand arrays and objects.', info: '{ ...obj, x: 1 } copies then overrides x.' },
    { name: 'destructuring', syntax: 'const { name } = user;', desc: 'Pull values out by name.', info: 'Works on arrays too: const [a, b] = arr.' },
    { name: 'optional chaining ?.', syntax: 'user?.address?.city', desc: 'Safely read maybe-missing values.', info: 'Returns undefined instead of throwing an error.' },
    { name: 'nullish ??', syntax: 'const n = x ?? 0;', desc: 'Fallback when a value is null or undefined.', info: 'Unlike ||, it keeps 0 and empty strings.' },
    { name: 'createElement', syntax: 'document.createElement("div")', desc: 'Makes a new element in JS.', info: 'Add it to the page with parent.appendChild(el).' },
    { name: 'style / setAttribute', syntax: 'el.style.color = "red"', desc: 'Change styles and attributes.', info: 'el.setAttribute("href", url) sets attributes.' },
    { name: 'event object', syntax: 'btn.addEventListener("click", e => …)', desc: 'Details about what happened.', info: 'e.target is the element; e.preventDefault() stops the default.' },
    { name: 'localStorage', syntax: 'localStorage.setItem("k", "v")', desc: 'Saves data in the browser.', info: 'getItem reads it back; it survives refreshes.' },
  ] },
];

function LogbookPanel({ theme, onClose }: { theme: string; onClose: () => void }) {
  const [langKey, setLangKey] = useState<'html' | 'css' | 'js'>('html');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<RefEntry | null>(null);
  const [selCustom, setSelCustom] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', syntax: '', desc: '', info: '' });
  const [notes, setNotes] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem('lull-logbook-notes') || '{}'); } catch { return {}; } });
  const [custom, setCustom] = useState<Record<string, RefEntry[]>>(() => { try { return JSON.parse(localStorage.getItem('lull-logbook-custom') || '{}'); } catch { return {}; } });

  const lang = CODE_REF.find(l => l.key === langKey) || CODE_REF[0];
  const codeBg = theme === 'dark' ? '#17150F' : '#F3EBDD';
  const ql = q.trim().toLowerCase();
  const match = (e: RefEntry) => !ql || e.name.toLowerCase().includes(ql) || e.desc.toLowerCase().includes(ql);
  const builtins = lang.entries.filter(match);
  const customList = (custom[langKey] || []).filter(match);
  const noteKey = (name: string) => `${langKey}:${name}`;

  const persistNotes = (n: Record<string, string>) => { try { localStorage.setItem('lull-logbook-notes', JSON.stringify(n)); } catch { /* full */ } };
  const setNote = (name: string, val: string) => setNotes(n => { const next = { ...n }; if (val.trim()) next[noteKey(name)] = val; else delete next[noteKey(name)]; persistNotes(next); return next; });
  const persistCustom = (c: Record<string, RefEntry[]>) => { try { localStorage.setItem('lull-logbook-custom', JSON.stringify(c)); } catch { /* full */ } };
  const addEntry = () => {
    if (!form.name.trim()) return;
    const entry: RefEntry = { name: form.name.trim(), syntax: form.syntax.trim(), desc: form.desc.trim(), info: form.info.trim() };
    setCustom(c => { const next = { ...c, [langKey]: [...(c[langKey] || []), entry] }; persistCustom(next); return next; });
    setForm({ name: '', syntax: '', desc: '', info: '' }); setAdding(false); setSel(entry); setSelCustom(true);
  };
  const delEntry = (name: string) => {
    setCustom(c => { const next = { ...c, [langKey]: (c[langKey] || []).filter(e => e.name !== name) }; persistCustom(next); return next; });
    setNotes(n => { const next = { ...n }; delete next[noteKey(name)]; persistNotes(next); return next; });
    setSel(null); setSelCustom(false);
  };
  const openEntry = (e: RefEntry, isCustom: boolean) => { setSel(e); setSelCustom(isCustom); setAdding(false); };

  const Row = ({ e, isCustom }: { e: RefEntry; isCustom: boolean }) => (
    <button onClick={() => openEntry(e, isCustom)} className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${sel?.name === e.name && selCustom === isCustom ? 'bg-terra-light' : 'hover:bg-card'}`}>
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-ink text-sm truncate" style={{ fontFamily: 'ui-monospace, monospace' }}>{e.name}</span>
        {isCustom && <span className="text-[9px] uppercase tracking-wider bg-terra text-cream rounded-full px-1.5 py-0.5">yours</span>}
        {notes[noteKey(e.name)] && <Feather size={11} className="text-terra shrink-0" />}
      </div>
      <div className="text-xs text-ink-muted truncate">{e.desc || '—'}</div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-cream-dark shrink-0">
        <BookOpen size={18} className="text-terra shrink-0" strokeWidth={1.9} />
        <h2 className="font-display text-lg text-ink font-medium">Logbook</h2>
        <div className="flex bg-card border border-cream-dark rounded-lg overflow-hidden text-xs ml-2">
          {CODE_REF.map(l => (
            <button key={l.key} onClick={() => { setLangKey(l.key); setSel(null); setAdding(false); }} className={`px-3 py-1.5 ${langKey === l.key ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink'}`}>{l.label}</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close logbook"><X size={20} /></button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* index list */}
        <div className={`${sel || adding ? 'hidden' : 'flex'} sm:flex flex-col w-full sm:w-72 shrink-0 sm:border-r border-cream-dark min-h-0`}>
          <div className="p-3 border-b border-cream-dark shrink-0 flex items-center gap-2">
            <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${lang.label}…`} className="flex-1 bg-card border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra" />
            <button onClick={() => { setAdding(true); setSel(null); }} title="Add your own entry" className="shrink-0 w-9 h-9 rounded-xl bg-ink text-cream flex items-center justify-center hover:bg-terra transition-colors"><Plus size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {customList.length > 0 && <div className="text-[10px] uppercase tracking-wider text-ink-muted px-3 pt-2 pb-1">Your entries</div>}
            {customList.map(e => <Row key={'c-' + e.name} e={e} isCustom />)}
            {customList.length > 0 && <div className="text-[10px] uppercase tracking-wider text-ink-muted px-3 pt-3 pb-1">{lang.label} reference</div>}
            {builtins.map(e => <Row key={e.name} e={e} isCustom={false} />)}
            {builtins.length === 0 && customList.length === 0 && <p className="text-sm text-ink-muted p-3">Nothing matches "{q}".</p>}
          </div>
        </div>

        {/* detail / add-form */}
        <div className={`${sel || adding ? 'flex' : 'hidden'} sm:flex flex-col flex-1 min-w-0 overflow-y-auto`}>
          {adding ? (
            <div className="p-5 sm:p-8 max-w-2xl w-full">
              <button onClick={() => setAdding(false)} className="sm:hidden flex items-center gap-1 text-sm text-terra mb-4"><ChevronLeft size={16} /> Back</button>
              <h3 className="font-display text-2xl text-ink font-medium mb-4">New {lang.label} entry</h3>
              <div className="space-y-3">
                {([['name', 'Name (e.g. <marquee> or Array.flat)'], ['syntax', 'Format / example'], ['desc', 'What it does'], ['info', 'Extra info']] as const).map(([k, ph]) => (
                  k === 'name' || k === 'syntax'
                    ? <input key={k} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} className="w-full bg-card border border-cream-dark rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-terra" style={k === 'syntax' ? { fontFamily: 'ui-monospace, monospace' } : undefined} />
                    : <textarea key={k} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} rows={2} className="w-full bg-card border border-cream-dark rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-terra resize-none" />
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={addEntry} disabled={!form.name.trim()} className="flex-1 bg-ink text-cream rounded-full py-3 font-medium hover:bg-terra transition-colors disabled:opacity-40">Save entry</button>
                <button onClick={() => setAdding(false)} className="px-5 rounded-full border border-cream-dark text-ink hover:border-terra transition-colors">Cancel</button>
              </div>
            </div>
          ) : sel ? (
            <div className="p-5 sm:p-8 max-w-2xl w-full">
              <button onClick={() => setSel(null)} className="sm:hidden flex items-center gap-1 text-sm text-terra mb-4"><ChevronLeft size={16} /> Back</button>
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-2xl text-ink font-semibold mb-1 break-words" style={{ fontFamily: 'ui-monospace, monospace' }}>{sel.name}</h3>
                {selCustom && <button onClick={() => delEntry(sel.name)} title="Delete this entry" className="shrink-0 p-1.5 rounded-lg text-ink-muted hover:text-terra hover:bg-card"><Trash2 size={16} /></button>}
              </div>
              <span className="inline-block text-[10px] uppercase tracking-wider bg-terra-light text-terra-dark rounded-full px-2.5 py-1 mb-5">{selCustom ? 'Your entry' : lang.label}</span>
              {sel.syntax && (<><div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Format</div>
              <pre className="rounded-xl p-3 mb-5 text-sm overflow-x-auto text-ink" style={{ background: codeBg, fontFamily: 'ui-monospace, monospace' }}>{sel.syntax}</pre></>)}
              {sel.desc && (<><div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">What it does</div>
              <p className="text-ink mb-5 leading-relaxed">{sel.desc}</p></>)}
              {sel.info && (<><div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1">Extra info</div>
              <p className="text-ink-muted leading-relaxed mb-6">{sel.info}</p></>)}
              <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1 flex items-center gap-1.5"><Feather size={12} className="text-terra" /> Your notes</div>
              <textarea value={notes[noteKey(sel.name)] || ''} onChange={e => setNote(sel.name, e.target.value)} placeholder="Add your own notes, examples or reminders — saved on this device." rows={4} className="w-full bg-card border border-cream-dark rounded-xl px-3 py-2.5 text-sm text-ink focus:outline-none focus:border-terra resize-y" />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div><BookOpen size={28} className="text-terra mx-auto mb-3" strokeWidth={1.5} /><p className="font-display text-2xl italic text-ink-muted">Pick something to learn</p><p className="text-sm text-ink-muted mt-2">Tap any entry — or use + to add your own.</p></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ LULL PHOTO FORMAT: model + render + export ============
type LGrad = { type: 'linear'; from: string; to: string; angle: number };
type LFill = string | LGrad;
interface LEl {
  id: string;
  type: 'rect' | 'ellipse' | 'line' | 'text' | 'image' | 'path';
  x: number; y: number; w: number; h: number;
  rotation: number;
  opacity: number;
  fill: LFill;
  stroke: string;
  strokeWidth: number;
  radius?: number;
  text?: string; fontFamily?: string; fontSize?: number; bold?: boolean; align?: 'left' | 'center' | 'right';
  src?: string;
  origSrc?: string;
  bright?: number; contrast?: number; sat?: number; blur?: number;
  points?: number[];
}
interface LullDoc { lull: 'image'; version: number; width: number; height: number; background: string; elements: LEl[] }

let _lidN = 0;
const lid = () => `e${Date.now().toString(36)}${(_lidN++).toString(36)}`;
const isGrad = (f: LFill): f is LGrad => typeof f === 'object' && f !== null && (f as any).type === 'linear';
const blankLullDoc = (w: number, h: number): LullDoc => ({ lull: 'image', version: 1, width: w, height: h, background: '#ffffff', elements: [] });
const imageLullDoc = (src: string, w: number, h: number): LullDoc => ({ lull: 'image', version: 1, width: w, height: h, background: '#ffffff', elements: [{ id: lid(), type: 'image', x: 0, y: 0, w, h, rotation: 0, opacity: 1, fill: 'none', stroke: 'none', strokeWidth: 0, src }] });

function svgEsc(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function gradCoords(angle: number) {
  const a = (angle * Math.PI) / 180, x = Math.cos(a), y = Math.sin(a);
  return { x1: (0.5 - x / 2).toFixed(4), y1: (0.5 - y / 2).toFixed(4), x2: (0.5 + x / 2).toFixed(4), y2: (0.5 + y / 2).toFixed(4) };
}
function elSvg(el: LEl, defs: string[]): string {
  let fill = 'none';
  if (isGrad(el.fill)) {
    const id = `g_${el.id}`; const c = gradCoords(el.fill.angle);
    defs.push(`<linearGradient id="${id}" x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}"><stop offset="0" stop-color="${el.fill.from}"/><stop offset="1" stop-color="${el.fill.to}"/></linearGradient>`);
    fill = `url(#${id})`;
  } else fill = el.fill || 'none';
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const rot = el.rotation ? ` transform="rotate(${el.rotation} ${cx} ${cy})"` : '';
  const op = el.opacity != null && el.opacity < 1 ? ` opacity="${el.opacity}"` : '';
  const stroke = el.strokeWidth > 0 ? ` stroke="${el.stroke}" stroke-width="${el.strokeWidth}"` : '';
  // brightness / contrast / saturation / blur → an SVG filter (exports natively)
  const b = el.bright ?? 1, ct = el.contrast ?? 1, sa = el.sat ?? 1, bl = el.blur ?? 0;
  let fa = '';
  if (b !== 1 || ct !== 1 || sa !== 1 || bl > 0) {
    const fid = `f_${el.id}`;
    const slope = b * ct, intercept = (1 - ct) / 2;
    const parts: string[] = [];
    if (bl > 0) parts.push(`<feGaussianBlur stdDeviation="${bl}"/>`);
    if (sa !== 1) parts.push(`<feColorMatrix type="saturate" values="${sa}"/>`);
    if (b !== 1 || ct !== 1) parts.push(`<feComponentTransfer><feFuncR type="linear" slope="${slope}" intercept="${intercept}"/><feFuncG type="linear" slope="${slope}" intercept="${intercept}"/><feFuncB type="linear" slope="${slope}" intercept="${intercept}"/></feComponentTransfer>`);
    defs.push(`<filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%">${parts.join('')}</filter>`);
    fa = ` filter="url(#${fid})"`;
  }
  switch (el.type) {
    case 'rect': return `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius || 0}" fill="${fill}"${stroke}${op}${fa}${rot}/>`;
    case 'ellipse': return `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(el.w / 2)}" ry="${Math.abs(el.h / 2)}" fill="${fill}"${stroke}${op}${fa}${rot}/>`;
    case 'line': return `<line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" stroke="${el.stroke || '#000'}" stroke-width="${el.strokeWidth || 2}" stroke-linecap="round"${op}${fa}${rot}/>`;
    case 'image': return `<image href="${el.src}" xlink:href="${el.src}" x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" preserveAspectRatio="none"${op}${fa}${rot}/>`;
    case 'text': {
      const size = el.fontSize || 48;
      const anchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';
      const tx = el.align === 'center' ? cx : el.align === 'right' ? el.x + el.w : el.x;
      const col = isGrad(el.fill) ? fill : (el.fill || '#000000');
      const tspans = (el.text || '').split('\n').map((ln, i) => `<tspan x="${tx}" dy="${i === 0 ? size : size * 1.2}">${svgEsc(ln)}</tspan>`).join('');
      return `<text x="${tx}" y="${el.y}" font-family="${el.fontFamily || 'sans-serif'}" font-size="${size}" font-weight="${el.bold ? '700' : '400'}" fill="${col}" text-anchor="${anchor}"${op}${fa}${rot}>${tspans}</text>`;
    }
    case 'path': {
      const p = el.points || []; if (p.length < 2) return '';
      let d = `M ${p[0]} ${p[1]}`; for (let i = 2; i < p.length; i += 2) d += ` L ${p[i]} ${p[i + 1]}`;
      return `<path d="${d}" fill="none" stroke="${el.stroke || '#000'}" stroke-width="${el.strokeWidth || 4}" stroke-linecap="round" stroke-linejoin="round"${op}${fa}${rot}/>`;
    }
  }
  return '';
}
function svgMarkup(doc: LullDoc): string {
  const defs: string[] = [];
  const body = doc.elements.map(el => elSvg(el, defs)).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><rect x="0" y="0" width="${doc.width}" height="${doc.height}" fill="${doc.background || '#ffffff'}"/><defs>${defs.join('')}</defs>${body}</svg>`;
}
function exportLullImage(doc: LullDoc, target: 'png' | 'jpg' | 'webp', filename: string) {
  const url = URL.createObjectURL(new Blob([svgMarkup(doc)], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = doc.width; c.height = doc.height;
    const ctx = c.getContext('2d'); if (!ctx) { URL.revokeObjectURL(url); return; }
    if (target === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const mime = target === 'png' ? 'image/png' : target === 'webp' ? 'image/webp' : 'image/jpeg';
    c.toBlob(b => { if (b) downloadBlob(b, filename); }, mime, 0.92);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

// ---- pixel operations for the photo editor (all offline, on canvas) ----
function loadImage(src: string, cb: (im: HTMLImageElement | null) => void) {
  const im = new Image(); im.onload = () => cb(im); im.onerror = () => cb(null); im.src = src;
}
// draw an image into a canvas capped at 2000px on the long side (keeps ops snappy)
function opCanvas(im: HTMLImageElement) {
  const max = 2000; let w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
  const s = Math.min(1, max / Math.max(w, h)); w = Math.round(w * s); h = Math.round(h * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!; ctx.drawImage(im, 0, 0, w, h);
  return { c, ctx, w, h };
}
// remove a near-uniform background sampled from the four corners
function removeBgColor(src: string, tol: number, cb: (out: string) => void) {
  loadImage(src, im => {
    if (!im) { cb(src); return; }
    const { c, ctx, w, h } = opCanvas(im);
    const d = ctx.getImageData(0, 0, w, h); const p = d.data;
    const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
    let r = 0, g = 0, b = 0;
    corners.forEach(([x, y]) => { const i = (y * w + x) * 4; r += p[i]; g += p[i + 1]; b += p[i + 2]; });
    r /= 4; g /= 4; b /= 4;
    const t = (tol / 100) * 441.7; const t2 = t * t;
    for (let i = 0; i < p.length; i += 4) { const dr = p[i] - r, dg = p[i + 1] - g, db = p[i + 2] - b; if (dr * dr + dg * dg + db * db <= t2) p[i + 3] = 0; }
    ctx.putImageData(d, 0, 0); cb(c.toDataURL('image/png'));
  });
}
// flood-fill erase similar connected pixels from a fractional point (0..1)
function floodErase(src: string, fx: number, fy: number, tol: number, cb: (out: string) => void) {
  loadImage(src, im => {
    if (!im) { cb(src); return; }
    const { c, ctx, w, h } = opCanvas(im);
    const sx = Math.max(0, Math.min(w - 1, Math.round(fx * w))), sy = Math.max(0, Math.min(h - 1, Math.round(fy * h)));
    const d = ctx.getImageData(0, 0, w, h); const p = d.data;
    const i0 = (sy * w + sx) * 4; const r0 = p[i0], g0 = p[i0 + 1], b0 = p[i0 + 2];
    const t = (tol / 100) * 441.7; const t2 = t * t;
    const seen = new Uint8Array(w * h); const st = [sy * w + sx];
    while (st.length) {
      const q = st.pop()!; if (seen[q]) continue; seen[q] = 1;
      const i = q * 4; const dr = p[i] - r0, dg = p[i + 1] - g0, db = p[i + 2] - b0;
      if (dr * dr + dg * dg + db * db > t2) continue;
      p[i + 3] = 0; const x = q % w, y = (q / w) | 0;
      if (x > 0) st.push(q - 1); if (x < w - 1) st.push(q + 1); if (y > 0) st.push(q - w); if (y < h - 1) st.push(q + w);
    }
    ctx.putImageData(d, 0, 0); cb(c.toDataURL('image/png'));
  });
}
// keep or erase everything inside a freehand polygon (fractional points)
function lassoBake(src: string, frac: number[], mode: 'keep' | 'erase', cb: (out: string) => void) {
  loadImage(src, im => {
    if (!im || frac.length < 6) { cb(src); return; }
    const { c, ctx, w, h } = opCanvas(im);
    ctx.save(); ctx.beginPath();
    for (let i = 0; i < frac.length; i += 2) { const x = frac[i] * w, y = frac[i + 1] * h; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath();
    ctx.globalCompositeOperation = mode === 'keep' ? 'destination-in' : 'destination-out';
    ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    cb(c.toDataURL('image/png'));
  });
}
// crop to a fractional rect (full resolution)
function cropBake(src: string, fx: number, fy: number, fw: number, fh: number, cb: (out: string) => void) {
  loadImage(src, im => {
    if (!im) { cb(src); return; }
    const nw = im.naturalWidth || im.width, nh = im.naturalHeight || im.height;
    const sx = Math.round(fx * nw), sy = Math.round(fy * nh), sw = Math.max(1, Math.round(fw * nw)), sh = Math.max(1, Math.round(fh * nh));
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const ctx = c.getContext('2d')!; ctx.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
    cb(c.toDataURL('image/png'));
  });
}

const bboxOf = (el: LEl): { x: number; y: number; w: number; h: number } => {
  if (el.type === 'path' && el.points && el.points.length >= 2) {
    const xs = el.points.filter((_, i) => i % 2 === 0), ys = el.points.filter((_, i) => i % 2 === 1);
    const minx = Math.min(...xs), miny = Math.min(...ys);
    return { x: minx, y: miny, w: Math.max(1, Math.max(...xs) - minx), h: Math.max(1, Math.max(...ys) - miny) };
  }
  if (el.type === 'line') return { x: Math.min(el.x, el.x + el.w), y: Math.min(el.y, el.y + el.h), w: Math.max(1, Math.abs(el.w)), h: Math.max(1, Math.abs(el.h)) };
  return { x: el.x, y: el.y, w: el.w, h: el.h };
};

const LFONTS = [
  { v: 'sans-serif', l: 'Sans' },
  { v: 'Georgia, serif', l: 'Serif' },
  { v: 'ui-monospace, monospace', l: 'Mono' },
  { v: '"Trebuchet MS", sans-serif', l: 'Round' },
  { v: '"Courier New", monospace', l: 'Type' },
];
const SWATCHES = ['#1F2421', '#ffffff', '#C8553D', '#E8A33D', '#5C8A5A', '#3D7EA6', '#7B5EA7', '#C86B98', '#000000'];

// The photo editor — a layer canvas that reads & writes the editable .lull format.
function PhotoEditor({ name, initial, theme, onExit, onClose }: { name: string; initial: LullDoc; theme: string; onExit: (doc: LullDoc) => void; onClose: () => void }) {
  const [doc, setDoc] = useState<LullDoc>(initial);
  const [selId, setSelId] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'pen' | 'rect' | 'round' | 'ellipse' | 'line' | 'text'>('select');
  const [newFill, setNewFill] = useState('#C8553D');
  const [brush, setBrush] = useState(6);
  const [scale, setScale] = useState(0.3);
  const [showExport, setShowExport] = useState(false);
  const [imgTool, setImgTool] = useState<null | 'crop' | 'lasso' | 'wand'>(null);
  const [tol, setTol] = useState(30);
  const [lassoMode, setLassoMode] = useState<'keep' | 'erase'>('keep');
  const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [lassoPts, setLassoPts] = useState<number[]>([]);
  const [stickers, setStickers] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('lull-stickers') || '[]'); } catch { return []; } });
  const [showStickers, setShowStickers] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const stickerRef = useRef<HTMLInputElement>(null);
  const drag = useRef<any>(null);
  const drawId = useRef<string | null>(null);
  const ovDrag = useRef<any>(null);

  const sel = doc.elements.find(e => e.id === selId) || null;
  const panelBg = theme === 'dark' ? '#17150F' : '#F3EBDD';

  // fit-to-view
  useEffect(() => {
    const compute = () => {
      const el = wrapRef.current; if (!el) return;
      const aw = el.clientWidth - 40, ah = el.clientHeight - 40;
      setScale(Math.max(0.05, Math.min(aw / doc.width, ah / doc.height, 1)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [doc.width, doc.height]);

  // global pointer handling for move / resize / freehand
  useEffect(() => {
    const canvasXY = (e: PointerEvent) => {
      const r = stageRef.current!.getBoundingClientRect();
      return { cx: (e.clientX - r.left) / scale, cy: (e.clientY - r.top) / scale };
    };
    const move = (e: PointerEvent) => {
      if (drawId.current) {
        const { cx, cy } = canvasXY(e);
        setDoc(prev => ({ ...prev, elements: prev.elements.map(el => el.id === drawId.current ? { ...el, points: [...(el.points || []), Math.round(cx), Math.round(cy)] } : el) }));
        return;
      }
      const d = drag.current; if (!d) return;
      const dx = (e.clientX - d.sx) / scale, dy = (e.clientY - d.sy) / scale;
      setDoc(prev => ({
        ...prev, elements: prev.elements.map(el => {
          if (el.id !== d.id) return el;
          if (d.mode === 'move') {
            if (d.pts) return { ...el, x: d.ox + dx, y: d.oy + dy, points: d.pts.map((v: number, i: number) => (i % 2 === 0 ? v + dx : v + dy)) };
            return { ...el, x: d.ox + dx, y: d.oy + dy };
          }
          let x = d.ox, y = d.oy, w = d.ow, h = d.oh;
          if (d.corner.includes('r')) w = Math.max(8, d.ow + dx);
          if (d.corner.includes('l')) { w = Math.max(8, d.ow - dx); x = d.ox + (d.ow - w); }
          if (d.corner.includes('b')) h = Math.max(8, d.oh + dy);
          if (d.corner.includes('t')) { h = Math.max(8, d.oh - dy); y = d.oy + (d.oh - h); }
          return { ...el, x, y, w, h };
        }),
      }));
    };
    const up = () => {
      if (drawId.current) {
        const id = drawId.current; drawId.current = null;
        setDoc(prev => ({ ...prev, elements: prev.elements.map(el => { if (el.id !== id) return el; const b = bboxOf(el); return { ...el, x: b.x, y: b.y, w: b.w, h: b.h }; }) }));
      }
      drag.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [scale]);

  const add = (el: LEl) => { setDoc(prev => ({ ...prev, elements: [...prev.elements, el] })); setSelId(el.id); };
  const updateSel = (patch: Partial<LEl>) => { if (!selId) return; setDoc(prev => ({ ...prev, elements: prev.elements.map(el => el.id === selId ? { ...el, ...patch } : el) })); };
  const removeSel = () => { if (!selId) return; setDoc(prev => ({ ...prev, elements: prev.elements.filter(el => el.id !== selId) })); setSelId(null); };
  const dupSel = () => { if (!sel) return; const c: LEl = { ...sel, id: lid(), x: sel.x + 20, y: sel.y + 20, points: sel.points ? sel.points.map((v, i) => (i % 2 === 0 ? v + 20 : v + 20)) : undefined }; add(c); };
  const zOrder = (dir: 1 | -1) => {
    if (!selId) return;
    setDoc(prev => {
      const i = prev.elements.findIndex(e => e.id === selId); if (i < 0) return prev;
      const j = i + dir; if (j < 0 || j >= prev.elements.length) return prev;
      const arr = [...prev.elements]; const [it] = arr.splice(i, 1); arr.splice(j, 0, it);
      return { ...prev, elements: arr };
    });
  };

  const onStageDown = (e: React.PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    const cx = (e.clientX - r.left) / scale, cy = (e.clientY - r.top) / scale;
    if (tool === 'select') { setSelId(null); return; }
    if (tool === 'pen') {
      const el: LEl = { id: lid(), type: 'path', x: cx, y: cy, w: 0, h: 0, rotation: 0, opacity: 1, fill: 'none', stroke: newFill, strokeWidth: brush, points: [Math.round(cx), Math.round(cy)] };
      add(el); drawId.current = el.id; return;
    }
    let el: LEl;
    if (tool === 'rect') el = { id: lid(), type: 'rect', x: cx - 120, y: cy - 70, w: 240, h: 140, rotation: 0, opacity: 1, fill: newFill, stroke: 'none', strokeWidth: 0, radius: 0 };
    else if (tool === 'round') el = { id: lid(), type: 'rect', x: cx - 120, y: cy - 45, w: 240, h: 90, rotation: 0, opacity: 1, fill: newFill, stroke: 'none', strokeWidth: 0, radius: 28 };
    else if (tool === 'ellipse') el = { id: lid(), type: 'ellipse', x: cx - 90, y: cy - 90, w: 180, h: 180, rotation: 0, opacity: 1, fill: newFill, stroke: 'none', strokeWidth: 0 };
    else if (tool === 'line') el = { id: lid(), type: 'line', x: cx - 100, y: cy, w: 200, h: 0, rotation: 0, opacity: 1, fill: 'none', stroke: newFill, strokeWidth: brush };
    else el = { id: lid(), type: 'text', x: cx - 150, y: cy - 30, w: 300, h: 70, rotation: 0, opacity: 1, fill: '#1F2421', stroke: 'none', strokeWidth: 0, text: 'Your text', fontFamily: 'sans-serif', fontSize: 48, bold: false, align: 'left' };
    add(el); setTool('select');
  };

  const startMove = (e: React.PointerEvent, el: LEl) => {
    if (tool !== 'select') return;
    e.stopPropagation(); setSelId(el.id);
    drag.current = { mode: 'move', id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, pts: el.points ? [...el.points] : null };
  };
  const startResize = (e: React.PointerEvent, corner: string) => {
    if (!sel) return; e.stopPropagation();
    drag.current = { mode: 'resize', id: sel.id, corner, sx: e.clientX, sy: e.clientY, ox: sel.x, oy: sel.y, ow: sel.w, oh: sel.h };
  };

  const addImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || ''); const im = new Image();
      im.onload = () => {
        const maxW = doc.width * 0.7; const r = im.naturalWidth ? maxW / im.naturalWidth : 1;
        add({ id: lid(), type: 'image', x: doc.width * 0.15, y: doc.height * 0.15, w: im.naturalWidth * r, h: im.naturalHeight * r, rotation: 0, opacity: 1, fill: 'none', stroke: 'none', strokeWidth: 0, src });
      };
      im.src = src;
    };
    reader.readAsDataURL(f); e.target.value = '';
  };

  // persist the reusable sticker tray
  useEffect(() => { try { localStorage.setItem('lull-stickers', JSON.stringify(stickers)); } catch { /* storage full */ } }, [stickers]);
  const importSticker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setStickers(s => [String(reader.result || ''), ...s].slice(0, 30));
    reader.readAsDataURL(f); e.target.value = '';
  };
  const placeSticker = (src: string) => {
    const im = new Image();
    im.onload = () => { const maxW = doc.width * 0.4; const r = im.naturalWidth ? maxW / im.naturalWidth : 1; add({ id: lid(), type: 'image', x: doc.width * 0.3, y: doc.height * 0.3, w: (im.naturalWidth || 200) * r, h: (im.naturalHeight || 200) * r, rotation: 0, opacity: 1, fill: 'none', stroke: 'none', strokeWidth: 0, src }); };
    im.src = src;
  };
  const saveAsSticker = () => { if (sel?.type === 'image' && sel.src) setStickers(s => [sel.src!, ...s.filter(x => x !== sel.src)].slice(0, 30)); };

  // image ops — all bake onto the selected image element
  const applyBg = () => { if (sel?.type !== 'image' || !sel.src) return; const from = sel.origSrc || sel.src; updateSel({ origSrc: from }); removeBgColor(from, tol, out => updateSel({ src: out, origSrc: from })); };
  const resetBg = () => { if (sel?.type === 'image' && sel.origSrc) updateSel({ src: sel.origSrc, origSrc: undefined }); };
  const applyCrop = () => {
    if (!cropRect || sel?.type !== 'image' || !sel.src) return;
    const fx = (cropRect.x - sel.x) / sel.w, fy = (cropRect.y - sel.y) / sel.h, fw = cropRect.w / sel.w, fh = cropRect.h / sel.h;
    const box = { x: cropRect.x, y: cropRect.y, w: cropRect.w, h: cropRect.h };
    cropBake(sel.src, Math.max(0, fx), Math.max(0, fy), Math.min(1, fw), Math.min(1, fh), out => updateSel({ src: out, origSrc: undefined, x: box.x, y: box.y, w: box.w, h: box.h }));
    setCropRect(null); setImgTool(null);
  };
  const applyLasso = () => {
    if (lassoPts.length < 6 || sel?.type !== 'image' || !sel.src) return;
    const frac: number[] = []; for (let i = 0; i < lassoPts.length; i += 2) { frac.push((lassoPts[i] - sel.x) / sel.w, (lassoPts[i + 1] - sel.y) / sel.h); }
    lassoBake(sel.src, frac, lassoMode, out => updateSel({ src: out, origSrc: undefined }));
    setLassoPts([]); setImgTool(null);
  };

  // overlay gestures for crop / lasso / magic-erase
  const ovXY = (e: React.PointerEvent) => { const r = stageRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
  const ovDown = (e: React.PointerEvent) => {
    const { x, y } = ovXY(e);
    if (imgTool === 'crop') { ovDrag.current = { sx: x, sy: y }; setCropRect({ x, y, w: 0, h: 0 }); }
    else if (imgTool === 'lasso') { ovDrag.current = { drawing: true }; setLassoPts([x, y]); }
    else if (imgTool === 'wand' && sel?.type === 'image' && sel.src) {
      const fx = (x - sel.x) / sel.w, fy = (y - sel.y) / sel.h;
      if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) floodErase(sel.src, fx, fy, tol, out => updateSel({ src: out }));
    }
  };
  const ovMove = (e: React.PointerEvent) => {
    if (!ovDrag.current) return; const { x, y } = ovXY(e);
    if (imgTool === 'crop') { const s = ovDrag.current; setCropRect({ x: Math.min(s.sx, x), y: Math.min(s.sy, y), w: Math.abs(x - s.sx), h: Math.abs(y - s.sy) }); }
    else if (imgTool === 'lasso') setLassoPts(pts => [...pts, x, y]);
  };
  const ovUp = () => { ovDrag.current = null; };
  const startImgTool = (t: 'crop' | 'lasso' | 'wand') => { setImgTool(t); setCropRect(null); setLassoPts([]); };

  // fill helpers for the properties panel
  const fillMode: 'solid' | 'gradient' | 'none' = sel ? (isGrad(sel.fill) ? 'gradient' : sel.fill === 'none' ? 'none' : 'solid') : 'none';
  const solidColor = sel && typeof sel.fill === 'string' && sel.fill !== 'none' ? sel.fill : '#C8553D';
  const grad = sel && isGrad(sel.fill) ? sel.fill : { type: 'linear' as const, from: '#C8553D', to: '#E8A33D', angle: 90 };

  const Tool = ({ t, title, children }: { t: typeof tool; title: string; children: any }) => (
    <button onClick={() => setTool(t)} title={title} className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${tool === t ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink hover:bg-card'}`}>{children}</button>
  );
  const Num = ({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) => (
    <label className="flex items-center gap-1.5 text-xs text-ink-muted">{label}
      <input type="number" value={Math.round(value)} onChange={e => onChange(Number(e.target.value) || 0)} className="w-16 bg-cream border border-cream-dark rounded-lg px-2 py-1 text-ink text-xs focus:outline-none focus:border-terra" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* header / tools */}
      <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-cream-dark shrink-0 flex-wrap">
        <button onClick={() => onExit(doc)} className="flex items-center gap-1 text-sm text-terra mr-1"><ChevronLeft size={16} /> Files</button>
        <span className="text-sm text-ink-muted mr-2 truncate max-w-[28vw] hidden sm:block">{name}</span>
        <div className="w-px h-6 bg-cream-dark mx-1" />
        <Tool t="select" title="Select & move"><MousePointerClick size={17} strokeWidth={1.9} /></Tool>
        <Tool t="pen" title="Draw"><Pencil size={17} strokeWidth={1.9} /></Tool>
        <Tool t="rect" title="Rectangle"><Square size={17} strokeWidth={1.9} /></Tool>
        <Tool t="round" title="Rounded / button"><Square size={17} strokeWidth={1.9} className="rounded-[4px]" style={{ borderRadius: 4 }} /></Tool>
        <Tool t="ellipse" title="Ellipse"><Circle size={17} strokeWidth={1.9} /></Tool>
        <Tool t="line" title="Line"><Minus size={18} strokeWidth={2.4} /></Tool>
        <Tool t="text" title="Text"><Type size={17} strokeWidth={1.9} /></Tool>
        <button onClick={() => imgRef.current?.click()} title="Add image" className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-card transition-colors"><ImageIcon size={17} strokeWidth={1.9} /></button>
        <button onClick={() => setShowStickers(v => !v)} title="Stickers" className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${showStickers ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink hover:bg-card'}`}><Sticker size={17} strokeWidth={1.9} /></button>
        <input ref={imgRef} type="file" accept="image/*" onChange={addImage} className="hidden" />
        <label className="w-7 h-7 rounded-full border-2 border-cream-dark overflow-hidden ml-1 cursor-pointer" title="Colour for new shapes" style={{ background: newFill }}>
          <input type="color" value={newFill} onChange={e => setNewFill(e.target.value)} className="opacity-0 w-full h-full cursor-pointer" />
        </label>
        {tool === 'pen' && (
          <div className="flex items-center gap-1 text-xs text-ink-muted ml-1" title="Brush size">
            <span className="hidden sm:inline">Brush</span>
            <button onClick={() => setBrush(b => Math.max(1, b - 2))} className="px-1.5 py-0.5 rounded hover:bg-card">−</button>
            <span className="w-5 text-center">{brush}</span>
            <button onClick={() => setBrush(b => Math.min(60, b + 2))} className="px-1.5 py-0.5 rounded hover:bg-card">+</button>
          </div>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-1 text-xs text-ink-muted">
          <button onClick={() => setScale(s => Math.max(0.05, s - 0.1))} className="px-2 py-1 rounded hover:bg-card">−</button>
          <span className="w-10 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.1))} className="px-2 py-1 rounded hover:bg-card">+</button>
        </div>
        <div className="relative">
          <button onClick={() => setShowExport(v => !v)} className="flex items-center gap-1.5 bg-ink text-cream rounded-full px-3 py-1.5 text-sm hover:bg-terra transition-colors"><Download size={14} strokeWidth={2} /> Export</button>
          {showExport && (
            <div className="absolute right-0 top-full mt-1 bg-cream border border-cream-dark rounded-xl shadow-xl p-1 z-10 w-40">
              {(['png', 'jpg', 'webp'] as const).map(t => (
                <button key={t} onClick={() => { exportLullImage(doc, t, `${baseName(name)}.${t}`); setShowExport(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-ink hover:bg-card">Image · .{t}</button>
              ))}
              <div className="h-px bg-cream-dark my-1" />
              <button onClick={() => { downloadText(JSON.stringify(doc), `${baseName(name)}.lull`, 'application/json'); setShowExport(false); }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-terra font-medium hover:bg-terra-light">Editable · .lull</button>
            </div>
          )}
        </div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close"><X size={20} /></button>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        {/* stage */}
        <div ref={wrapRef} className="relative flex-1 min-h-0 overflow-auto flex items-center justify-center p-5" style={{ background: theme === 'dark' ? '#0F0D0A' : '#E7DECB' }}>
          <div ref={stageRef} onPointerDown={onStageDown} className="relative shadow-2xl shrink-0" style={{ width: doc.width * scale, height: doc.height * scale, cursor: tool === 'select' ? 'default' : 'crosshair' }}>
            <div className="absolute inset-0 pointer-events-none" dangerouslySetInnerHTML={{ __html: svgMarkup(doc) }} />
            {/* interactive hit layer */}
            {doc.elements.map(el => {
              const b = bboxOf(el);
              return (
                <div
                  key={el.id}
                  onPointerDown={e => startMove(e, el)}
                  className="absolute"
                  style={{ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale, transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, pointerEvents: tool === 'select' && !imgTool ? 'auto' : 'none', outline: selId === el.id ? '2px solid var(--terra, #C8553D)' : 'none', cursor: 'move' }}
                />
              );
            })}
            {/* resize handles (unrotated box types only) */}
            {!imgTool && sel && sel.rotation === 0 && sel.type !== 'path' && sel.type !== 'line' && (() => {
              const b = bboxOf(sel);
              return (['tl', 'tr', 'bl', 'br'] as const).map(corner => (
                <div key={corner} onPointerDown={e => startResize(e, corner)} className="absolute w-3 h-3 bg-cream border-2 border-terra rounded-sm" style={{
                  left: (corner.includes('l') ? b.x : b.x + b.w) * scale - 6,
                  top: (corner.includes('t') ? b.y : b.y + b.h) * scale - 6,
                  cursor: corner === 'tl' || corner === 'br' ? 'nwse-resize' : 'nesw-resize',
                }} />
              ));
            })()}

            {/* image-op overlay (crop / lasso / magic-erase) */}
            {imgTool && sel?.type === 'image' && (
              <div className="absolute inset-0" style={{ cursor: imgTool === 'wand' ? 'crosshair' : 'crosshair' }} onPointerDown={ovDown} onPointerMove={ovMove} onPointerUp={ovUp}>
                {imgTool === 'crop' && cropRect && (
                  <div className="absolute border-2 border-terra" style={{ left: cropRect.x * scale, top: cropRect.y * scale, width: cropRect.w * scale, height: cropRect.h * scale, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }} />
                )}
                {imgTool === 'lasso' && lassoPts.length >= 2 && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none">
                    <polyline points={lassoPts.map((v, i) => (i % 2 === 0 ? `${v},` : `${v} `)).join('')} fill="rgba(200,85,61,0.15)" stroke="#C8553D" strokeWidth={2 / scale} />
                  </svg>
                )}
              </div>
            )}
          </div>

          {/* floating action bar for image ops */}
          {imgTool && sel?.type === 'image' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-ink text-cream rounded-full px-3 py-2 shadow-xl flex items-center gap-2 text-sm">
              {imgTool === 'crop' && <><span className="px-1 text-cream/80">Drag to crop</span><button onClick={applyCrop} disabled={!cropRect} className="bg-cream text-ink rounded-full px-3 py-1 font-medium disabled:opacity-50">Apply</button></>}
              {imgTool === 'lasso' && <>
                <span className="px-1 text-cream/80 hidden sm:inline">Draw around it</span>
                <button onClick={() => setLassoMode(m => m === 'keep' ? 'erase' : 'keep')} className="bg-cream/20 rounded-full px-3 py-1">{lassoMode === 'keep' ? 'Keep inside' : 'Erase inside'}</button>
                <button onClick={applyLasso} disabled={lassoPts.length < 6} className="bg-cream text-ink rounded-full px-3 py-1 font-medium disabled:opacity-50">Apply</button>
              </>}
              {imgTool === 'wand' && <>
                <span className="px-1 text-cream/80 hidden sm:inline">Tap areas to erase</span>
                <label className="flex items-center gap-1.5 text-xs">Tol<input type="range" min={2} max={100} value={tol} onChange={e => setTol(Number(e.target.value))} className="w-20 accent-terra" /></label>
              </>}
              <button onClick={() => { setImgTool(null); setCropRect(null); setLassoPts([]); }} className="text-cream/80 hover:text-cream px-2">Done</button>
            </div>
          )}
        </div>

        {/* properties / settings */}
        <div className="w-full sm:w-72 shrink-0 border-t sm:border-t-0 sm:border-l border-cream-dark overflow-y-auto" style={{ background: panelBg }}>
          {!sel ? (
            <div className="p-4 space-y-4">
              <div className="text-xs uppercase tracking-wider text-ink-muted">Canvas</div>
              <div>
                <div className="text-xs text-ink-muted mb-1.5">Size</div>
                <div className="grid grid-cols-2 gap-2">
                  {[['Square', 1080, 1080], ['Portrait', 1080, 1350], ['Story', 1080, 1920], ['Landscape', 1920, 1080]].map(([l, w, h]) => (
                    <button key={l as string} onClick={() => setDoc(prev => ({ ...prev, width: w as number, height: h as number }))} className={`rounded-xl border-2 py-2 text-xs font-medium transition-colors ${doc.width === w && doc.height === h ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}>{l}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Num label="W" value={doc.width} onChange={n => setDoc(prev => ({ ...prev, width: Math.max(16, n) }))} />
                  <Num label="H" value={doc.height} onChange={n => setDoc(prev => ({ ...prev, height: Math.max(16, n) }))} />
                </div>
              </div>
              <div>
                <div className="text-xs text-ink-muted mb-1.5">Background</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="w-8 h-8 rounded-lg border-2 border-cream-dark overflow-hidden cursor-pointer" style={{ background: doc.background }}>
                    <input type="color" value={doc.background} onChange={e => setDoc(prev => ({ ...prev, background: e.target.value }))} className="opacity-0 w-full h-full cursor-pointer" />
                  </label>
                  {SWATCHES.slice(0, 7).map(c => <button key={c} onClick={() => setDoc(prev => ({ ...prev, background: c }))} className="w-7 h-7 rounded-lg border border-cream-dark" style={{ background: c }} />)}
                </div>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed pt-2 border-t border-cream-dark">Pick a tool above and tap the canvas to add a shape, text or drawing. Select something to edit it here. Export as <span className="text-terra font-medium">.lull</span> to keep every layer editable.</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-ink-muted">{sel.type === 'rect' && sel.radius ? 'Rounded' : sel.type}</div>
                <div className="flex items-center gap-1">
                  <button onClick={() => zOrder(1)} title="Bring forward" className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-card"><Layers size={15} /></button>
                  <button onClick={dupSel} title="Duplicate" className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-card"><Copy size={15} /></button>
                  <button onClick={removeSel} title="Delete" className="p-1.5 rounded-lg text-ink-muted hover:text-terra hover:bg-card"><Trash2 size={15} /></button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Num label="X" value={sel.x} onChange={n => updateSel({ x: n })} />
                <Num label="Y" value={sel.y} onChange={n => updateSel({ y: n })} />
                <Num label="W" value={sel.w} onChange={n => updateSel({ w: Math.max(8, n) })} />
                <Num label="H" value={sel.h} onChange={n => updateSel({ h: Math.max(8, n) })} />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-ink-muted mb-1"><span>Rotation</span><span>{Math.round(sel.rotation)}°</span></div>
                <input type="range" min={0} max={359} value={sel.rotation} onChange={e => updateSel({ rotation: Number(e.target.value) })} className="w-full accent-terra" />
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-ink-muted mb-1"><span>Opacity</span><span>{Math.round(sel.opacity * 100)}%</span></div>
                <input type="range" min={0} max={1} step={0.05} value={sel.opacity} onChange={e => updateSel({ opacity: Number(e.target.value) })} className="w-full accent-terra" />
              </div>

              {sel.type === 'text' && (
                <div className="space-y-2">
                  <textarea value={sel.text || ''} onChange={e => updateSel({ text: e.target.value })} rows={2} className="w-full bg-cream border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra resize-none" />
                  <div className="flex items-center gap-2">
                    <select value={sel.fontFamily} onChange={e => updateSel({ fontFamily: e.target.value })} className="flex-1 bg-cream border border-cream-dark rounded-lg px-2 py-1.5 text-sm text-ink focus:outline-none focus:border-terra">
                      {LFONTS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                    </select>
                    <Num label="" value={sel.fontSize || 48} onChange={n => updateSel({ fontSize: Math.max(6, n) })} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => updateSel({ bold: !sel.bold })} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${sel.bold ? 'bg-terra text-cream' : 'text-ink-muted hover:bg-card'}`}>B</button>
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a} onClick={() => updateSel({ align: a })} className={`px-3 py-1.5 rounded-lg text-sm ${sel.align === a ? 'bg-terra text-cream' : 'text-ink-muted hover:bg-card'}`}>{a[0].toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* fill */}
              <div>
                <div className="text-xs text-ink-muted mb-1.5">{sel.type === 'text' ? 'Colour' : 'Fill'}</div>
                <div className="flex gap-1 mb-2">
                  {(['solid', 'gradient', 'none'] as const).map(m => (
                    <button key={m} onClick={() => {
                      if (m === 'solid') updateSel({ fill: solidColor });
                      else if (m === 'none') updateSel({ fill: 'none' });
                      else updateSel({ fill: grad });
                    }} className={`flex-1 py-1.5 rounded-lg text-xs font-medium capitalize ${fillMode === m ? 'bg-terra text-cream' : 'text-ink-muted hover:bg-card'}`}>{m}</button>
                  ))}
                </div>
                {fillMode === 'solid' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="w-8 h-8 rounded-lg border-2 border-cream-dark overflow-hidden cursor-pointer" style={{ background: solidColor }}>
                      <input type="color" value={solidColor} onChange={e => updateSel({ fill: e.target.value })} className="opacity-0 w-full h-full cursor-pointer" />
                    </label>
                    {SWATCHES.map(c => <button key={c} onClick={() => updateSel({ fill: c })} className="w-6 h-6 rounded-md border border-cream-dark" style={{ background: c }} />)}
                  </div>
                )}
                {fillMode === 'gradient' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="w-8 h-8 rounded-lg border-2 border-cream-dark overflow-hidden cursor-pointer" style={{ background: grad.from }}><input type="color" value={grad.from} onChange={e => updateSel({ fill: { ...grad, from: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" /></label>
                      <span className="text-ink-muted text-xs">→</span>
                      <label className="w-8 h-8 rounded-lg border-2 border-cream-dark overflow-hidden cursor-pointer" style={{ background: grad.to }}><input type="color" value={grad.to} onChange={e => updateSel({ fill: { ...grad, to: e.target.value } })} className="opacity-0 w-full h-full cursor-pointer" /></label>
                      <div className="flex-1 h-8 rounded-lg border border-cream-dark" style={{ background: `linear-gradient(${grad.angle}deg, ${grad.from}, ${grad.to})` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink-muted"><span>Angle</span><span>{grad.angle}°</span></div>
                    <input type="range" min={0} max={359} value={grad.angle} onChange={e => updateSel({ fill: { ...grad, angle: Number(e.target.value) } })} className="w-full accent-terra" />
                  </div>
                )}
              </div>

              {/* stroke */}
              {sel.type !== 'image' && (
                <div>
                  <div className="text-xs text-ink-muted mb-1.5">{sel.type === 'line' || sel.type === 'path' ? 'Colour' : 'Border'}</div>
                  <div className="flex items-center gap-2">
                    <label className="w-8 h-8 rounded-lg border-2 border-cream-dark overflow-hidden cursor-pointer" style={{ background: sel.stroke === 'none' ? '#00000000' : sel.stroke }}>
                      <input type="color" value={sel.stroke === 'none' ? '#000000' : sel.stroke} onChange={e => updateSel({ stroke: e.target.value })} className="opacity-0 w-full h-full cursor-pointer" />
                    </label>
                    <Num label="W" value={sel.strokeWidth} onChange={n => updateSel({ strokeWidth: Math.max(0, n) })} />
                    {sel.type !== 'line' && sel.type !== 'path' && <button onClick={() => updateSel({ stroke: 'none', strokeWidth: 0 })} className="text-xs text-ink-muted hover:text-terra px-2 py-1">clear</button>}
                  </div>
                </div>
              )}

              {sel.type === 'rect' && (
                <div>
                  <div className="flex items-center justify-between text-xs text-ink-muted mb-1"><span>Corner radius</span><span>{sel.radius || 0}</span></div>
                  <input type="range" min={0} max={Math.round(Math.min(sel.w, sel.h) / 2)} value={sel.radius || 0} onChange={e => updateSel({ radius: Number(e.target.value) })} className="w-full accent-terra" />
                </div>
              )}

              {/* adjustments */}
              <div className="pt-3 border-t border-cream-dark space-y-2">
                <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-muted"><SlidersHorizontal size={13} /> Adjust</div>
                {([['Brightness', 'bright', 0, 2], ['Contrast', 'contrast', 0, 2], ['Saturation', 'sat', 0, 2], ['Blur', 'blur', 0, 40]] as const).map(([lab, key, min, max]) => {
                  const def = key === 'blur' ? 0 : 1; const val = (sel as any)[key] ?? def;
                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between text-xs text-ink-muted"><span>{lab}</span><button onClick={() => updateSel({ [key]: def } as any)} className="hover:text-terra">{key === 'blur' ? val : Math.round(val * 100) + '%'}</button></div>
                      <input type="range" min={min} max={max} step={key === 'blur' ? 1 : 0.01} value={val} onChange={e => updateSel({ [key]: Number(e.target.value) } as any)} className="w-full accent-terra" />
                    </div>
                  );
                })}
              </div>

              {/* image-only tools */}
              {sel.type === 'image' && (
                <div className="pt-3 border-t border-cream-dark space-y-3">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-ink-muted"><Wand2 size={13} /> Edit photo</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => startImgTool('crop')} className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-medium transition-colors ${imgTool === 'crop' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink hover:border-terra'}`}><Crop size={15} /> Crop</button>
                    <button onClick={() => startImgTool('wand')} className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-medium transition-colors ${imgTool === 'wand' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink hover:border-terra'}`}><Eraser size={15} /> Magic erase</button>
                    <button onClick={() => startImgTool('lasso')} className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2 text-sm font-medium transition-colors ${imgTool === 'lasso' ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink hover:border-terra'}`}><Scissors size={15} /> Lasso</button>
                    <button onClick={saveAsSticker} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-cream-dark text-ink py-2 text-sm font-medium hover:border-terra transition-colors"><Sticker size={15} /> Save sticker</button>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-ink-muted mb-1"><span>Remove background</span><span>tol {tol}</span></div>
                    <input type="range" min={2} max={100} value={tol} onChange={e => setTol(Number(e.target.value))} className="w-full accent-terra mb-2" />
                    <div className="flex gap-2">
                      <button onClick={applyBg} className="flex-1 bg-ink text-cream rounded-full py-2 text-sm hover:bg-terra transition-colors">Remove BG</button>
                      {sel.origSrc && <button onClick={resetBg} className="rounded-full border border-cream-dark px-3 text-sm text-ink hover:border-terra transition-colors">Reset</button>}
                    </div>
                    <p className="text-[11px] text-ink-muted mt-1.5 leading-snug">Best on clean, even backgrounds. Use Magic erase to tap away leftover spots.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* sticker tray */}
      {showStickers && (
        <div className="absolute left-0 right-0 sm:right-72 bottom-0 z-20 bg-cream border-t border-cream-dark p-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sticker size={15} className="text-terra" />
            <span className="text-sm font-medium text-ink">Stickers</span>
            <span className="text-xs text-ink-muted">tap to place · reused across photos</span>
            <div className="flex-1" />
            <button onClick={() => stickerRef.current?.click()} className="flex items-center gap-1 text-sm text-terra"><Plus size={14} /> Import</button>
            <button onClick={() => setShowStickers(false)} className="text-ink-muted hover:text-ink p-1"><X size={16} /></button>
          </div>
          <input ref={stickerRef} type="file" accept="image/*" onChange={importSticker} className="hidden" />
          {stickers.length === 0 ? (
            <p className="text-xs text-ink-muted py-4 text-center">No stickers yet — import an image, or select a photo layer and tap “Save sticker”.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {stickers.map((s, i) => (
                <div key={i} className="relative shrink-0 group">
                  <button onClick={() => placeSticker(s)} className="w-16 h-16 rounded-xl border border-cream-dark bg-card overflow-hidden hover:border-terra transition-colors" style={{ backgroundImage: `url(${s})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
                  <button onClick={() => setStickers(list => list.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 bg-ink text-cream rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============ AUDIO EDITOR: DSP helpers ============
interface AClip { id: string; name: string; buffer: AudioBuffer; start: number; end: number; volume: number; speed: number; pitch: number; bass: number; fadeIn: number; fadeOut: number; color: string }

function sliceBuffer(ctx: BaseAudioContext, buf: AudioBuffer, start: number, end: number): AudioBuffer {
  const s = Math.max(0, Math.floor(start * buf.sampleRate));
  const e = Math.min(buf.length, Math.floor(end * buf.sampleRate));
  const len = Math.max(1, e - s);
  const out = ctx.createBuffer(buf.numberOfChannels, len, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(s, e));
  return out;
}
function resampleBuf(ctx: BaseAudioContext, buf: AudioBuffer, factor: number): AudioBuffer {
  const nch = buf.numberOfChannels, sr = buf.sampleRate;
  const outLen = Math.max(1, Math.floor(buf.length / factor));
  const out = ctx.createBuffer(nch, outLen, sr);
  for (let ch = 0; ch < nch; ch++) {
    const ib = buf.getChannelData(ch), ob = out.getChannelData(ch);
    for (let i = 0; i < outLen; i++) { const pos = i * factor, i0 = Math.floor(pos), frac = pos - i0, a = ib[i0] || 0, b = ib[i0 + 1] || 0; ob[i] = a + (b - a) * frac; }
  }
  return out;
}
function timeStretchBuf(ctx: BaseAudioContext, buf: AudioBuffer, stretch: number): AudioBuffer {
  if (Math.abs(stretch - 1) < 1e-3) return buf;
  const nch = buf.numberOfChannels, sr = buf.sampleRate;
  const grain = Math.max(256, Math.floor(0.06 * sr)), hopOut = Math.floor(grain / 2), hopIn = Math.max(1, Math.floor(hopOut / stretch));
  const outLen = Math.max(1, Math.floor(buf.length * stretch) + grain);
  const out = ctx.createBuffer(nch, outLen, sr);
  for (let ch = 0; ch < nch; ch++) {
    const ib = buf.getChannelData(ch), ob = out.getChannelData(ch);
    let ip = 0, op = 0;
    while (op + grain < outLen && ip + grain < buf.length) {
      for (let i = 0; i < grain; i++) { const wnd = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / grain); ob[op + i] += ib[ip + i] * wnd; }
      op += hopOut; ip += hopIn;
    }
  }
  return out;
}
// independent pitch shift (semitones), preserves duration
function pitchShiftBuf(ctx: BaseAudioContext, buf: AudioBuffer, semitones: number): AudioBuffer {
  if (!semitones) return buf;
  const f = Math.pow(2, semitones / 12);
  return timeStretchBuf(ctx, resampleBuf(ctx, buf, f), f);
}
async function renderArrangement(clips: AClip[]): Promise<AudioBuffer | null> {
  if (!clips.length) return null;
  const sr = 44100;
  const total = clips.reduce((s, c) => s + (c.end - c.start) / c.speed, 0);
  const len = Math.max(1, Math.ceil(total * sr) + sr);
  const OAC = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext);
  const off: OfflineAudioContext = new OAC(2, len, sr);
  let t = 0;
  for (const c of clips) {
    const slice = sliceBuffer(off, c.buffer, c.start, c.end);
    const eff = c.pitch ? pitchShiftBuf(off, slice, c.pitch) : slice;
    const src = off.createBufferSource(); src.buffer = eff; src.playbackRate.value = c.speed;
    const bass = off.createBiquadFilter(); bass.type = 'lowshelf'; bass.frequency.value = 220; bass.gain.value = c.bass;
    const g = off.createGain();
    const dur = eff.duration / c.speed;
    const v = c.volume, endT = t + dur;
    g.gain.setValueAtTime(c.fadeIn > 0 ? 0.0001 : v, t);
    if (c.fadeIn > 0) g.gain.linearRampToValueAtTime(v, t + Math.min(c.fadeIn, dur));
    if (c.fadeOut > 0) { g.gain.setValueAtTime(v, Math.max(t, endT - c.fadeOut)); g.gain.linearRampToValueAtTime(0.0001, endT); }
    src.connect(bass); bass.connect(g); g.connect(off.destination); src.start(t);
    t += dur;
  }
  return await off.startRendering();
}
function encodeWAV(buf: AudioBuffer): Blob {
  const nch = Math.min(2, buf.numberOfChannels), sr = buf.sampleRate, n = buf.length;
  const bytes = 44 + n * nch * 2;
  const ab = new ArrayBuffer(bytes); const view = new DataView(ab);
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  wr(0, 'RIFF'); view.setUint32(4, bytes - 8, true); wr(8, 'WAVE'); wr(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, nch, true); view.setUint32(24, sr, true); view.setUint32(28, sr * nch * 2, true);
  view.setUint16(32, nch * 2, true); view.setUint16(34, 16, true); wr(36, 'data'); view.setUint32(40, n * nch * 2, true);
  let off = 44;
  const chans = []; for (let ch = 0; ch < nch; ch++) chans.push(buf.getChannelData(ch));
  for (let i = 0; i < n; i++) for (let ch = 0; ch < nch; ch++) { let s = Math.max(-1, Math.min(1, chans[ch][i])); view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2; }
  return new Blob([ab], { type: 'audio/wav' });
}
// synthesized, dependency-free sound-effects library
const SFX_KINDS = ['Beep', 'Click', 'Pop', 'Whoosh', 'Chime', 'Kick'];
function makeSfx(ctx: BaseAudioContext, kind: string): AudioBuffer {
  const sr = ctx.sampleRate;
  const dur = kind === 'Click' ? 0.04 : kind === 'Chime' ? 0.6 : kind === 'Whoosh' ? 0.45 : 0.22;
  const n = Math.floor(dur * sr); const out = ctx.createBuffer(1, n, sr); const d = out.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const x = i / sr, p = i / n, env = Math.exp(-4 * p);
    let s = 0;
    if (kind === 'Beep') s = Math.sin(2 * Math.PI * 880 * x) * env;
    else if (kind === 'Click') s = (Math.random() * 2 - 1) * Math.exp(-30 * p);
    else if (kind === 'Pop') s = Math.sin(2 * Math.PI * (600 - 450 * p) * x) * env;
    else if (kind === 'Whoosh') s = (Math.random() * 2 - 1) * Math.sin(Math.PI * p) * 0.7;
    else if (kind === 'Chime') s = (Math.sin(2 * Math.PI * 1046 * x) + 0.6 * Math.sin(2 * Math.PI * 1568 * x)) * env * 0.5;
    else if (kind === 'Kick') s = Math.sin(2 * Math.PI * (120 - 75 * p) * x) * Math.exp(-6 * p);
    d[i] = s * 0.8;
  }
  return out;
}
const CLIP_COLORS = ['#C8553D', '#E8A33D', '#5C8A5A', '#3D7EA6', '#7B5EA7', '#C86B98'];

// The audio editor — cut into clips, tune each, mix a sound library, export WAV.
function AudioEditor({ name, srcDataUrl, theme, onClose }: { name: string; srcDataUrl?: string; theme: string; onClose: () => void }) {
  const [clips, setClips] = useState<AClip[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [tool, setTool] = useState<'select' | 'cut'>('select');
  const [loading, setLoading] = useState(!!srcDataUrl);
  const [playing, setPlaying] = useState(false);
  const [playPos, setPlayPos] = useState(0); // 0..1
  const [imported, setImported] = useState<{ name: string; buffer: AudioBuffer }[]>([]);
  const acRef = useRef<AudioContext | null>(null);
  const srcNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const impRef = useRef<HTMLInputElement>(null);

  const ac = () => { if (!acRef.current) { const AC = (window.AudioContext || (window as any).webkitAudioContext); acRef.current = new AC(); } return acRef.current!; };
  const sel = clips.find(c => c.id === selId) || null;
  const totalDur = clips.reduce((s, c) => s + (c.end - c.start) / c.speed, 0);
  const nextColor = () => CLIP_COLORS[clips.length % CLIP_COLORS.length];

  // decode the opened file
  useEffect(() => {
    let dead = false;
    if (!srcDataUrl) return;
    (async () => {
      try {
        const ab = await (await fetch(srcDataUrl)).arrayBuffer();
        const buffer = await ac().decodeAudioData(ab);
        if (dead) return;
        setClips([{ id: lid(), name: baseName(name), buffer, start: 0, end: buffer.duration, volume: 1, speed: 1, pitch: 0, bass: 0, fadeIn: 0, fadeOut: 0, color: CLIP_COLORS[0] }]);
      } catch { /* unsupported */ }
      if (!dead) setLoading(false);
    })();
    return () => { dead = true; };
  }, [srcDataUrl]);

  // draw the waveform whenever clips/selection change or on resize
  useEffect(() => {
    const draw = () => {
      const cv = canvasRef.current, wrap = wrapRef.current; if (!cv || !wrap) return;
      const W = wrap.clientWidth, H = 170; const dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const g = cv.getContext('2d')!; g.scale(dpr, dpr); g.clearRect(0, 0, W, H);
      const mid = H / 2;
      if (!clips.length) return;
      let x = 0;
      for (const c of clips) {
        const dur = (c.end - c.start) / c.speed; const cw = Math.max(2, (dur / totalDur) * W);
        g.fillStyle = c.id === selId ? (theme === 'dark' ? 'rgba(200,85,61,0.22)' : 'rgba(200,85,61,0.14)') : 'transparent';
        g.fillRect(x, 0, cw, H);
        // waveform peaks
        const data = c.buffer.getChannelData(0); const s0 = Math.floor(c.start * c.buffer.sampleRate), s1 = Math.floor(c.end * c.buffer.sampleRate);
        const span = Math.max(1, s1 - s0); const step = Math.max(1, Math.floor(span / cw));
        g.strokeStyle = c.color; g.globalAlpha = 0.9; g.beginPath();
        for (let px = 0; px < cw; px++) {
          let mn = 1, mx = -1; const a = s0 + Math.floor((px / cw) * span);
          for (let k = 0; k < step; k++) { const v = data[a + k] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
          g.moveTo(x + px, mid + mn * mid * 0.9); g.lineTo(x + px, mid + mx * mid * 0.9);
        }
        g.stroke(); g.globalAlpha = 1;
        // divider
        g.strokeStyle = theme === 'dark' ? '#2b2620' : '#d8ccb6'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
        x += cw;
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [clips, selId, theme, totalDur]);

  const stop = () => { try { srcNodeRef.current?.stop(); } catch { /* already */ } srcNodeRef.current = null; if (rafRef.current) cancelAnimationFrame(rafRef.current); setPlaying(false); setPlayPos(0); };
  const play = async () => {
    if (playing) { stop(); return; }
    const rendered = await renderArrangement(clips); if (!rendered) return;
    const ctx = ac(); if (ctx.state === 'suspended') await ctx.resume();
    const node = ctx.createBufferSource(); node.buffer = rendered; node.connect(ctx.destination);
    const startT = ctx.currentTime; node.start(); srcNodeRef.current = node; setPlaying(true);
    node.onended = () => { srcNodeRef.current = null; setPlaying(false); setPlayPos(0); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    const tick = () => { const el = ctx.currentTime - startT; setPlayPos(Math.min(1, el / rendered.duration)); if (srcNodeRef.current) rafRef.current = requestAnimationFrame(tick); };
    tick();
  };
  useEffect(() => () => { try { srcNodeRef.current?.stop(); } catch { /* */ } if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  const onCanvasDown = (e: React.PointerEvent) => {
    const cv = canvasRef.current; if (!cv || !clips.length) return;
    const rect = cv.getBoundingClientRect(); const x = e.clientX - rect.left; const W = rect.width;
    // find clip under x
    let acc = 0, hit: AClip | null = null, hitLeft = 0, hitW = 0;
    for (const c of clips) { const cw = ((c.end - c.start) / c.speed / totalDur) * W; if (x >= acc && x <= acc + cw) { hit = c; hitLeft = acc; hitW = cw; break; } acc += cw; }
    if (!hit) return;
    if (tool === 'select') { setSelId(hit.id); return; }
    // cut: split the clip at the clicked time
    const frac = (x - hitLeft) / hitW; const cutTime = hit.start + frac * (hit.end - hit.start);
    if (cutTime <= hit.start + 0.01 || cutTime >= hit.end - 0.01) return;
    setClips(list => {
      const i = list.findIndex(c => c.id === hit!.id); if (i < 0) return list;
      const a = { ...hit!, end: cutTime };
      const b = { ...hit!, id: lid(), start: cutTime, fadeIn: 0, color: CLIP_COLORS[(i + 1) % CLIP_COLORS.length] };
      const arr = [...list]; arr.splice(i, 1, a, b); return arr;
    });
  };

  const updateSel = (patch: Partial<AClip>) => { if (!selId) return; setClips(list => list.map(c => c.id === selId ? { ...c, ...patch } : c)); };
  const removeSel = () => { if (!selId) return; setClips(list => list.filter(c => c.id !== selId)); setSelId(null); };

  const addClipBuffer = (buffer: AudioBuffer, nm: string) => { const c: AClip = { id: lid(), name: nm, buffer, start: 0, end: buffer.duration, volume: 1, speed: 1, pitch: 0, bass: 0, fadeIn: 0, fadeOut: 0, color: nextColor() }; setClips(list => [...list, c]); setSelId(c.id); };
  const addSfx = (kind: string) => addClipBuffer(makeSfx(ac(), kind), kind);
  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = async () => { try { const ab = reader.result as ArrayBuffer; const buffer = await ac().decodeAudioData(ab.slice(0)); setImported(list => [{ name: baseName(f.name), buffer }, ...list].slice(0, 20)); addClipBuffer(buffer, baseName(f.name)); } catch { /* unsupported */ } };
    reader.readAsArrayBuffer(f); e.target.value = '';
  };
  const exportWav = async () => { const r = await renderArrangement(clips); if (r) downloadBlob(encodeWAV(r), `${baseName(name)}.wav`); };

  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const panelBg = theme === 'dark' ? '#17150F' : '#F3EBDD';
  const Slider = ({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) => (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-muted mb-1"><span>{label}</span><span>{fmt(value)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-terra" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-cream-dark shrink-0 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-1 text-sm text-terra mr-1"><ChevronLeft size={16} /> Files</button>
        <span className="text-sm text-ink-muted mr-2 truncate max-w-[24vw] hidden sm:block">{name}</span>
        <div className="w-px h-6 bg-cream-dark mx-1" />
        <button onClick={() => setTool('select')} title="Select" className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${tool === 'select' ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink hover:bg-card'}`}><MousePointerClick size={17} strokeWidth={1.9} /></button>
        <button onClick={() => setTool('cut')} title="Cut into clips" className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${tool === 'cut' ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink hover:bg-card'}`}><Scissors size={16} strokeWidth={1.9} /></button>
        <div className="w-px h-6 bg-cream-dark mx-1" />
        <button onClick={play} disabled={!clips.length} title="Play / stop" className="w-9 h-9 rounded-lg flex items-center justify-center bg-ink text-cream hover:bg-terra transition-colors disabled:opacity-40">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <span className="text-xs text-ink-muted ml-1 tabular-nums">{fmtT(totalDur)}</span>
        <div className="flex-1" />
        <button onClick={exportWav} disabled={!clips.length} className="flex items-center gap-1.5 bg-ink text-cream rounded-full px-3 py-1.5 text-sm hover:bg-terra transition-colors disabled:opacity-40"><Download size={14} strokeWidth={2} /> WAV</button>
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close"><X size={20} /></button>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6" style={{ background: theme === 'dark' ? '#0F0D0A' : '#E7DECB' }}>
          {loading ? (
            <div className="h-full flex items-center justify-center text-ink-muted">Decoding audio…</div>
          ) : !clips.length ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <Music size={30} className="text-terra mb-3" strokeWidth={1.5} />
              <p className="font-display text-2xl italic text-ink-muted">No sound yet</p>
              <p className="text-sm text-ink-muted mt-1">Add a sound effect or import audio from the panel.</p>
            </div>
          ) : (
            <div ref={wrapRef} className="relative bg-card rounded-2xl border border-cream-dark p-2" style={{ cursor: tool === 'cut' ? 'col-resize' : 'default' }}>
              <canvas ref={canvasRef} onPointerDown={onCanvasDown} className="w-full block rounded-xl" />
              <div className="absolute top-2 bottom-2 w-0.5 bg-ink pointer-events-none" style={{ left: `calc(0.5rem + ${playPos * 100}% - ${playPos * 1}rem)`, opacity: playing ? 0.8 : 0 }} />
              <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-ink-muted">
                <span>{clips.length} clip{clips.length === 1 ? '' : 's'}</span>
                <span>{tool === 'cut' ? 'Tap the wave to split' : 'Tap a clip to edit it'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="w-full sm:w-72 shrink-0 border-t sm:border-t-0 sm:border-l border-cream-dark overflow-y-auto" style={{ background: panelBg }}>
          {sel ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0"><span className="w-3 h-3 rounded-full shrink-0" style={{ background: sel.color }} /><span className="text-sm font-medium text-ink truncate">{sel.name}</span></div>
                <button onClick={removeSel} title="Delete clip" className="p-1.5 rounded-lg text-ink-muted hover:text-terra hover:bg-card"><Trash2 size={15} /></button>
              </div>
              <div className="text-[11px] text-ink-muted">{((sel.end - sel.start) / sel.speed).toFixed(2)}s</div>
              <Slider label="Volume" value={sel.volume} min={0} max={1.5} step={0.01} onChange={n => updateSel({ volume: n })} fmt={n => Math.round(n * 100) + '%'} />
              <Slider label="Speed (tape — moves pitch)" value={sel.speed} min={0.5} max={2} step={0.01} onChange={n => updateSel({ speed: n })} fmt={n => n.toFixed(2) + '×'} />
              <Slider label="Pitch" value={sel.pitch} min={-12} max={12} step={1} onChange={n => updateSel({ pitch: n })} fmt={n => (n > 0 ? '+' : '') + n + ' st'} />
              <Slider label="Bass" value={sel.bass} min={-20} max={20} step={1} onChange={n => updateSel({ bass: n })} fmt={n => (n > 0 ? '+' : '') + n + ' dB'} />
              <Slider label="Fade in" value={sel.fadeIn} min={0} max={2} step={0.05} onChange={n => updateSel({ fadeIn: n })} fmt={n => n.toFixed(2) + 's'} />
              <Slider label="Fade out" value={sel.fadeOut} min={0} max={2} step={0.05} onChange={n => updateSel({ fadeOut: n })} fmt={n => n.toFixed(2) + 's'} />
              <button onClick={() => { setSelId(null); }} className="w-full py-2 rounded-full border border-cream-dark text-ink-muted text-sm hover:border-terra transition-colors">Done</button>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted mb-2">Sound library</div>
                <div className="grid grid-cols-2 gap-2">
                  {SFX_KINDS.map(k => (
                    <button key={k} onClick={() => addSfx(k)} className="flex items-center gap-2 rounded-xl border-2 border-cream-dark py-2.5 px-3 text-sm font-medium text-ink hover:border-terra transition-colors"><Volume2 size={14} className="text-terra" /> {k}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase tracking-wider text-ink-muted">Your sounds</div>
                  <button onClick={() => impRef.current?.click()} className="flex items-center gap-1 text-sm text-terra"><Plus size={14} /> Import</button>
                </div>
                <input ref={impRef} type="file" accept="audio/*" onChange={onImport} className="hidden" />
                {imported.length === 0 ? (
                  <p className="text-xs text-ink-muted">Import a clip to reuse it here this session.</p>
                ) : (
                  <div className="space-y-1.5">
                    {imported.map((s, i) => (
                      <button key={i} onClick={() => addClipBuffer(s.buffer, s.name)} className="w-full flex items-center gap-2 bg-card border border-cream-dark rounded-xl px-3 py-2 text-left hover:border-terra transition-colors"><Music size={14} className="text-terra shrink-0" /><span className="text-sm text-ink truncate">{s.name}</span></button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-ink-muted leading-relaxed pt-2 border-t border-cream-dark">Add sounds, then use the scissors to cut the wave into clips. Tap a clip to tune its volume, speed, pitch, bass and fades. Export mixes everything to a WAV.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ VIDEO EDITOR ============
interface VText { id: string; text: string; x: number; y: number; size: number; color: string; bg: boolean; start: number; end: number }
interface Keep { id: string; start: number; end: number }
const VFX = ['none', 'vivid', 'warm', 'cool', 'grayscale', 'sepia', 'vintage', 'noir', 'vignette'] as const;
type Vfx = typeof VFX[number];
const TEXT_PRESETS: { label: string; patch: Partial<VText> }[] = [
  { label: 'Caption', patch: { y: 0.88, size: 0.06, color: '#ffffff', bg: true } },
  { label: 'Title', patch: { y: 0.16, size: 0.11, color: '#ffffff', bg: false } },
  { label: 'Lower third', patch: { x: 0.04, y: 0.8, size: 0.05, color: '#ffffff', bg: true } },
  { label: 'Bold center', patch: { y: 0.5, size: 0.13, color: '#ffffff', bg: false } },
];

// Easy video editor — trim, cut, text, colour, effects & audio; exports WebM in-browser.
function VideoEditor({ name, srcUrl, theme, onClose }: { name: string; srcUrl: string; theme: string; onClose: () => void }) {
  const [ready, setReady] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [keep, setKeep] = useState<Keep[]>([]);
  const [texts, setTexts] = useState<VText[]>([]);
  const [selText, setSelText] = useState<string | null>(null);
  const [adjust, setAdjust] = useState({ bright: 1, contrast: 1, sat: 1, blur: 0 });
  const [effect, setEffect] = useState<Vfx>('none');
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [tab, setTab] = useState<'trim' | 'text' | 'adjust' | 'fx' | 'audio'>('trim');
  const [exporting, setExporting] = useState(false);
  const [exportPct, setExportPct] = useState(0);
  const [msg, setMsg] = useState('');

  const vidRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const segRef = useRef(0);
  const barRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<any>(null);
  const acRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const tappedRef = useRef(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const onEndRef = useRef<null | (() => void)>(null);
  const exportingRef = useRef(false);

  const keptDur = keep.reduce((s, k) => s + (k.end - k.start), 0);
  const sel = texts.find(t => t.id === selText) || null;
  const panelBg = theme === 'dark' ? '#17150F' : '#F3EBDD';

  const filterCss = () => {
    let f = `brightness(${adjust.bright}) contrast(${adjust.contrast}) saturate(${adjust.sat})`;
    if (adjust.blur > 0) f += ` blur(${adjust.blur}px)`;
    if (effect === 'grayscale' || effect === 'noir') f += ' grayscale(1)';
    if (effect === 'sepia') f += ' sepia(0.7)';
    if (effect === 'vintage') f += ' sepia(0.4) contrast(1.08)';
    if (effect === 'vivid') f += ' saturate(1.5) contrast(1.08)';
    if (effect === 'noir') f += ' contrast(1.25)';
    return f;
  };

  // one draw of the current frame + overlays
  const composite = () => {
    const v = vidRef.current, cv = canvasRef.current; if (!v || !cv) return;
    const g = cv.getContext('2d'); if (!g) return;
    g.filter = filterCss();
    g.drawImage(v, 0, 0, cv.width, cv.height);
    g.filter = 'none';
    if (effect === 'warm') { g.fillStyle = 'rgba(255,150,40,0.14)'; g.fillRect(0, 0, cv.width, cv.height); }
    if (effect === 'cool') { g.fillStyle = 'rgba(40,120,255,0.14)'; g.fillRect(0, 0, cv.width, cv.height); }
    if (effect === 'vintage' || effect === 'noir' || effect === 'vignette') {
      const cx = cv.width / 2, cy = cv.height / 2, r = Math.max(cx, cy);
      const grd = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.5)');
      g.fillStyle = grd; g.fillRect(0, 0, cv.width, cv.height);
    }
    const t = v.currentTime;
    for (const tx of texts) {
      if (t < tx.start || t > tx.end) continue;
      const fpx = tx.size * cv.height; g.font = `700 ${fpx}px sans-serif`; g.textBaseline = 'middle';
      const tw = g.measureText(tx.text).width; const px = tx.x * cv.width, py = tx.y * cv.height;
      const anchorX = tx.x <= 0.06 ? px : px - tw / 2;
      if (tx.bg) { g.fillStyle = 'rgba(0,0,0,0.5)'; const pad = fpx * 0.3; g.fillRect(anchorX - pad, py - fpx / 2 - pad, tw + pad * 2, fpx + pad * 2); }
      g.fillStyle = tx.color; g.fillText(tx.text, anchorX, py);
    }
  };

  // main loop: draw + enforce kept-segment playback
  useEffect(() => {
    const loop = () => {
      const v = vidRef.current;
      if (v && ready) {
        composite();
        if (!v.paused && keep.length) {
          const seg = keep[segRef.current] || keep[keep.length - 1];
          if (v.currentTime >= seg.end - 0.02) {
            if (segRef.current < keep.length - 1) { segRef.current++; v.currentTime = keep[segRef.current].start; }
            else { v.pause(); setPlaying(false); const cb = onEndRef.current; onEndRef.current = null; if (cb) cb(); }
          }
          setCur(v.currentTime);
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ready, keep, texts, adjust, effect]);

  // preview volume (until the audio graph is tapped for export)
  useEffect(() => { const v = vidRef.current; if (!v) return; if (tappedRef.current && gainRef.current) gainRef.current.gain.value = muted ? 0 : volume; else { v.volume = volume; v.muted = muted; } }, [volume, muted]);

  const onLoaded = () => {
    const v = vidRef.current; if (!v) return;
    const d = v.duration || 0; setDur(d); setKeep([{ id: lid(), start: 0, end: d }]);
    const cv = canvasRef.current!;
    const scale = Math.min(1, 1280 / (v.videoWidth || 1280));
    cv.width = Math.round((v.videoWidth || 1280) * scale); cv.height = Math.round((v.videoHeight || 720) * scale);
    v.volume = volume; setReady(true); setTimeout(composite, 50);
  };

  const play = () => {
    const v = vidRef.current; if (!v || !keep.length) return;
    if (playing) { v.pause(); setPlaying(false); return; }
    let idx = keep.findIndex(k => v.currentTime >= k.start && v.currentTime < k.end);
    if (idx < 0) { idx = 0; v.currentTime = keep[0].start; }
    segRef.current = idx; v.play(); setPlaying(true);
  };

  const seekTo = (t: number) => { const v = vidRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(dur, t)); segRef.current = Math.max(0, keep.findIndex(k => t >= k.start && t <= k.end)); setCur(v.currentTime); setTimeout(composite, 30); };

  const barXtoT = (clientX: number) => { const r = barRef.current!.getBoundingClientRect(); return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * dur; };
  const onBarDown = (e: React.PointerEvent) => { if (drag.current) return; seekTo(barXtoT(e.clientX)); };
  const startTrim = (e: React.PointerEvent, side: 'l' | 'r') => { e.stopPropagation(); drag.current = { side }; };
  useEffect(() => {
    const move = (e: PointerEvent) => { if (!drag.current) return; const t = barXtoT(e.clientX); setKeep(ks => { const arr = [...ks]; if (drag.current.side === 'l') arr[0] = { ...arr[0], start: Math.min(t, arr[0].end - 0.1) }; else arr[arr.length - 1] = { ...arr[arr.length - 1], end: Math.max(t, arr[arr.length - 1].start + 0.1) }; return arr; }); };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, [dur]);

  const splitAt = () => { const t = cur; setKeep(ks => { const i = ks.findIndex(k => t > k.start + 0.05 && t < k.end - 0.05); if (i < 0) return ks; const a = { ...ks[i], end: t }, b = { id: lid(), start: t, end: ks[i].end }; const arr = [...ks]; arr.splice(i, 1, a, b); return arr; }); };
  const deleteSeg = () => { const t = cur; setKeep(ks => { if (ks.length <= 1) return ks; const i = ks.findIndex(k => t >= k.start && t <= k.end); if (i < 0) return ks; return ks.filter((_, j) => j !== i); }); };

  const addText = (preset?: Partial<VText>) => { const tx: VText = { id: lid(), text: 'Your text', x: 0.5, y: 0.85, size: 0.06, color: '#ffffff', bg: true, start: 0, end: dur, ...preset }; setTexts(list => [...list, tx]); setSelText(tx.id); setTab('text'); };
  const updateText = (patch: Partial<VText>) => { if (!selText) return; setTexts(list => list.map(t => t.id === selText ? { ...t, ...patch } : t)); };
  const delText = () => { if (!selText) return; setTexts(list => list.filter(t => t.id !== selText)); setSelText(null); };

  const ensureGraph = () => {
    const v = vidRef.current!; if (!acRef.current) { const AC = (window.AudioContext || (window as any).webkitAudioContext); acRef.current = new AC(); }
    const ac = acRef.current!;
    if (!tappedRef.current) { const src = ac.createMediaElementSource(v); const g = ac.createGain(); g.gain.value = muted ? 0 : volume; const dest = ac.createMediaStreamDestination(); src.connect(g); g.connect(ac.destination); g.connect(dest); gainRef.current = g; (ensureGraph as any)._dest = dest; tappedRef.current = true; }
    return { ac, dest: (ensureGraph as any)._dest as MediaStreamAudioDestinationNode };
  };

  const pickMime = () => ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(m => (window as any).MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';

  const exportVideo = async () => {
    const cv = canvasRef.current, v = vidRef.current; if (!cv || !v || !keep.length) return;
    if (typeof MediaRecorder === 'undefined' || !(cv as any).captureStream) { setMsg("This device can't export video in-app — try on desktop."); return; }
    const mime = pickMime(); if (!mime) { setMsg('No supported video recorder on this device.'); return; }
    let dest: MediaStreamAudioDestinationNode | null = null;
    try { const g = ensureGraph(); dest = g.dest; if (g.ac.state === 'suspended') await g.ac.resume(); } catch { dest = null; }
    const vstream = (cv as any).captureStream(30) as MediaStream;
    const tracks = [...vstream.getVideoTracks()];
    if (dest && !muted) tracks.push(...dest.stream.getAudioTracks());
    const stream = new MediaStream(tracks);
    const rec = new MediaRecorder(stream, { mimeType: mime }); recRef.current = rec;
    const chunks: BlobPart[] = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => { const ext = mime.includes('mp4') ? 'mp4' : 'webm'; downloadBlob(new Blob(chunks, { type: mime }), `${baseName(name)}.${ext}`); setExporting(false); setExportPct(0); };
    setExporting(true); exportingRef.current = true; setMsg('');
    segRef.current = 0; v.currentTime = keep[0].start; await v.play(); setPlaying(true); rec.start(100);
    onEndRef.current = () => { try { rec.stop(); } catch { /* */ } };
    // progress
    const startKept = 0; const total = keptDur || 1;
    const prog = () => {
      if (!exportingRef.current) return;
      let done = startKept; for (let i = 0; i < segRef.current; i++) done += (keep[i].end - keep[i].start);
      done += Math.max(0, (v.currentTime - keep[Math.min(segRef.current, keep.length - 1)].start));
      setExportPct(Math.min(100, Math.round((done / total) * 100)));
      requestAnimationFrame(prog);
    };
    requestAnimationFrame(prog);
  };
  useEffect(() => { exportingRef.current = exporting; }, [exporting]);

  const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const Slider = ({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fmt: (n: number) => string }) => (
    <div><div className="flex items-center justify-between text-xs text-ink-muted mb-1"><span>{label}</span><span>{fmt(value)}</span></div><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-terra" /></div>
  );
  const TabBtn = ({ id, icon: Ic, label }: { id: typeof tab; icon: any; label: string }) => (
    <button onClick={() => setTab(id)} className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[11px] font-medium transition-colors ${tab === id ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink hover:bg-card'}`}><Ic size={16} /> {label}</button>
  );

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center gap-1.5 px-3 sm:px-4 py-2 border-b border-cream-dark shrink-0">
        <button onClick={onClose} className="flex items-center gap-1 text-sm text-terra mr-1"><ChevronLeft size={16} /> Files</button>
        <span className="text-sm text-ink-muted truncate max-w-[30vw] hidden sm:block">{name}</span>
        <div className="flex-1" />
        {exporting ? (
          <span className="text-sm text-terra">Exporting… {exportPct}%</span>
        ) : (
          <button onClick={exportVideo} disabled={!ready} className="flex items-center gap-1.5 bg-ink text-cream rounded-full px-3 py-1.5 text-sm hover:bg-terra transition-colors disabled:opacity-40"><Download size={14} strokeWidth={2} /> Export</button>
        )}
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close"><X size={20} /></button>
      </div>

      <video ref={vidRef} src={srcUrl} onLoadedMetadata={onLoaded} playsInline crossOrigin="anonymous" className="hidden" />

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        <div className="flex-1 min-h-0 flex flex-col p-3 sm:p-5" style={{ background: theme === 'dark' ? '#0F0D0A' : '#E7DECB' }}>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-full max-h-full rounded-xl shadow-2xl bg-black" style={{ objectFit: 'contain' }} />
          </div>
          {msg && <div className="mt-2 text-center text-sm text-terra">{msg}</div>}
          {/* transport + timeline */}
          <div className="mt-3">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={play} disabled={!ready} className="w-10 h-10 rounded-full bg-ink text-cream flex items-center justify-center hover:bg-terra transition-colors disabled:opacity-40">{playing ? <Pause size={17} /> : <Play size={17} />}</button>
              <span className="text-xs text-ink-muted tabular-nums">{fmtT(cur)} / {fmtT(dur)}</span>
              <div className="flex-1" />
              <span className="text-xs text-ink-muted">kept {fmtT(keptDur)}</span>
            </div>
            <div ref={barRef} onPointerDown={onBarDown} className="relative h-10 rounded-xl bg-card border border-cream-dark cursor-pointer select-none overflow-hidden">
              {dur > 0 && keep.map(k => (
                <div key={k.id} className="absolute top-0 bottom-0 bg-terra-light" style={{ left: `${(k.start / dur) * 100}%`, width: `${((k.end - k.start) / dur) * 100}%` }} />
              ))}
              {dur > 0 && keep.length > 0 && (<>
                <div onPointerDown={e => startTrim(e, 'l')} className="absolute top-0 bottom-0 w-2.5 bg-terra rounded-l-xl cursor-ew-resize" style={{ left: `calc(${(keep[0].start / dur) * 100}% - 0px)` }} />
                <div onPointerDown={e => startTrim(e, 'r')} className="absolute top-0 bottom-0 w-2.5 bg-terra rounded-r-xl cursor-ew-resize" style={{ left: `calc(${(keep[keep.length - 1].end / dur) * 100}% - 10px)` }} />
              </>)}
              <div className="absolute top-0 bottom-0 w-0.5 bg-ink pointer-events-none" style={{ left: `${(cur / dur) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* side panel */}
        <div className="w-full sm:w-72 shrink-0 border-t sm:border-t-0 sm:border-l border-cream-dark flex flex-col" style={{ background: panelBg }}>
          <div className="flex gap-1 p-2 border-b border-cream-dark">
            <TabBtn id="trim" icon={Scissors} label="Cut" />
            <TabBtn id="text" icon={Type} label="Text" />
            <TabBtn id="adjust" icon={SlidersHorizontal} label="Adjust" />
            <TabBtn id="fx" icon={Wand2} label="Effects" />
            <TabBtn id="audio" icon={Volume2} label="Audio" />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'trim' && (
              <div className="space-y-3">
                <p className="text-sm text-ink-muted">Drag the orange handles to trim the ends. Move the playhead and split, then delete parts you don't want.</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={splitAt} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-cream-dark py-2.5 text-sm font-medium text-ink hover:border-terra transition-colors"><Scissors size={15} /> Split here</button>
                  <button onClick={deleteSeg} disabled={keep.length <= 1} className="flex items-center justify-center gap-1.5 rounded-xl border-2 border-cream-dark py-2.5 text-sm font-medium text-ink hover:border-terra transition-colors disabled:opacity-40"><Trash2 size={15} /> Delete part</button>
                </div>
                <div className="text-xs text-ink-muted pt-2 border-t border-cream-dark">{keep.length} segment{keep.length === 1 ? '' : 's'} kept · {fmtT(keptDur)}</div>
              </div>
            )}
            {tab === 'text' && (
              <div className="space-y-3">
                <button onClick={() => addText()} className="w-full flex items-center justify-center gap-1.5 bg-ink text-cream rounded-full py-2.5 text-sm hover:bg-terra transition-colors"><Plus size={15} /> Add text</button>
                <div className="grid grid-cols-2 gap-2">
                  {TEXT_PRESETS.map(p => <button key={p.label} onClick={() => addText(p.patch)} className="rounded-xl border-2 border-cream-dark py-2 text-xs font-medium text-ink hover:border-terra transition-colors">{p.label}</button>)}
                </div>
                {texts.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-cream-dark">
                    {texts.map(t => (
                      <button key={t.id} onClick={() => setSelText(t.id)} className={`w-full text-left px-3 py-2 rounded-xl text-sm truncate transition-colors ${selText === t.id ? 'bg-terra-light text-terra-dark' : 'text-ink hover:bg-card'}`}>{t.text || '(empty)'}</button>
                    ))}
                  </div>
                )}
                {sel && (
                  <div className="space-y-2 pt-2 border-t border-cream-dark">
                    <textarea value={sel.text} onChange={e => updateText({ text: e.target.value })} rows={2} className="w-full bg-cream border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra resize-none" />
                    <div className="flex items-center gap-2">
                      <label className="w-8 h-8 rounded-lg border-2 border-cream-dark overflow-hidden cursor-pointer shrink-0" style={{ background: sel.color }}><input type="color" value={sel.color} onChange={e => updateText({ color: e.target.value })} className="opacity-0 w-full h-full cursor-pointer" /></label>
                      <button onClick={() => updateText({ bg: !sel.bg })} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${sel.bg ? 'bg-terra text-cream' : 'text-ink-muted border border-cream-dark'}`}>Backing</button>
                      <button onClick={delText} className="ml-auto p-1.5 rounded-lg text-ink-muted hover:text-terra"><Trash2 size={15} /></button>
                    </div>
                    <Slider label="Size" value={sel.size} min={0.03} max={0.2} step={0.005} onChange={n => updateText({ size: n })} fmt={n => Math.round(n * 100) + ''} />
                    <Slider label="Across" value={sel.x} min={0} max={1} step={0.01} onChange={n => updateText({ x: n })} fmt={n => Math.round(n * 100) + '%'} />
                    <Slider label="Down" value={sel.y} min={0} max={1} step={0.01} onChange={n => updateText({ y: n })} fmt={n => Math.round(n * 100) + '%'} />
                    <Slider label="Show from" value={sel.start} min={0} max={dur} step={0.1} onChange={n => updateText({ start: Math.min(n, sel.end) })} fmt={fmtT} />
                    <Slider label="Show until" value={sel.end} min={0} max={dur} step={0.1} onChange={n => updateText({ end: Math.max(n, sel.start) })} fmt={fmtT} />
                  </div>
                )}
              </div>
            )}
            {tab === 'adjust' && (
              <div className="space-y-3">
                <Slider label="Brightness" value={adjust.bright} min={0} max={2} step={0.01} onChange={n => setAdjust(a => ({ ...a, bright: n }))} fmt={n => Math.round(n * 100) + '%'} />
                <Slider label="Contrast" value={adjust.contrast} min={0} max={2} step={0.01} onChange={n => setAdjust(a => ({ ...a, contrast: n }))} fmt={n => Math.round(n * 100) + '%'} />
                <Slider label="Saturation" value={adjust.sat} min={0} max={2} step={0.01} onChange={n => setAdjust(a => ({ ...a, sat: n }))} fmt={n => Math.round(n * 100) + '%'} />
                <Slider label="Blur" value={adjust.blur} min={0} max={20} step={1} onChange={n => setAdjust(a => ({ ...a, blur: n }))} fmt={n => n + 'px'} />
                <button onClick={() => setAdjust({ bright: 1, contrast: 1, sat: 1, blur: 0 })} className="w-full py-2 rounded-full border border-cream-dark text-ink-muted text-sm hover:border-terra transition-colors">Reset</button>
              </div>
            )}
            {tab === 'fx' && (
              <div className="grid grid-cols-2 gap-2">
                {VFX.map(f => <button key={f} onClick={() => setEffect(f)} className={`rounded-xl border-2 py-3 text-sm font-medium capitalize transition-colors ${effect === f ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink hover:border-terra'}`}>{f}</button>)}
              </div>
            )}
            {tab === 'audio' && (
              <div className="space-y-3">
                <Slider label="Volume" value={volume} min={0} max={1.5} step={0.01} onChange={setVolume} fmt={n => Math.round(n * 100) + '%'} />
                <button onClick={() => setMuted(m => !m)} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${muted ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink hover:border-terra'}`}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />} {muted ? 'Muted' : 'Mute'}</button>
                <p className="text-xs text-ink-muted leading-relaxed pt-2 border-t border-cream-dark">Volume and mute apply to the exported file too.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ FILES: type detection + helpers ============
type FileKind = 'text' | 'image' | 'audio' | 'video' | 'lull' | 'unknown';
const FILE_KINDS: Record<string, FileKind> = {
  txt: 'text', text: 'text', md: 'text', markdown: 'text', csv: 'text', tsv: 'text', json: 'text', log: 'text',
  xml: 'text', yml: 'text', yaml: 'text', ini: 'text', html: 'text', htm: 'text', css: 'text', js: 'text', ts: 'text', jsx: 'text', tsx: 'text', py: 'text', rtf: 'text',
  png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', bmp: 'image', svg: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', avi: 'video', m4v: 'video',
  lull: 'lull',
};
const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');
const baseName = (name: string) => (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name);
const fileKindOf = (name: string): FileKind => FILE_KINDS[extOf(name)] || 'unknown';

const KIND_META: Record<FileKind, { label: string; icon: any; blurb: string }> = {
  text: { label: 'Text', icon: FileText, blurb: 'Notes, markdown, code & data' },
  image: { label: 'Photo', icon: ImageIcon, blurb: 'Layers you can re-edit · export .lull' },
  audio: { label: 'Audio', icon: Music, blurb: 'Cut, mix & effects' },
  video: { label: 'Video', icon: Film, blurb: 'Trim, text & effects' },
  lull: { label: 'Lull design', icon: Sparkles, blurb: 'An editable Lull design file' },
  unknown: { label: 'File', icon: FileText, blurb: 'Unrecognised type' },
};

function mimeForExt(ext: string): string {
  const m: Record<string, string> = { txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown', html: 'text/html', htm: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', csv: 'text/csv', xml: 'application/xml', svg: 'image/svg+xml' };
  return m[ext] || 'text/plain';
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(text: string, filename: string, mime = 'text/plain') {
  downloadBlob(new Blob([text], { type: mime }), filename);
}
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n').trim();
}
// Tiny, safe markdown → HTML (headings, bold, italic, code, links, lists, code fences).
function mdToHtml(src: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t: string) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  let html = ''; let inList = false; let inCode = false;
  for (const raw of src.split(/\r?\n/)) {
    if (raw.trim().startsWith('```')) {
      if (inCode) { html += '</code></pre>'; inCode = false; }
      else { if (inList) { html += '</ul>'; inList = false; } html += '<pre><code>'; inCode = true; }
      continue;
    }
    if (inCode) { html += esc(raw) + '\n'; continue; }
    const h = raw.match(/^(#{1,6})\s+(.*)$/);
    if (h) { if (inList) { html += '</ul>'; inList = false; } const n = h[1].length; html += `<h${n}>${inline(h[2])}</h${n}>`; continue; }
    const li = raw.match(/^\s*[-*+]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (raw.trim() === '') continue;
    html += `<p>${inline(raw)}</p>`;
  }
  if (inList) html += '</ul>';
  if (inCode) html += '</code></pre>';
  return html;
}

type OpenDoc = { name: string; ext: string; content: string };
type Recent = { name: string; kind: FileKind; content?: string };

// The Files hub — recognises a file's type, opens the right editor, or converts formats.
function FilesPanel({ theme, onClose }: { theme: string; onClose: () => void }) {
  const [screen, setScreen] = useState<'home' | 'text' | 'photo' | 'audio' | 'video'>('home');
  const [photo, setPhoto] = useState<{ name: string; doc: LullDoc } | null>(null);
  const [audio, setAudio] = useState<{ name: string; src?: string } | null>(null);
  const [video, setVideo] = useState<{ name: string; src: string } | null>(null);
  const [pending, setPending] = useState<{ name: string; kind: FileKind; text?: string; dataUrl?: string } | null>(null);
  const [convertMode, setConvertMode] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // text editor state
  const [doc, setDoc] = useState<OpenDoc | null>(null);
  const [dirty, setDirty] = useState(false);
  const [fontSize, setFontSize] = useState(15);
  const [wrap, setWrap] = useState(true);
  const [showLines, setShowLines] = useState(false);
  const [mono, setMono] = useState(false);
  const [mdPreview, setMdPreview] = useState(false);
  const [showFind, setShowFind] = useState(false);
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutRef = useRef<HTMLDivElement>(null);

  const codeBg = theme === 'dark' ? '#17150F' : '#F3EBDD';

  const pushRecent = (r: Recent) => setRecent(list => [r, ...list.filter(x => x.name !== r.name)].slice(0, 8));

  const openText = (name: string, content: string) => {
    const ext = extOf(name) || 'txt';
    setDoc({ name, ext, content });
    setDirty(false); setMdPreview(false); setShowFind(false); setFind(''); setReplace('');
    setScreen('text');
    pushRecent({ name, kind: 'text', content });
  };

  const openPhoto = (name: string, ld: LullDoc) => {
    setPhoto({ name, doc: ld });
    setScreen('photo');
    pushRecent({ name, kind: 'lull', content: JSON.stringify(ld) });
  };

  const openAudio = (name: string, src?: string) => { setAudio({ name, src }); setScreen('audio'); };
  const openVideo = (name: string, src: string) => { setVideo({ name, src }); setScreen('video'); };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const kind = fileKindOf(f.name);
    if (kind === 'video') { setPending({ name: f.name, kind, dataUrl: URL.createObjectURL(f) }); e.target.value = ''; return; }
    const reader = new FileReader();
    if (kind === 'text' || kind === 'lull') {
      reader.onload = () => setPending({ name: f.name, kind, text: String(reader.result || '') });
      reader.readAsText(f);
    } else {
      reader.onload = () => setPending({ name: f.name, kind, dataUrl: String(reader.result || '') });
      reader.readAsDataURL(f);
    }
    e.target.value = '';
  };

  const editPending = () => {
    if (!pending) return;
    if (pending.kind === 'text') { openText(pending.name, pending.text || ''); setPending(null); setConvertMode(false); return; }
    if (pending.kind === 'lull') {
      try {
        const parsed = JSON.parse(pending.text || '');
        if (parsed && parsed.lull === 'image' && Array.isArray(parsed.elements)) { openPhoto(pending.name, parsed as LullDoc); setPending(null); setConvertMode(false); return; }
      } catch { /* not a valid .lull */ }
      return;
    }
    if (pending.kind === 'image' && pending.dataUrl) {
      const src = pending.dataUrl; const name = pending.name;
      const im = new Image();
      im.onload = () => { openPhoto(baseName(name) + '.lull', imageLullDoc(src, im.naturalWidth || 1080, im.naturalHeight || 1080)); };
      im.onerror = () => openPhoto(baseName(name) + '.lull', imageLullDoc(src, 1080, 1080));
      im.src = src;
      setPending(null); setConvertMode(false);
      return;
    }
    if (pending.kind === 'audio' && pending.dataUrl) { openAudio(pending.name, pending.dataUrl); setPending(null); setConvertMode(false); return; }
    if (pending.kind === 'video' && pending.dataUrl) { openVideo(pending.name, pending.dataUrl); setPending(null); setConvertMode(false); }
  };

  const convertText = (target: string) => {
    if (!pending) return;
    const src = pending.text || '';
    const from = extOf(pending.name);
    let out = src; let mime = mimeForExt(target);
    if (target === 'html') {
      out = `<!doctype html>\n<meta charset="utf-8">\n` + (from === 'md' || from === 'markdown' ? mdToHtml(src) : `<pre>${src.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`);
    } else {
      out = (from === 'html' || from === 'htm') ? htmlToText(src) : src;
    }
    downloadText(out, `${baseName(pending.name)}.${target}`, mime);
    setPending(null); setConvertMode(false);
  };

  const convertImage = (target: string) => {
    if (!pending?.dataUrl) return;
    const url = pending.dataUrl; const name = pending.name;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); if (!ctx) return;
      if (target === 'jpg' || target === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0);
      const mime = target === 'png' ? 'image/png' : target === 'webp' ? 'image/webp' : 'image/jpeg';
      c.toBlob(b => { if (b) downloadBlob(b, `${baseName(name)}.${target}`); }, mime, 0.92);
    };
    img.src = url;
    setPending(null); setConvertMode(false);
  };

  const saveDoc = () => { if (!doc) return; downloadText(doc.content, doc.name, mimeForExt(doc.ext)); setDirty(false); pushRecent({ name: doc.name, kind: 'text', content: doc.content }); };
  const exportAs = (ext: string) => {
    if (!doc) return;
    let out = doc.content;
    if (ext === 'html' && doc.ext === 'md') out = `<!doctype html>\n<meta charset="utf-8">\n` + mdToHtml(doc.content);
    downloadText(out, `${baseName(doc.name)}.${ext}`, mimeForExt(ext));
  };
  const replaceAll = () => { if (!doc || !find) return; setDoc({ ...doc, content: doc.content.split(find).join(replace) }); setDirty(true); };
  const backHome = () => { if (doc) pushRecent({ name: doc.name, kind: 'text', content: doc.content }); setScreen('home'); };

  const matches = doc && find ? doc.content.split(find).length - 1 : 0;
  const words = doc ? (doc.content.trim() ? doc.content.trim().split(/\s+/).length : 0) : 0;
  const chars = doc ? doc.content.length : 0;
  const lineCount = doc ? doc.content.split(/\n/).length : 1;
  const lh = Math.round(fontSize * 1.7);
  const isMd = doc ? (doc.ext === 'md' || doc.ext === 'markdown') : false;

  const Tbtn = ({ on, onClick, children, title }: { on?: boolean; onClick: () => void; children: any; title: string }) => (
    <button onClick={onClick} title={title} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${on ? 'bg-terra text-cream' : 'text-ink-muted hover:text-ink hover:bg-card'}`}>{children}</button>
  );

  if (screen === 'photo' && photo) {
    return (
      <PhotoEditor
        key={photo.name}
        name={photo.name}
        initial={photo.doc}
        theme={theme}
        onExit={(savedDoc) => { pushRecent({ name: photo.name, kind: 'lull', content: JSON.stringify(savedDoc) }); setPhoto(null); setScreen('home'); }}
        onClose={onClose}
      />
    );
  }
  if (screen === 'audio' && audio) {
    return <AudioEditor key={audio.name + (audio.src ? '1' : '0')} name={audio.name} srcDataUrl={audio.src} theme={theme} onClose={() => { setAudio(null); setScreen('home'); }} />;
  }
  if (screen === 'video' && video) {
    return <VideoEditor key={video.src} name={video.name} srcUrl={video.src} theme={theme} onClose={() => { setVideo(null); setScreen('home'); }} />;
  }

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* header */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 border-b border-cream-dark shrink-0">
        <FolderOpen size={18} className="text-terra shrink-0" strokeWidth={1.9} />
        <h2 className="font-display text-lg text-ink font-medium">Files</h2>
        {screen === 'text' && doc && (
          <span className="text-sm text-ink-muted ml-2 truncate max-w-[40vw]">· {doc.name}{dirty ? ' •' : ''}</span>
        )}
        <div className="flex-1" />
        {screen === 'home' ? (
          <>
            <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 bg-card border border-cream-dark rounded-full px-3 py-1.5 text-sm text-ink hover:border-terra transition-colors"><Plus size={15} strokeWidth={2} /> New</button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 bg-ink text-cream rounded-full px-3 py-1.5 text-sm hover:bg-terra transition-colors"><Upload size={15} strokeWidth={2} /> Open</button>
          </>
        ) : (
          <button onClick={backHome} className="flex items-center gap-1 text-sm text-terra"><ChevronLeft size={16} /> Files</button>
        )}
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5 ml-1" aria-label="Close files"><X size={20} /></button>
      </div>

      <input ref={fileRef} type="file" onChange={onPick} className="hidden" />

      {/* ===== HOME ===== */}
      {screen === 'home' && (
        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <button onClick={() => fileRef.current?.click()} className="bg-card border-2 border-cream-dark rounded-3xl p-6 text-left hover:border-terra transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-terra-light flex items-center justify-center mb-3 group-hover:scale-105 transition-transform"><Upload size={22} className="text-terra" strokeWidth={1.9} /></div>
                <div className="font-display text-xl text-ink font-medium">Open a file</div>
                <div className="text-sm text-ink-muted mt-1">Lull reads the type and opens the right editor — or converts it.</div>
              </button>
              <button onClick={() => setShowNew(true)} className="bg-card border-2 border-cream-dark rounded-3xl p-6 text-left hover:border-terra transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-terra-light flex items-center justify-center mb-3 group-hover:scale-105 transition-transform"><Plus size={22} className="text-terra" strokeWidth={1.9} /></div>
                <div className="font-display text-xl text-ink font-medium">New file</div>
                <div className="text-sm text-ink-muted mt-1">Start fresh — pick a type and export it any way you like.</div>
              </button>
            </div>

            <div className="text-xs uppercase tracking-wider text-ink-muted mb-3">Recent</div>
            {recent.length === 0 ? (
              <div className="bg-card border-2 border-dashed border-cream-dark rounded-2xl py-10 text-center">
                <FileText size={26} className="text-terra mx-auto mb-2" strokeWidth={1.4} />
                <p className="text-ink-muted text-sm">Files you open this session show up here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recent.map(r => {
                  const M = KIND_META[r.kind];
                  const canOpen = r.content !== undefined && (r.kind === 'text' || r.kind === 'lull');
                  const reopen = () => {
                    if (r.content === undefined) return;
                    if (r.kind === 'text') openText(r.name, r.content);
                    else if (r.kind === 'lull') { try { openPhoto(r.name, JSON.parse(r.content) as LullDoc); } catch { /* ignore */ } }
                  };
                  return (
                    <button key={r.name} disabled={!canOpen} onClick={reopen} className="w-full flex items-center gap-3 bg-card border border-cream-dark rounded-2xl px-4 py-3 text-left hover:border-terra transition-colors disabled:opacity-60 disabled:hover:border-cream-dark">
                      <M.icon size={18} className="text-terra shrink-0" strokeWidth={1.8} />
                      <div className="min-w-0">
                        <div className="text-ink font-medium text-sm truncate">{r.name}</div>
                        <div className="text-xs text-ink-muted">{M.label}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TEXT EDITOR ===== */}
      {screen === 'text' && doc && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-1 flex-wrap px-3 py-2 border-b border-cream-dark shrink-0">
            <Tbtn onClick={() => setShowFind(v => !v)} on={showFind} title="Find & replace"><Search size={14} strokeWidth={2} /></Tbtn>
            <div className="w-px h-5 bg-cream-dark mx-1" />
            <Tbtn onClick={() => setFontSize(s => Math.max(10, s - 1))} title="Smaller">A−</Tbtn>
            <span className="text-xs text-ink-muted w-7 text-center">{fontSize}</span>
            <Tbtn onClick={() => setFontSize(s => Math.min(30, s + 1))} title="Bigger">A+</Tbtn>
            <div className="w-px h-5 bg-cream-dark mx-1" />
            <Tbtn onClick={() => setWrap(v => !v)} on={wrap} title="Word wrap">Wrap</Tbtn>
            <Tbtn onClick={() => setShowLines(v => !v)} on={showLines} title="Line numbers"># Lines</Tbtn>
            <Tbtn onClick={() => setMono(v => !v)} on={mono} title="Monospace font">Mono</Tbtn>
            {isMd && <Tbtn onClick={() => setMdPreview(v => !v)} on={mdPreview} title="Markdown preview">Preview</Tbtn>}
          </div>

          {showFind && (
            <div className="flex items-center gap-2 flex-wrap px-3 py-2 border-b border-cream-dark shrink-0 bg-card">
              <input value={find} onChange={e => setFind(e.target.value)} placeholder="Find" className="bg-cream border border-cream-dark rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-terra w-40" />
              <input value={replace} onChange={e => setReplace(e.target.value)} placeholder="Replace with" className="bg-cream border border-cream-dark rounded-lg px-3 py-1.5 text-sm text-ink focus:outline-none focus:border-terra w-40" />
              <button onClick={replaceAll} className="bg-ink text-cream rounded-lg px-3 py-1.5 text-sm hover:bg-terra transition-colors">Replace all</button>
              <span className="text-xs text-ink-muted">{matches} match{matches === 1 ? '' : 'es'}</span>
            </div>
          )}

          <div className="flex-1 min-h-0 flex" style={{ background: mdPreview ? undefined : codeBg }}>
            {mdPreview ? (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="lull-md max-w-2xl mx-auto text-ink leading-relaxed" dangerouslySetInnerHTML={{ __html: mdToHtml(doc.content) }} />
              </div>
            ) : (
              <>
                {showLines && (
                  <div ref={gutRef} className="overflow-hidden text-right py-4 pl-3 pr-2 select-none shrink-0" style={{ fontSize, lineHeight: `${lh}px`, fontFamily: 'ui-monospace, monospace', color: 'var(--ink-muted, #9a8f7d)', background: 'rgba(0,0,0,0.04)' }}>
                    {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                )}
                <textarea
                  ref={taRef}
                  value={doc.content}
                  onChange={e => { setDoc({ ...doc, content: e.target.value }); setDirty(true); }}
                  onScroll={() => { if (gutRef.current && taRef.current) gutRef.current.scrollTop = taRef.current.scrollTop; }}
                  spellCheck={false}
                  className="flex-1 min-w-0 resize-none bg-transparent outline-none text-ink p-4"
                  style={{ fontSize, lineHeight: `${lh}px`, fontFamily: mono ? 'ui-monospace, monospace' : 'inherit', whiteSpace: wrap ? 'pre-wrap' : 'pre', tabSize: 2, overflowX: wrap ? 'hidden' : 'auto' }}
                />
              </>
            )}
          </div>

          {/* status bar */}
          <div className="flex items-center gap-3 flex-wrap px-4 py-2 border-t border-cream-dark shrink-0 text-xs text-ink-muted">
            <span>{words} words</span><span>·</span><span>{chars} chars</span><span>·</span><span>{lineCount} lines</span>
            <div className="flex-1" />
            <span className="text-ink-muted">Export:</span>
            {['txt', 'md', 'html'].map(x => (
              <button key={x} onClick={() => exportAs(x)} className="px-2 py-1 rounded-lg border border-cream-dark text-ink hover:border-terra hover:text-terra transition-colors">.{x}</button>
            ))}
            <button onClick={saveDoc} className="flex items-center gap-1.5 bg-ink text-cream rounded-full px-3 py-1.5 hover:bg-terra transition-colors"><Save size={13} strokeWidth={2} /> Save</button>
          </div>
        </div>
      )}

      {/* ===== OPEN: edit or convert ===== */}
      {pending && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-ink/50 backdrop-blur-sm" onClick={() => { setPending(null); setConvertMode(false); }}>
          <div className="bg-cream rounded-3xl w-full max-w-md p-7 border-2 border-terra animate-slide-down" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-terra-light flex items-center justify-center">{(() => { const I = KIND_META[pending.kind].icon; return <I size={22} className="text-terra" strokeWidth={1.9} />; })()}</div>
              <div className="min-w-0">
                <div className="font-display text-xl text-ink font-medium truncate">{pending.name}</div>
                <div className="text-xs text-ink-muted">{KIND_META[pending.kind].label} · {KIND_META[pending.kind].blurb}</div>
              </div>
            </div>

            {!convertMode ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={editPending}
                    disabled={pending.kind === 'unknown'}
                    className="flex flex-col items-start gap-1 rounded-2xl border-2 border-cream-dark p-4 text-left hover:border-terra transition-colors disabled:opacity-50 disabled:hover:border-cream-dark"
                  >
                    <Pencil size={18} className="text-terra" strokeWidth={1.9} />
                    <span className="font-medium text-ink">Edit</span>
                    <span className="text-xs text-ink-muted">{pending.kind === 'text' ? 'Open in the editor' : pending.kind === 'image' ? 'Open in the photo editor' : pending.kind === 'lull' ? 'Open your layers' : pending.kind === 'audio' ? 'Open in the audio editor' : pending.kind === 'video' ? 'Open in the video editor' : 'Editor coming soon'}</span>
                  </button>
                  <button
                    onClick={() => setConvertMode(true)}
                    disabled={pending.kind !== 'text' && pending.kind !== 'image'}
                    className="flex flex-col items-start gap-1 rounded-2xl border-2 border-cream-dark p-4 text-left hover:border-terra transition-colors disabled:opacity-50 disabled:hover:border-cream-dark"
                  >
                    <FileText size={18} className="text-terra" strokeWidth={1.9} />
                    <span className="font-medium text-ink">Convert</span>
                    <span className="text-xs text-ink-muted">{pending.kind === 'text' || pending.kind === 'image' ? 'Change the format' : 'Coming soon'}</span>
                  </button>
                </div>
                <button onClick={() => { setPending(null); setConvertMode(false); }} className="w-full mt-4 py-3 rounded-full border border-cream-dark text-ink hover:bg-card transition-colors font-medium">Cancel</button>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-muted mb-3">Convert to which format?</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(pending.kind === 'image' ? ['png', 'jpg', 'webp'] : ['txt', 'md', 'html']).map(t => (
                    <button key={t} onClick={() => (pending.kind === 'image' ? convertImage(t) : convertText(t))} className="px-4 py-2 rounded-full border-2 border-cream-dark text-ink font-medium hover:border-terra hover:text-terra transition-colors">.{t}</button>
                  ))}
                </div>
                <button onClick={() => setConvertMode(false)} className="w-full py-3 rounded-full border border-cream-dark text-ink hover:bg-card transition-colors font-medium">Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== NEW FILE ===== */}
      {showNew && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-ink/50 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="bg-cream rounded-3xl w-full max-w-md p-7 border-2 border-terra animate-slide-down" onClick={e => e.stopPropagation()}>
            <h3 className="font-display text-2xl text-ink font-medium mb-1">New file</h3>
            <p className="text-sm text-ink-muted mb-5">Pick a type to start.</p>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-ink-muted mb-1">Text</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {['txt', 'md', 'html'].map(x => (
                  <button key={x} onClick={() => { setShowNew(false); openText(`untitled.${x}`, ''); setDirty(true); }} className="rounded-2xl border-2 border-cream-dark py-3 text-ink font-medium hover:border-terra hover:text-terra transition-colors">.{x}</button>
                ))}
              </div>
              <div className="text-xs uppercase tracking-wider text-ink-muted mb-1">Photo · editable, exports .lull</div>
              <div className="grid grid-cols-2 gap-2">
                {([['Square', 1080, 1080], ['Portrait', 1080, 1350], ['Story', 1080, 1920], ['Landscape', 1920, 1080]] as const).map(([l, w, h]) => (
                  <button key={l} onClick={() => { setShowNew(false); openPhoto('untitled.lull', blankLullDoc(w, h)); }} className="rounded-2xl border-2 border-cream-dark py-3 text-ink font-medium hover:border-terra hover:text-terra transition-colors flex items-center justify-center gap-1.5">
                    <ImageIcon size={15} strokeWidth={1.8} /> {l}
                  </button>
                ))}
              </div>
              <div className="text-xs uppercase tracking-wider text-ink-muted mb-1 mt-3">Audio</div>
              <button onClick={() => { setShowNew(false); openAudio('untitled.wav'); }} className="w-full rounded-2xl border-2 border-cream-dark py-3 text-ink font-medium hover:border-terra hover:text-terra transition-colors flex items-center justify-center gap-1.5">
                <Music size={15} strokeWidth={1.8} /> New audio project
              </button>
            </div>
            <button onClick={() => setShowNew(false)} className="w-full mt-5 py-3 rounded-full border border-cream-dark text-ink hover:bg-card transition-colors font-medium">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Shown when a Pro-only area is opened without Pro.
function ProLocked({ what, onClose }: { what: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-cream flex flex-col items-center justify-center text-center p-8 animate-fade-in" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <button onClick={onClose} className="absolute top-5 right-5 text-ink-muted hover:text-ink p-1.5" aria-label="Close"><X size={22} /></button>
      <div className="w-20 h-20 rounded-full bg-terra-light flex items-center justify-center mb-5"><Lock size={34} className="text-terra" /></div>
      <h2 className="font-display text-3xl text-ink mb-2">{what} is <span className="text-terra italic">Pro</span></h2>
      <p className="text-ink-muted max-w-xs mb-8">Redeem a Pro key to unlock it. When someone sends you one, it shows up the next time you open Lull.</p>
      <button onClick={onClose} className="px-6 py-3 rounded-full border border-cream-dark text-ink hover:border-terra hover:text-terra transition-colors font-medium">Back</button>
    </div>
  );
}

// ============================================================
// ADMIN — staff-only: send Pro keys, ban users, grant roles.
// ============================================================
function AdminPanel({ isAdminUser, liveEvent, by, onClose }: { isAdminUser: boolean; liveEvent: any; by: string; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<CloudProfile[]>([]);
  const [sel, setSel] = useState<CloudProfile | null>(null);
  const [msg, setMsg] = useState('');
  const [reason, setReason] = useState('');
  const [dur, setDur] = useState('perm');
  const [rushX, setRushX] = useState(2);
  const [rushMin, setRushMin] = useState(15);
  const [announce, setAnnounce] = useState(liveEvent?.announce || '');
  const rushOn = liveEvent && (liveEvent.rushMultiplier || 1) > 1 && (liveEvent.rushEndsAt || 0) > Date.now();
  const rushMins = rushOn ? Math.max(1, Math.ceil((liveEvent.rushEndsAt - Date.now()) / 60000)) : 0;

  const search = async () => { try { setResults(await social.searchUsers(term, '')); } catch { setResults([]); } };
  const refreshSel = async () => { if (sel) { try { const p = await social.getProfile(sel.uid); if (p) setSel(p); } catch { /* ignore */ } } };
  const act = async (fn: () => Promise<void>, note: string) => { try { await fn(); setMsg(note); refreshSel(); } catch (e: any) { setMsg(e?.message || 'Action failed — check your permissions/rules.'); } };
  const banActive = (u: CloudProfile) => !!u.banned && (u.banUntil === 0 || (u.banUntil || 0) > Date.now());
  const doBan = () => { if (!sel) return; const until = dur === 'perm' ? 0 : Date.now() + (dur === '1d' ? 1 : dur === '7d' ? 7 : 30) * 86400000; act(() => social.adminBan(sel.uid, reason.trim() || 'Violation', until), `Banned @${sel.username}`); };

  return (
    <div className="fixed inset-0 z-40 bg-cream animate-fade-in flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-cream-dark shrink-0">
        <div className="flex items-center gap-2"><Shield size={18} className="text-terra" strokeWidth={1.9} /><h2 className="font-display text-xl text-ink font-medium">Admin</h2></div>
        <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close admin"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 max-w-lg w-full mx-auto space-y-3">
        {/* Global events */}
        <div className="bg-card border border-cream-dark rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2"><Sparkles size={15} className="text-terra" strokeWidth={2} /><span className="font-medium text-ink">Reminder Rush</span></div>
          {rushOn ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink flex-1">{liveEvent.rushMultiplier}× active · ends in {rushMins}m</span>
              <button onClick={() => act(() => social.adminStopRush(), 'Rush stopped.')} className="text-sm text-ink-muted border border-cream-dark rounded-xl px-3 py-1.5 hover:border-terra transition-colors">Stop</button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <select value={rushX} onChange={e => setRushX(parseInt(e.target.value))} className="bg-cream border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra">
                  <option value={2}>2× XP</option><option value={3}>3× XP</option><option value={5}>5× XP</option>
                </select>
                <select value={rushMin} onChange={e => setRushMin(parseInt(e.target.value))} className="bg-cream border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra">
                  <option value={5}>5 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>60 min</option>
                </select>
              </div>
              <button onClick={() => act(() => social.adminStartRush(rushX, rushMin, by), `${rushX}× rush started for ${rushMin}m`)} className="w-full bg-terra text-cream rounded-xl py-2.5 text-sm font-medium hover:bg-terra-dark transition-colors">Start rush</button>
            </div>
          )}
          <div className="pt-3 border-t border-cream-dark">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1.5">Announcement (shown to everyone)</div>
            <input value={announce} onChange={e => setAnnounce(e.target.value)} placeholder="e.g. New update out now!" className="w-full bg-cream border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => act(() => social.adminSetAnnounce(announce.trim(), by), 'Announcement set.')} className="flex-1 bg-ink text-cream rounded-xl py-2 text-sm hover:bg-terra transition-colors">Set</button>
              <button onClick={() => { setAnnounce(''); act(() => social.adminSetAnnounce('', by), 'Announcement cleared.'); }} className="text-sm text-ink-muted border border-cream-dark rounded-xl px-3 hover:border-terra transition-colors">Clear</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <input value={term} onChange={e => setTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="Search a user by @username or name" className="flex-1 bg-card border border-cream-dark rounded-2xl px-4 py-3 text-ink focus:outline-none focus:border-terra" />
          <button onClick={search} className="px-4 rounded-2xl bg-ink text-cream shrink-0" aria-label="Search"><Search size={16} /></button>
        </div>
        {!sel && results.map(u => (
          <button key={u.uid} onClick={() => { setSel(u); setMsg(''); setReason(''); }} className="w-full flex items-center gap-3 bg-card border border-cream-dark rounded-2xl p-3 text-left hover:border-terra transition-colors">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-ink truncate">{u.displayName} {u.pro && <span className="text-[10px] text-terra font-semibold">PRO</span>} {banActive(u) && <span className="text-[10px] text-terra-dark font-semibold">BANNED</span>}</div>
              <div className="text-xs text-ink-muted">@{u.username} · {u.role || 'user'}</div>
            </div>
          </button>
        ))}
        {!sel && !results.length && term && <p className="text-sm text-ink-muted">No users found — type a username and press Enter.</p>}
        {sel && (
          <div className="bg-card border border-cream-dark rounded-2xl p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div><div className="font-display text-lg text-ink">{sel.displayName}</div><div className="text-xs text-ink-muted">@{sel.username} · role: {sel.role || 'user'}{sel.pro ? ' · PRO' : ''}{banActive(sel) ? ' · BANNED' : ''}</div></div>
              <button onClick={() => setSel(null)} className="text-xs text-ink-muted hover:text-terra">Back</button>
            </div>

            <div className="flex gap-2">
              <button onClick={() => act(() => social.adminSendProKey(sel.uid), `Pro key sent to @${sel.username}`)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-cream bg-terra rounded-xl py-2.5 hover:bg-terra-dark transition-colors"><Gift size={14} /> Send Pro key</button>
              {sel.pro && <button onClick={() => act(() => social.adminRevokePro(sel.uid), `Revoked Pro from @${sel.username}`)} className="text-sm text-ink-muted border border-cream-dark rounded-xl px-3 hover:border-terra transition-colors">Revoke</button>}
            </div>

            {banActive(sel) ? (
              <button onClick={() => act(() => social.adminUnban(sel.uid), `Unbanned @${sel.username}`)} className="w-full text-sm font-medium text-ink border border-cream-dark rounded-xl py-2.5 hover:border-terra transition-colors">Unban</button>
            ) : (
              <div className="space-y-2">
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Ban reason" className="w-full bg-cream border border-cream-dark rounded-xl px-3 py-2 text-sm text-ink focus:outline-none focus:border-terra" />
                <div className="grid grid-cols-4 gap-1">
                  {[['1d', '1 day'], ['7d', '7 days'], ['30d', '30 days'], ['perm', 'Forever']].map(([v, l]) => (
                    <button key={v} onClick={() => setDur(v)} className={`py-2 rounded-lg text-xs border ${dur === v ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}>{l}</button>
                  ))}
                </div>
                <button onClick={doBan} className="w-full flex items-center justify-center gap-1.5 text-sm font-medium text-cream bg-ink rounded-xl py-2.5 hover:bg-terra transition-colors"><Ban size={14} /> Ban user</button>
              </div>
            )}

            {isAdminUser && (
              <div>
                <div className="text-[11px] uppercase tracking-wider text-ink-muted mb-1.5">Permissions</div>
                <div className="grid grid-cols-3 gap-2">
                  {[['user', 'User'], ['mod', 'Mod'], ['admin', 'Admin']].map(([v, l]) => (
                    <button key={v} onClick={() => act(() => social.adminSetRole(sel.uid, v), `@${sel.username} is now ${v}`)} className={`py-2 rounded-xl text-sm border-2 transition-colors ${(sel.role || 'user') === v ? 'border-terra text-terra bg-terra-light' : 'border-cream-dark text-ink-muted hover:border-terra'}`}>{l}</button>
                  ))}
                </div>
              </div>
            )}
            {msg && <p className="text-sm text-terra-dark">{msg}</p>}
          </div>
        )}
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
    let healed = false;
    const offS = social.watchSpaces(me.uid, setSpaces);
    const offF = social.watchFriends(me.uid, list => {
      setFriends(list);
      // guarantee two-way: make sure each friend also has me (once per session)
      if (!healed && list.length) { healed = true; social.ensureMutual(me, list).catch(() => {}); }
    });
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
  const [showCode, setShowCode] = useState(false);
  const [showLogbook, setShowLogbook] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [code, setCode] = useState<CodeData>(DEFAULT_CODE_DATA());
  const [notes, setNotes] = useState<Note[]>([]);
  const [cloudUid, setCloudUid] = useState<string | null>(null);
  const [sharedReminders, setSharedReminders] = useState<any[]>([]);
  const [openSpace, setOpenSpace] = useState<{ id: string; withName: string } | null>(null);
  const [cloudPro, setCloudPro] = useState(false);
  const [pendingPro, setPendingPro] = useState(false);
  const [dismissRedeem, setDismissRedeem] = useState(false);
  const [cloudProfile, setCloudProfile] = useState<any>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [liveEvent, setLiveEvent] = useState<any>(null);   // global rush / announcement
  const [settingsCat, setSettingsCat] = useState('account'); // active settings category
  const anyPanelOpen = showSettings || showStats || showNotepad || showFriends || !!openSpace;
  const closeAllPanels = () => { setShowSettings(false); setShowStats(false); setShowNotepad(false); setShowFriends(false); setShowCode(false); setShowLogbook(false); setShowFiles(false); setShowAdmin(false); setOpenSpace(null); };

  // shared reminders (from friends) mapped into the same shape as local ones
  const sharedAsReminders = sharedReminders.map((s: any) => ({
    id: s.id, title: s.title, description: s.description, triggerAt: s.triggerAt,
    repeat: s.repeat, dismissed: false, shared: true, sharedId: s.id, withName: s.withName,
  }));

  // admin / moderation status (from my cloud account)
  const myRole: string = cloudProfile?.role || 'user';
  const isAdminUser = (cloudProfile?.username || '').trim().toLowerCase() === 'duckworks' || myRole === 'admin';
  const isStaff = isAdminUser || myRole === 'mod';
  const banActive = !!cloudProfile?.banned && (cloudProfile.banUntil === 0 || (cloudProfile.banUntil || 0) > Date.now());

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
  const [color, setColor] = useState('');            // optional colour label for a reminder
  const [reminderSearch, setReminderSearch] = useState('');
  const [undoReminder, setUndoReminder] = useState<any>(null); // last deleted, for undo

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
    try {
      const greet = (u.settings?.displayName || u.username || 'there');
      const rawC = localStorage.getItem(`lull-code-${u.username.toLowerCase()}`);
      const parsed = rawC ? JSON.parse(rawC) : null;
      setCode(parsed && parsed.projects?.length ? parsed : DEFAULT_CODE_DATA(greet));
    } catch { setCode(DEFAULT_CODE_DATA()); }
    setLoaded(true);
  };

  // tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // global admin events (rush / announcement) — visible to everyone
  useEffect(() => {
    if (isAlertWindow) return;
    const off = social.watchGlobal(g => setLiveEvent(g));
    return () => off();
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

  // persist coding-sandbox projects to localStorage
  useEffect(() => {
    if (!loaded || isAlertWindow || !user) return;
    try { localStorage.setItem(`lull-code-${user.username.toLowerCase()}`, JSON.stringify(code)); } catch { /* quota */ }
  }, [code, loaded]);

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

  // live Pro / pending-key / role / ban status from my cloud account
  useEffect(() => {
    if (isAlertWindow || !cloudUid) { setCloudPro(false); setPendingPro(false); setCloudProfile(null); return; }
    const off = social.watchMyDoc(cloudUid, p => {
      // admins (root handle or admin role) always have Pro — no redeem needed
      const admin = (p?.username || '').trim().toLowerCase() === 'duckworks' || p?.role === 'admin';
      setCloudPro(!!p?.pro || admin); setPendingPro(!!p?.pendingPro); setCloudProfile(p);
    });
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
    // 2x-XP "Reminder Rush" if an admin has one running
    const rushMult = (liveEvent && (liveEvent.rushMultiplier || 1) > 1 && (liveEvent.rushEndsAt || 0) > nowTs) ? liveEvent.rushMultiplier : 1;

    setGame(g => {
      const { next, unlocked } = applyCompletion(g, onTime, nowTs, rushMult);
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
    const off = ipc.on('alert-action', (action: 'dismiss' | 'snooze', reminderId: number, mins?: number) => {
      if (action === 'dismiss') {
        const done = remindersRef.current.find(r => r.id === reminderId);
        if (done) recordCompletion(done);
        setReminders(rs => rs.map(r => r.id === reminderId
          ? (isRecurring(r) ? { ...r, triggerAt: nextReminderTrigger(r.triggerAt, r.repeat, Date.now()) } : { ...r, dismissed: true })
          : r));
      } else if (action === 'snooze') {
        const newTrigger = Date.now() + (mins && mins > 0 ? mins : 5) * 60 * 1000;
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
    setTitle(''); setDescription(''); setImageUrl(''); setDate(''); setTime(''); setRepeat('none'); setColor('');
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
      color: color || '',
    };
    setReminders(rs => [...rs, newR].sort((a, b) => a.triggerAt - b.triggerAt));
    setShowForm(false);
    resetForm();
  };

  // pin, duplicate, and undo-able delete
  const togglePin = (id: number | string) => setReminders(rs => rs.map(r => (r.id === id ? { ...r, pinned: !r.pinned } : r)));
  const duplicateReminder = (r: any) => {
    const copy = { ...r, id: Date.now() + Math.random(), dismissed: false, pinned: false };
    delete copy.shared; delete copy.sharedId; delete copy.withName; // a shared reminder becomes a personal copy
    setReminders(rs => [...rs, copy].sort((a, b) => a.triggerAt - b.triggerAt));
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

  const snooze = (mins: number = 5) => {
    if (isAlertWindow) {
      ipc?.send('alert-action', 'snooze', alertData.id, mins);
    } else if (activeAlert) {
      const newTrigger = Date.now() + mins * 60 * 1000;
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
    if (r) { recordMiss(r); setUndoReminder(r); setTimeout(() => setUndoReminder((cur: any) => (cur && cur.id === r.id ? null : cur)), 6000); }
    setReminders(rs => rs.filter(x => x.id !== id));
  };
  const undoDelete = () => { if (undoReminder) { const r = undoReminder; setUndoReminder(null); setReminders(rs => [...rs, r].sort((a, b) => a.triggerAt - b.triggerAt)); } };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setReminders([]);
    setTasks([]);
    setSettings(DEFAULT_SETTINGS);
    setGame(DEFAULT_GAME);
    setNotes([]);
    setCode(DEFAULT_CODE_DATA());
    setLoaded(false);
    setShowSettings(false);
    setShowStats(false);
    setShowNotepad(false);
    setShowFriends(false);
    setShowCode(false);
    setShowLogbook(false);
    setShowAdmin(false);
    setShowSidebar(false);
    setCloudPro(false); setPendingPro(false); setDismissRedeem(false); setCloudProfile(null);
    social.cloudSignOut().catch(() => {});
  };

  // ============ BACKUP: export / import ============
  const backupInputRef = useRef<HTMLInputElement>(null);
  const exportBackup = () => {
    const payload = {
      lullBackup: 1,
      exportedAt: Date.now(),
      user: user?.username || '',
      reminders,
      tasks,
      settings,
      game,
      notes,
    };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `lull-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setToast('Backup exported');
    } catch {
      setToast('Could not export backup');
    }
  };
  const importBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!data || !data.lullBackup) { setToast('Not a Lull backup file'); return; }
        if (Array.isArray(data.reminders)) setReminders(data.reminders);
        if (Array.isArray(data.tasks)) setTasks(data.tasks);
        if (data.settings) setSettings(s => ({ ...DEFAULT_SETTINGS, ...s, ...data.settings }));
        if (data.game) setGame(g => ({ ...g, ...data.game }));
        if (Array.isArray(data.notes)) setNotes(data.notes);
        setToast('Backup restored');
      } catch {
        setToast('Could not read that file');
      }
    };
    reader.readAsText(file);
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
  const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: !settings.clock24h, timeZone: activeTz });
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

  const upcoming = [...reminders.filter(r => !r.dismissed), ...sharedAsReminders]
    .filter(r => {
      const q = reminderSearch.trim().toLowerCase();
      if (!q) return true;
      return (r.title || '').toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // pinned reminders float to the top, then by soonest trigger
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return a.triggerAt - b.triggerAt;
    });
  const activeReminderCount = reminders.filter(r => !r.dismissed).length + sharedAsReminders.length;
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
              <div style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={15} strokeWidth={2} className="text-ink-muted"/>
                  <span className="text-xs uppercase tracking-[0.18em] text-ink-muted font-medium">Snooze</span>
                </div>
                <div className="flex gap-2 mb-3">
                  {[5, 15, 60].map(m => (
                    <button key={m} onClick={() => snooze(m)} className="flex-1 py-3 px-3 rounded-full border-2 border-cream-dark text-ink hover:border-terra hover:text-terra transition-all font-medium text-sm">
                      {m < 60 ? `${m} min` : '1 hour'}
                    </button>
                  ))}
                </div>
                <button onClick={dismiss} className="w-full py-4 px-5 rounded-full bg-ink text-cream hover:bg-terra transition-colors font-medium">
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

        {undoReminder && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-cream rounded-full pl-5 pr-2 py-2 shadow-xl flex items-center gap-3 animate-slide-down"
               style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
            <Trash2 size={15} className="text-cream/70" strokeWidth={2}/>
            <span className="text-sm font-medium max-w-[45vw] truncate">Deleted "{undoReminder.title}"</span>
            <button onClick={undoDelete} className="bg-cream text-ink rounded-full px-4 py-1.5 text-sm font-medium hover:bg-terra hover:text-cream transition-colors">
              Undo
            </button>
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
                  { key: 'home',    label: 'Home',        icon: Home,      locked: false, onClick: () => { closeAllPanels(); setShowSidebar(false); } },
                  { key: 'stats',   label: 'Stats & achievements', icon: Trophy, locked: false, onClick: () => { closeAllPanels(); setShowStats(true); setShowSidebar(false); } },
                  { key: 'notepad', label: 'Notepad',     icon: Pencil,    locked: false, onClick: () => { closeAllPanels(); setShowNotepad(true); setShowSidebar(false); } },
                  { key: 'files',   label: 'Files',       icon: FolderOpen, locked: !cloudPro, onClick: () => { closeAllPanels(); setShowFiles(true); setShowSidebar(false); } },
                  { key: 'code',    label: 'Code',        icon: Code2,     locked: !cloudPro, onClick: () => { closeAllPanels(); setShowCode(true); setShowSidebar(false); } },
                  { key: 'logbook', label: 'Logbook',     icon: BookOpen,  locked: !cloudPro, onClick: () => { closeAllPanels(); setShowLogbook(true); setShowSidebar(false); } },
                  { key: 'friends', label: 'Friends',     icon: Users,     locked: false, onClick: () => { closeAllPanels(); setShowFriends(true); setShowSidebar(false); } },
                  { key: 'settings',label: 'Settings',    icon: Settings,  locked: false, onClick: () => { closeAllPanels(); setShowSettings(true); setShowSidebar(false); } },
                  ...(isStaff ? [{ key: 'admin', label: 'Admin', icon: Shield, locked: false, onClick: () => { closeAllPanels(); setShowAdmin(true); setShowSidebar(false); } }] : []),
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={item.onClick}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-ink hover:bg-card border border-transparent hover:border-cream-dark transition-colors text-left"
                  >
                    <item.icon size={19} strokeWidth={1.9} className="text-terra"/>
                    <span className="font-medium">{item.label}</span>
                    {item.locked && <Lock size={13} className="ml-auto text-ink-muted" />}
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

        {/* ============ FILES (Pro) ============ */}
        {showFiles && (cloudPro
          ? <FilesPanel theme={settings.theme} onClose={() => setShowFiles(false)} />
          : <ProLocked what="The file editors" onClose={() => setShowFiles(false)} />
        )}

        {/* ============ CODE SANDBOX (Pro) ============ */}
        {showCode && (cloudPro
          ? <CodePanel data={code} setData={setCode} theme={settings.theme} greet={settings.displayName || user.username} cfg={{ font: settings.codeFont, size: settings.codeFontSize, theme: settings.codeTheme, tab: settings.codeTabSize, wrap: settings.codeWrap, live: settings.codeLivePreview, lineNumbers: settings.codeLineNumbers }} onLogbook={() => setShowLogbook(true)} onClose={() => setShowCode(false)} />
          : <ProLocked what="The coding sandbox" onClose={() => setShowCode(false)} />
        )}

        {/* ============ LOGBOOK (Pro) ============ */}
        {showLogbook && (cloudPro
          ? <LogbookPanel theme={settings.theme} onClose={() => setShowLogbook(false)} />
          : <ProLocked what="The logbook" onClose={() => setShowLogbook(false)} />
        )}

        {/* ============ REDEEM PRO POPUP ============ */}
        {pendingPro && !cloudPro && !dismissRedeem && cloudUid && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-ink/50 backdrop-blur-sm">
            <div className="relative bg-cream rounded-3xl w-full max-w-md p-10 text-center border-2 border-terra shadow-2xl animate-slide-down">
              <button onClick={() => setDismissRedeem(true)} className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1" aria-label="Close"><X size={22} /></button>
              <div className="w-20 h-20 rounded-full bg-terra-light flex items-center justify-center mx-auto mb-5"><Gift size={40} className="text-terra" strokeWidth={1.6} /></div>
              <h2 className="font-display text-3xl text-ink mb-2">A gift for you!</h2>
              <p className="text-ink-muted mb-8">You've been given <span className="text-terra font-medium">Lull Pro</span>. Redeem it to unlock Pro features.</p>
              <button onClick={() => { social.redeemPro(cloudUid).catch(() => {}); setToast('Lull Pro unlocked! 🎉'); }} className="w-full py-4 rounded-full bg-terra text-cream text-lg font-medium hover:bg-terra-dark transition-colors">Redeem</button>
            </div>
          </div>
        )}

        {/* ============ FRIENDS (cloud account) ============ */}
        {showFriends && (
          <FriendsPanel localUsername={user.username} settings={settings} game={game} reminders={reminders} onOpenSpace={(id, withName) => { setShowFriends(false); setOpenSpace({ id, withName }); }} onClose={() => setShowFriends(false)} />
        )}

        {/* ============ ADMIN (staff only) ============ */}
        {showAdmin && isStaff && (
          <AdminPanel isAdminUser={isAdminUser} liveEvent={liveEvent} by={settings.displayName || user.username} onClose={() => setShowAdmin(false)} />
        )}

        {/* ============ BAN OVERLAY (blocks the cloud account) ============ */}
        {banActive && cloudProfile && (
          <div className="fixed inset-0 z-[80] bg-ink/80 backdrop-blur-sm flex items-center justify-center p-8 text-center">
            <div className="bg-cream rounded-3xl max-w-md w-full p-8 border-2 border-terra shadow-2xl">
              <AlertTriangle size={40} className="text-terra mx-auto mb-4" strokeWidth={1.7} />
              <h2 className="font-display text-2xl text-ink mb-2">Your account is banned</h2>
              <p className="text-ink-muted mb-1">Reason: {cloudProfile.banReason || 'Violation of the rules.'}</p>
              <p className="text-ink-muted mb-6">{cloudProfile.banUntil === 0 ? 'This ban is permanent.' : `Until ${new Date(cloudProfile.banUntil).toLocaleString()}`}</p>
              <button onClick={() => social.cloudSignOut().catch(() => {})} className="px-6 py-3 rounded-full bg-terra text-cream font-medium hover:bg-terra-dark transition-colors">Sign out of cloud account</button>
            </div>
          </div>
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

          {/* a calm thought for the day */}
          <div className="mb-8 -mt-6 flex items-start gap-2.5 animate-fade-up" style={{ animationDelay: '0.05s' }}>
            <Feather size={16} className="text-terra mt-0.5 shrink-0" strokeWidth={1.8}/>
            <p className="font-display text-lg sm:text-xl italic text-ink-muted leading-snug">{dailyQuote(now)}</p>
          </div>

          {/* global admin events */}
          {liveEvent && (liveEvent.rushMultiplier || 1) > 1 && (liveEvent.rushEndsAt || 0) > now && (
            <div className="mb-5 flex items-center gap-3 bg-terra text-cream rounded-2xl px-5 py-3 animate-fade-up shadow-lg">
              <Sparkles size={18} strokeWidth={2} />
              <span className="font-medium flex-1">{liveEvent.rushMultiplier}× XP Rush — complete reminders now!</span>
              <span className="text-sm opacity-90">ends in {Math.max(1, Math.ceil((liveEvent.rushEndsAt - now) / 60000))}m</span>
            </div>
          )}
          {liveEvent && liveEvent.announce && (
            <div className="mb-5 flex items-start gap-3 bg-card border border-cream-dark rounded-2xl px-5 py-3 animate-fade-up">
              <Shield size={16} className="text-terra mt-0.5 shrink-0" strokeWidth={2} />
              <span className="text-sm text-ink flex-1">{liveEvent.announce}</span>
            </div>
          )}

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

          {activeReminderCount >= 3 && (
            <div className="relative mb-6 animate-fade-up" style={{ animationDelay: '0.25s' }}>
              <Search size={17} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none"/>
              <input
                type="text"
                value={reminderSearch}
                onChange={e => setReminderSearch(e.target.value)}
                placeholder="Search reminders…"
                className="w-full bg-card border-2 border-cream-dark focus:border-terra rounded-full pl-11 pr-10 py-3 text-ink placeholder:text-ink-muted outline-none transition-colors"
              />
              {reminderSearch && (
                <button onClick={() => setReminderSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted hover:text-terra transition-colors" aria-label="Clear search">
                  <X size={16} strokeWidth={2}/>
                </button>
              )}
            </div>
          )}

          {upcoming.length === 0 ? (
            <div className="bg-card border-2 border-dashed border-cream-dark rounded-3xl py-20 px-6 text-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
              <Bell size={32} className="text-terra mx-auto mb-4" strokeWidth={1.4}/>
              <p className="font-display text-2xl italic text-ink-muted">{reminderSearch.trim() ? 'No matches' : 'Nothing on your mind yet'}</p>
              <p className="text-sm text-ink-muted mt-2">{reminderSearch.trim() ? 'Try a different search' : 'Tap "new reminder" to add one'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcoming.map((r, i) => (
                <article
                  key={r.id}
                  className="bg-card rounded-3xl p-6 border border-cream-dark hover:shadow-xl transition-all duration-500 animate-fade-up flex flex-col"
                  style={{ animationDelay: `${0.3 + Math.min(i, 6) * 0.05}s`, boxShadow: '0 4px 20px -8px rgba(31, 36, 33, 0.1)' }}
                >
                  {r.color && (
                    <div className="h-1.5 rounded-full mb-4 -mt-1" style={{ background: r.color }}/>
                  )}
                  {!isNative && r.imageUrl && (
                    <div className="rounded-2xl overflow-hidden mb-5 aspect-[4/3] bg-cream-dark">
                      <img src={r.imageUrl} alt="" className="w-full h-full object-cover"/>
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="font-display text-2xl text-ink leading-tight mb-2 font-medium flex items-start gap-1.5">
                      {r.pinned && <Pin size={15} strokeWidth={2} className="text-terra mt-1.5 shrink-0 fill-terra"/>}
                      <span>{r.title}</span>
                    </h3>
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
                        {!r.shared && (
                          <button
                            onClick={() => togglePin(r.id)}
                            className={`transition-colors p-1 ${r.pinned ? 'text-terra' : 'text-ink-muted hover:text-terra'}`}
                            aria-label={r.pinned ? 'Unpin' : 'Pin to top'}
                            title={r.pinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin size={14} strokeWidth={1.8} className={r.pinned ? 'fill-terra' : ''}/>
                          </button>
                        )}
                        {!r.shared && (
                          <button
                            onClick={() => duplicateReminder(r)}
                            className="text-ink-muted hover:text-terra transition-colors p-1"
                            aria-label="Duplicate reminder"
                            title="Duplicate"
                          >
                            <Copy size={14} strokeWidth={1.8}/>
                          </button>
                        )}
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

                <div>
                  <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Color label</label>
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setColor('')}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${color === '' ? 'border-terra' : 'border-cream-dark hover:border-ink-muted'}`}
                      title="No color"
                      aria-label="No color"
                    >
                      <Ban size={14} strokeWidth={2} className="text-ink-muted"/>
                    </button>
                    {['#C8553D', '#E8A33D', '#5C8A5A', '#3D7EA6', '#7B5EA7', '#C86B98'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-ink scale-110' : 'hover:scale-110'}`}
                        style={{ background: c }}
                        aria-label={`Color ${c}`}
                      />
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

                {/* streak freezes */}
                <div className="bg-card rounded-2xl border border-cream-dark p-5 mb-4 flex items-center gap-4">
                  <div className="relative shrink-0">
                    <Snowflake size={26} className="text-[#3D7EA6]" strokeWidth={1.8}/>
                    <span className="absolute -top-2 -right-2 bg-[#3D7EA6] text-cream text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{game.freezes || 0}</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-lg font-medium leading-tight">Streak freezes</div>
                    <p className="text-xs text-ink-muted mt-0.5">
                      {(game.freezes || 0) > 0
                        ? `Miss a day and a freeze keeps your streak alive. You have ${game.freezes} in the bank.`
                        : 'Earn one every 7-day streak (up to 3). They save your streak if you miss a single day.'}
                    </p>
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

                  {settingsCat === 'coding' && (<>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Editor font</label>
                      <Segmented value={settings.codeFont} onChange={v => setSettings(s => ({ ...s, codeFont: v }))} options={[{ value: 'mono', label: 'Mono' }, { value: 'menlo', label: 'Menlo' }, { value: 'courier', label: 'Courier' }, { value: 'system', label: 'System' }]} />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Font size</label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setSettings(s => ({ ...s, codeFontSize: Math.max(10, s.codeFontSize - 1) }))} className="w-9 h-9 rounded-xl border border-cream-dark text-ink hover:border-terra transition-colors">−</button>
                        <span className="font-display text-lg w-10 text-center">{settings.codeFontSize}</span>
                        <button onClick={() => setSettings(s => ({ ...s, codeFontSize: Math.min(22, s.codeFontSize + 1) }))} className="w-9 h-9 rounded-xl border border-cream-dark text-ink hover:border-terra transition-colors">+</button>
                        <span className="text-sm text-ink-muted ml-1" style={{ fontFamily: (CODE_FONTS[settings.codeFont] || CODE_FONTS.mono).stack, fontSize: settings.codeFontSize }}>Aa 123</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Editor theme</label>
                      <Segmented value={settings.codeTheme} onChange={v => setSettings(s => ({ ...s, codeTheme: v }))} options={[{ value: 'match', label: 'Match' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'contrast', label: 'Contrast' }]} />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Tab size</label>
                      <Segmented value={String(settings.codeTabSize)} onChange={v => setSettings(s => ({ ...s, codeTabSize: parseInt(v) || 2 }))} options={[{ value: '2', label: '2 spaces' }, { value: '4', label: '4 spaces' }]} />
                    </div>
                    <div className="flex"><ToggleRow label="Word wrap" value={settings.codeWrap} onChange={v => setSettings(s => ({ ...s, codeWrap: v }))} /></div>
                    <div className="flex"><ToggleRow label="Line numbers" value={settings.codeLineNumbers} onChange={v => setSettings(s => ({ ...s, codeLineNumbers: v }))} /></div>
                    <div className="flex"><ToggleRow label="Live preview (auto-refresh)" value={settings.codeLivePreview} onChange={v => setSettings(s => ({ ...s, codeLivePreview: v }))} /></div>
                    <p className="text-xs text-ink-muted -mt-1">With live preview off, a Run button appears in the Code panel to refresh the page.</p>
                  </>)}

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

                      <div>
                        <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Clock format</label>
                        <Segmented
                          value={settings.clock24h ? '24' : '12'}
                          onChange={v => setSettings(s => ({ ...s, clock24h: v === '24' }))}
                          options={[{ value: '24', label: '24-hour' }, { value: '12', label: '12-hour' }]}
                        />
                        <p className="text-xs text-ink-muted mt-2">Times show as {settings.clock24h ? '17:30' : '5:30 PM'}.</p>
                      </div>

                      <div className="pt-2 border-t border-cream-dark">
                        <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Backup</label>
                        <p className="text-xs text-ink-muted mb-3">Save your reminders, tasks, notes and progress to a file — or restore them on another device.</p>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={exportBackup} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-cream-dark text-ink font-medium hover:border-terra hover:text-terra transition-colors"><Download size={16} strokeWidth={2}/> Export</button>
                          <button onClick={() => backupInputRef.current?.click()} className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-cream-dark text-ink font-medium hover:border-terra hover:text-terra transition-colors"><Upload size={16} strokeWidth={2}/> Import</button>
                        </div>
                        <input ref={backupInputRef} type="file" accept="application/json,.json" onChange={e => { const f = e.target.files?.[0]; if (f) importBackup(f); e.target.value = ''; }} className="hidden"/>
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
                    { key: 'coding', label: 'Coding', icon: Code2, show: true },
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
