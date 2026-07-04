import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Image as ImageIcon, Trash2, AlarmClock, Bell, Clock, Settings, LogOut, User, Moon, Sun, Volume2, VolumeX, Eye, EyeOff, Zap, Play, Square, MousePointerClick, Keyboard, Type, Move, Globe, Pencil, ChevronLeft, AlertTriangle } from 'lucide-react';
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
};

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
    syncReminderNotifications(reminders);
  }, [reminders]);

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
      <div className={`${themeClass} min-h-screen font-body text-ink relative`} style={{ background: `linear-gradient(180deg, var(--page-top) 0%, var(--page-bottom) 100%)` }}>
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(200,85,61,0.12), transparent 70%)' }}/>

        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14 relative">
          <header className="flex items-start justify-between mb-12 sm:mb-16 animate-fade-up">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">
                {settings.displayName ? `Hello, ${settings.displayName}` : 'A reminder app'}
              </p>
              <h1 className="font-display text-5xl sm:text-7xl font-light text-ink leading-none">
                Lull<span className="text-terra italic font-normal">.</span>
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-card/70 backdrop-blur rounded-full px-5 py-3 border border-cream-dark flex items-center gap-3 shadow-sm">
                <Clock size={16} className="text-terra" strokeWidth={1.8}/>
                <div className="text-right">
                  <div className="font-display text-lg leading-none font-medium">{ukNow}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted mt-0.5">UK time</div>
                </div>
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="bg-card/70 backdrop-blur rounded-full w-12 h-12 border border-cream-dark flex items-center justify-center shadow-sm text-ink-muted hover:text-terra hover:border-terra transition-colors"
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

          <div className="flex flex-wrap items-center gap-3 mb-12 sm:mb-16 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <button
              onClick={openForm}
              className="bg-ink text-cream rounded-full px-7 py-4 inline-flex items-center gap-3 font-medium hover:bg-terra transition-colors duration-300 group shadow-lg"
            >
              <span className="bg-cream text-ink rounded-full w-7 h-7 flex items-center justify-center transition-colors">
                <Plus size={16} strokeWidth={2.5}/>
              </span>
              New reminder
            </button>
            <button
              onClick={openNewTask}
              className="bg-card text-ink rounded-full px-7 py-4 inline-flex items-center gap-3 font-medium border-2 border-cream-dark hover:border-terra hover:text-terra transition-colors duration-300 group shadow-sm"
            >
              <span className="bg-terra text-cream rounded-full w-7 h-7 flex items-center justify-center transition-colors">
                <Zap size={15} strokeWidth={2.5}/>
              </span>
              New task
            </button>
          </div>

          {upcoming.length === 0 ? (
            <div className="bg-card/50 border-2 border-dashed border-cream-dark rounded-3xl py-20 px-6 text-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
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
                  {r.imageUrl && (
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

          {tasks.length > 0 && (
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
                        <button onClick={() => editTask(t)} className="p-2.5 rounded-full border border-cream-dark text-ink-muted hover:text-terra hover:border-terra transition-colors" aria-label="Edit task">
                          <Pencil size={14} strokeWidth={1.9}/>
                        </button>
                        <button onClick={() => deleteTask(t.id)} className="p-2.5 rounded-full border border-cream-dark text-ink-muted hover:text-terra hover:border-terra transition-colors" aria-label="Delete task">
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark" style={{ boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)' }}>
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

                <div className="grid grid-cols-2 gap-4">
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
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in" style={{ background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark" style={{ boxShadow: '0 30px 80px -20px rgba(31, 36, 33, 0.4)' }}>
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

                {/* Panic stop */}
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

  const overlay = 'fixed inset-0 z-40 flex items-center justify-center p-4 animate-fade-in';
  const overlayStyle = { background: 'rgba(31, 36, 33, 0.5)', backdropFilter: 'blur(8px)' } as any;
  const panel = 'bg-cream rounded-3xl max-w-lg w-full p-8 sm:p-10 max-h-[92vh] overflow-y-auto animate-slide-down border border-cream-dark';
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
                <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
