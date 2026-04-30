import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Image as ImageIcon, Trash2, AlarmClock, Bell, Clock } from 'lucide-react';

// detect if this window is the alert popup
const urlParams = new URLSearchParams(window.location.search);
const isAlertWindow = urlParams.get('alert') === '1';
const alertData = isAlertWindow
  ? JSON.parse(decodeURIComponent(urlParams.get('data') || '{}'))
  : null;

// access electron's ipc bridge if available
const ipc: any = (window as any).lull;

export default function App() {
  // ============ STATE ============
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

  // tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

// listen for actions sent back from the alert window
  useEffect(() => {
    if (isAlertWindow) return;
    if (!ipc) return;
    const off = ipc.on('alert-action', (action: 'dismiss' | 'snooze', reminderId: number) => {
      if (action === 'dismiss') {
        setReminders(rs => rs.map(r => r.id === reminderId ? { ...r, dismissed: true } : r));
      } else if (action === 'snooze') {
        const newTrigger = Date.now() + 5 * 60 * 1000;
        setReminders(rs => rs.map(r => r.id === reminderId ? { ...r, triggerAt: newTrigger, dismissed: false } : r));
      }
      setActiveAlert(null);
    });
    return () => { off?.(); };
  }, []);

  // save reminders whenever they change (but not before initial load)
  useEffect(() => {
    if (!loaded || isAlertWindow) return;
    localStorage.setItem('lull-reminders', JSON.stringify(reminders));
  }, [reminders, loaded]);

  // ask for notification permission once
  useEffect(() => {
    if (isAlertWindow) return;
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // fire reminders when due (main window only)
  useEffect(() => {
    if (isAlertWindow) return;
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
        setReminders(rs => rs.map(r => r.id === reminderId ? { ...r, dismissed: true } : r));
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
        silent: false,
      });
    }
  };

  // ============ ACTIONS ============
  const resetForm = () => {
    setTitle(''); setDescription(''); setImageUrl(''); setDate(''); setTime('');
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
      setReminders(rs => rs.map(r => r.id === activeAlert.id ? { ...r, dismissed: true } : r));
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

  // ============ RENDER ============
  return (
    <>
      <style>{`
        :root {
          --cream: #F5EFE6;
          --cream-dark: #E5D9C5;
          --ink: #1F2421;
          --ink-muted: #6B6862;
          --terra: #C8553D;
          --terra-dark: #A03E2D;
          --terra-light: #F5DDD2;
        }
        .bg-cream { background-color: var(--cream); }
        .bg-cream-dark { background-color: var(--cream-dark); }
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
      `}</style>

      {/* ============ ALERT WINDOW MODE ============ */}
      {isAlertWindow && alertData && (
        <div className="font-body min-h-screen p-4 flex items-start justify-center" style={{ background: 'transparent' }}>
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

      {/* ============ MAIN WINDOW MODE ============ */}
      {!isAlertWindow && (
        <div className="min-h-screen font-body text-ink relative" style={{ background: 'linear-gradient(180deg, #F5EFE6 0%, #ECDFCC 100%)' }}>
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(200,85,61,0.12), transparent 70%)' }}/>

          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10 sm:py-14 relative">
            <header className="flex items-start justify-between mb-12 sm:mb-16 animate-fade-up">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-ink-muted mb-2">A reminder app</p>
                <h1 className="font-display text-5xl sm:text-7xl font-light text-ink leading-none">
                  Lull<span className="text-terra italic font-normal">.</span>
                </h1>
              </div>
              <div className="bg-white/70 backdrop-blur rounded-full px-5 py-3 border border-cream-dark flex items-center gap-3 shadow-sm">
                <Clock size={16} className="text-terra" strokeWidth={1.8}/>
                <div className="text-right">
                  <div className="font-display text-lg leading-none font-medium">{ukNow}</div>
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted mt-0.5">UK time</div>
                </div>
              </div>
            </header>

            <div className="mb-8 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <h2 className="font-display text-2xl sm:text-3xl text-ink-muted italic font-light">
                What do you want to remember?
              </h2>
            </div>

            <button
              onClick={openForm}
              className="bg-ink text-cream rounded-full px-7 py-4 inline-flex items-center gap-3 font-medium hover:bg-terra transition-colors duration-300 mb-12 sm:mb-16 group animate-fade-up shadow-lg"
              style={{ animationDelay: '0.2s' }}
            >
              <span className="bg-cream text-ink rounded-full w-7 h-7 flex items-center justify-center transition-colors">
                <Plus size={16} strokeWidth={2.5}/>
              </span>
              New reminder
            </button>

            {upcoming.length === 0 ? (
              <div className="bg-white/50 border-2 border-dashed border-cream-dark rounded-3xl py-20 px-6 text-center animate-fade-up" style={{ animationDelay: '0.3s' }}>
                <Bell size={32} className="text-terra mx-auto mb-4" strokeWidth={1.4}/>
                <p className="font-display text-2xl italic text-ink-muted">Nothing on your mind yet</p>
                <p className="text-sm text-ink-muted mt-2">Tap "new reminder" to add one</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcoming.map((r, i) => (
                  <article
                    key={r.id}
                    className="bg-white rounded-3xl p-6 border border-cream-dark hover:shadow-xl transition-all duration-500 animate-fade-up flex flex-col"
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

            <p className="text-center text-xs text-ink-muted mt-16 animate-fade-up" style={{ animationDelay: '0.5s' }}>
              Reminders persist across restarts and float above any window.
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
                      className="w-full bg-white border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors font-display text-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Optional details..."
                      rows={3}
                      className="w-full bg-white border border-cream-dark rounded-2xl px-5 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full bg-white border border-cream-dark rounded-2xl px-4 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider text-ink-muted block mb-2">Time</label>
                      <input
                        type="time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        className="w-full bg-white border border-cream-dark rounded-2xl px-4 py-3.5 text-ink focus:outline-none focus:border-terra transition-colors"
                      />
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
                          className="w-full bg-white border-2 border-dashed border-cream-dark rounded-2xl py-8 hover:border-terra transition-all group"
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
                    className="flex-1 py-3.5 px-6 rounded-full border border-cream-dark text-ink hover:bg-white transition-colors font-medium"
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
        </div>
      )}
    </>
  );
}
