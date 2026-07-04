// Reminder scheduling for native (iOS/Android) builds via Capacitor.
//
// IMPORTANT: `isNative` is true ONLY inside a real Capacitor app (iOS/Android).
// On Windows / Electron it is false, so every function below returns early and
// the existing Electron floating-alert + IPC path is completely unaffected.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const isNative = Capacitor.isNativePlatform();

// Ask for notification permission (first launch on device). No-op on desktop.
export async function requestReminderPermission(): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.requestPermissions();
  } catch {
    /* user can grant later in iOS Settings */
  }
}

// Stable positive 31-bit integer id derived from a reminder's id (iOS/Android
// notification ids must be numbers). `offset` gives recurring reminders that
// need several scheduled entries their own distinct ids.
function notifId(reminderId: string | number, offset = 0): number {
  const str = String(reminderId);
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000000000) + offset;
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

// Turn one reminder into one or more LocalNotifications schedule entries.
function buildForReminder(r: any, now: number): any[] {
  const base = { title: r.title || 'Reminder', body: r.description || 'Reminder' };
  const repeat = r.repeat && r.repeat !== 'none' ? r.repeat : 'none';

  if (repeat === 'none') {
    if (r.triggerAt <= now) return [];
    return [{ ...base, id: notifId(r.id), schedule: { at: new Date(r.triggerAt), allowWhileIdle: true } }];
  }

  if (repeat === 'daily' || repeat === 'weekly') {
    const at = new Date(nextTrigger(r.triggerAt, repeat, now));
    const every = repeat === 'daily' ? 'day' : 'week';
    return [{ ...base, id: notifId(r.id), schedule: { at, every, allowWhileIdle: true } }];
  }

  // 'weekdays' has no single native repeat rule, so schedule the next 14
  // weekday occurrences as individual entries; they get refreshed whenever the
  // app opens and this sync runs again.
  const out: any[] = [];
  let t = r.triggerAt;
  for (let i = 0; i < 14; i++) {
    t = nextTrigger(t, 'weekdays', i === 0 ? now : t - 1);
    out.push({ ...base, id: notifId(r.id, i + 1), schedule: { at: new Date(t), allowWhileIdle: true } });
  }
  return out;
}

// Cancel whatever we previously scheduled and re-schedule from current state.
// Call this whenever the reminder list changes. No-op on desktop.
export async function syncReminderNotifications(reminders: any[]): Promise<void> {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    }
    const now = Date.now();
    const notifications: any[] = [];
    for (const r of reminders) {
      if (r.dismissed) continue;
      for (const entry of buildForReminder(r, now)) notifications.push(entry);
    }
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {
    /* scheduling is best-effort */
  }
}
