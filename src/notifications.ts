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
//
// Recurring reminders use `schedule.on` (calendar components) so iOS builds a
// repeating UNCalendarNotificationTrigger and fires them forever on its own,
// even while the app is closed. (Passing `at` + `every` does NOT repeat — when
// `at` is present the plugin ignores `every` and fires exactly once.)
function buildForReminder(r: any, now: number, opts: NotifyOptions): any[] {
  const base = contentBase(r, opts);
  const repeat = r.repeat && r.repeat !== 'none' ? r.repeat : 'none';

  // Time-of-day the reminder should fire at (from its original trigger time).
  const src = new Date(r.triggerAt);
  const hour = src.getHours();
  const minute = src.getMinutes();

  let entries: any[] = [];
  if (repeat === 'none') {
    if (r.triggerAt <= now) return [];
    entries = [{ ...base, schedule: { at: new Date(r.triggerAt), allowWhileIdle: true } }];
  } else if (repeat === 'daily') {
    // Repeats every day at hour:minute.
    entries = [{ ...base, schedule: { on: { hour, minute }, allowWhileIdle: true, repeats: true } }];
  } else if (repeat === 'weekly') {
    // Repeats weekly on the reminder's own weekday (1 = Sunday … 7 = Saturday).
    const weekday = src.getDay() + 1;
    entries = [{ ...base, schedule: { on: { weekday, hour, minute }, allowWhileIdle: true, repeats: true } }];
  } else if (repeat === 'weekdays' || repeat === 'weekends') {
    // One repeating entry per matching weekday (Mon–Fri = 2..6, Sat/Sun = 7,1).
    const days = repeat === 'weekdays' ? [2, 3, 4, 5, 6] : [1, 7];
    entries = days.map(weekday => ({
      ...base, schedule: { on: { weekday, hour, minute }, allowWhileIdle: true, repeats: true },
    }));
  }

  if (!opts.strongAlert) return entries;

  // Strong alert: for one-shot (`at`) reminders, clone into 3 that fire ~1.2s
  // apart for a longer buzz. Calendar-repeat entries fire on a minute boundary,
  // so they can't be sub-minute cloned — they're left as a single strong banner.
  const expanded: any[] = [];
  for (const e of entries) {
    if (e.schedule.at instanceof Date) {
      for (let k = 0; k < 3; k++) {
        const at = new Date(e.schedule.at.getTime() + k * 1200);
        expanded.push({ ...e, schedule: { ...e.schedule, at } });
      }
    } else {
      expanded.push(e);
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
