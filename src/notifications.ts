// Reminder scheduling for native (iOS/Android) builds via Capacitor.
//
// IMPORTANT: `isNative` is true ONLY inside a real Capacitor app (iOS/Android).
// On Windows / Electron it is false, so every function below returns early and
// the existing Electron floating-alert + IPC path is completely unaffected.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = Capacitor.isNativePlatform();

export interface NotifyOptions {
  sound?: string;        // preset filename bundled in the app, e.g. 'chime.wav'
  vibrate?: boolean;     // false => schedule silently (iOS ties vibration to the alert sound)
  strongAlert?: boolean; // fire a few extra notifications ~1s apart for a longer buzz
}

// iOS caps pending notifications at 64; stay comfortably under it.
const MAX_PENDING = 60;

// Ask for notification permission (first launch on device). No-op on desktop.
export async function requestReminderPermission(): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    /* user can grant later in iOS Settings */
  }
}

// Next occurrence strictly after `now` for a repeating reminder — mirrors the
// recurrence rule used by the desktop scheduler in App.tsx.
function nextTrigger(ts: number, repeat: string, now: number): number {
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

// Notification content shared by every entry for a reminder. When vibration is
// off we omit the sound entirely so iOS shows a quiet banner (no buzz).
function contentBase(r: any, opts: NotifyOptions): any {
  const base: any = { title: r.title || 'Reminder', body: r.description || 'Reminder' };
  if (opts.vibrate !== false) base.sound = opts.sound || 'default';
  return base;
}

// Build the schedule entries (without ids — ids are assigned in the sync step,
// since we cancel-all and reschedule every time, so they only need to be unique
// within a batch).
function buildForReminder(r: any, now: number, opts: NotifyOptions): any[] {
  const base = contentBase(r, opts);
  const repeat = r.repeat && r.repeat !== 'none' ? r.repeat : 'none';

  let entries: any[] = [];
  if (repeat === 'none') {
    if (r.triggerAt <= now) return [];
    entries = [{ ...base, schedule: { at: new Date(r.triggerAt), allowWhileIdle: true } }];
  } else if (repeat === 'daily' || repeat === 'weekly') {
    const at = new Date(nextTrigger(r.triggerAt, repeat, now));
    const every = repeat === 'daily' ? 'day' : 'week';
    entries = [{ ...base, schedule: { at, every, allowWhileIdle: true } }];
  } else {
    // 'weekdays' — schedule several upcoming occurrences (fewer when strong-alert
    // triples the count) and refresh them whenever the app opens.
    const count = opts.strongAlert ? 5 : 14;
    let t = r.triggerAt;
    for (let i = 0; i < count; i++) {
      t = nextTrigger(t, 'weekdays', i === 0 ? now : t - 1);
      entries.push({ ...base, schedule: { at: new Date(t), allowWhileIdle: true } });
    }
  }

  if (!opts.strongAlert) return entries;

  // Strong alert: clone each entry into 3 that fire ~1.2s apart for a longer buzz.
  const expanded: any[] = [];
  for (const e of entries) {
    for (let k = 0; k < 3; k++) {
      const at = new Date(e.schedule.at.getTime() + k * 1200);
      expanded.push({ ...e, schedule: { ...e.schedule, at } });
    }
  }
  return expanded;
}

// Cancel whatever we previously scheduled and re-schedule from current state.
// Call this whenever the reminder list OR notification settings change. No-op on desktop.
export async function syncReminderNotifications(reminders: any[], opts: NotifyOptions = {}): Promise<void> {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    }
    const now = Date.now();
    const built: any[] = [];
    for (const r of reminders) {
      if (r.dismissed) continue;
      for (const entry of buildForReminder(r, now, opts)) built.push(entry);
    }
    // assign unique ids and cap to iOS's pending limit
    const notifications = built.slice(0, MAX_PENDING).map((e, i) => ({ ...e, id: i + 1 }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {
    /* scheduling is best-effort */
  }
}
