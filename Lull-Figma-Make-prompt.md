# Figma Make prompt — "Lull"

Build a high-fidelity, warm, calming productivity app called **Lull** — a reminders + notes app with light gamification and friends. It should feel like a quiet, cozy, well-crafted personal space: think warm parchment, soft clay-orange accents, elegant serif display type, generous rounded corners, and gentle motion. Not corporate, not neon — calm, tactile, and human. Design both a **desktop layout** and a **mobile (iPhone) layout** for every screen.

---

## Brand & logo

- **Name / wordmark:** "Lull" set in a light-weight serif, always followed by a **terra-colored italic period** — `Lull.` — where the dot is the one pop of color. Use it large and airy on the home header (e.g. 56–72px).
- **App icon / logo mark:** a single lowercase-feeling capital **"L"** in cream, centered on a solid warm-colored rounded-square tile. The classic version is a cream "L" on a terra (clay-orange) tile. Keep the L simple, confident, and geometric with slightly rounded terminals. Provide seasonal/holiday variants of this icon that keep the identical L on top and add small decorative motifs around it (e.g. a snow scene for winter, a tiny wreath/tree for Christmas, hearts for Valentine's, leaves for autumn), never covering the L.
- **Feel:** boutique, editorial, hand-made-but-refined. Rounded, soft, warm. Lots of breathing room.

---

## Design system (design tokens)

**Typography**
- Display / headings / numbers / the wordmark: **Fraunces** (serif, use optical sizing; use its *italic* for accents like taglines and the period). Weights 300–600.
- Body / UI text / labels: **Geist** (clean grotesque sans). Weights 400–600.
- Small labels are often UPPERCASE with wide letter-spacing (tracking ~0.2em), muted color.

**Color — Light theme (default)**
- Page / panels (cream): `#F5EFE6`
- Card surface: `#FFFFFF`
- Borders / dividers (cream-dark): `#E5D9C5`
- Text (ink): `#1F2421`
- Muted text: `#6B6862`
- Primary accent (terra / clay-orange): `#C8553D`
- Accent dark (hover/press): `#A03E2D`
- Accent tint (soft fill, chips): `#F5DDD2`

**Color — Dark theme**
- Page / panels: `#20241F`
- Card: `#2A2E28`
- Borders: `#333831`
- Text: `#F1EBDF`, muted `#A29D93`
- Accent: `#E0715A`, tint `#3B2A24`
- App background: `#1B1E1A`

**Shape & depth**
- Corners: very rounded — pills (fully round) for buttons/badges, `rounded-2xl`/`rounded-3xl` (16–28px) for cards, inputs, and panels.
- Borders: 1–2px in the cream-dark border color; selected/active elements get a 2px terra border.
- Shadows: soft, low, warm — e.g. `0 4px 20px -8px rgba(31,36,33,0.1)` on cards; deeper `0 30px 80px -20px rgba(31,36,33,0.4)` on modals/windows.
- Buttons: dark "ink" pill with cream text and a small circular icon badge for primary actions; terra pill for confirmations; outlined cream-dark pills for secondary.

**Motion**
- Gentle: fade-up on load (staggered for lists), slide-down for modals/sheets, slide-in from the right for the sidebar, a subtle "pop" micro-animation on interaction. Nothing snappy or aggressive.

**Optional decorative layers** (user-toggleable)
- Background gradients (named: default, dawn = warm peach, dusk = lavender, plus seasonal).
- Subtle repeating **patterns** overlaid on the background: dots, grid, diagonal lines, cross. Patterns never appear inside cards/inputs.
- Seasonal "decorations": faint floating line-art motifs (sun, leaves, snowflakes, hearts) drifting in the page background.
- **Zen mode:** strips it back to a minimal, calm, low-contrast layout.

**Avatar system** — profile pictures are one of: uploaded photo (circle-cropped), a colored **letter monogram** (first initial on a solid accent circle), or a **preset gradient** circle with the initial. Preset gradients: terra `#C8553D→#E4A05B`, forest `#6B8F71→#A9C3A0`, dusk `#8C6BA9→#C9A0EA`, ocean `#3D7EA6→#7FBFD8`, rose `#C85B7C→#E9A0BC`, gold `#D98E48→#EAD7B7`, mint `#4FA890→#9FE0CF`, ink dark.

---

## App structure & screens

### 1. Auth (login / signup)
Centered card on a warm cream gradient. Big `Lull.` wordmark, a soft tagline in serif italic ("Welcome back" / "Create your account"). Fields: username, password (with a show/hide eye toggle). One terra primary button; a text link to switch between log in and sign up. Note underneath: "Your account and reminders are stored privately on this device."

### 2. Home (main screen)
- **Header:** left — an uppercase muted greeting ("Good morning, [name]") above the giant `Lull.` wordmark. Right — a compact **stats pill** (a flame icon + streak number, divider, "Lv N" and total XP), a **clock pill** (clock icon, current time, timezone label), and an **avatar+name pill** that opens the sidebar.
- **Prompt line:** large serif italic "What do you want to remember?"
- **Daily progress bar:** "3 of 5 done today" with a terra fill bar; celebrates at 100%.
- **Actions row:** a dark "New reminder" pill (with a + badge) and, on desktop only, a "New task" pill (automations).
- **Reminder cards** in a responsive grid (1 col mobile, up to 3 desktop). Each card: title (serif), optional description, a "When" block (time + date), a countdown chip ("in 2h 15m"), a repeat badge if recurring (Once/Daily/Weekdays/Weekends/Weekly), a small **"Shared · [name]"** badge if it's shared with a friend, plus a "Done" (sparkle) action and a delete icon.
- Empty state: dashed card, bell icon, "Nothing on your mind yet."
- A floating music toggle button (ambient relaxing music) bottom-right.

### 3. Right sidebar (navigation)
Slides in from the right over a dimmed page. Top: avatar + display name + streak/level line. Nav rows (icon + label): Home, Stats & achievements, Notepad, Friends, Settings. Footer: Log out. When any panel/window is open, a small **Home** pill appears top-left to return.

### 4. Settings (opens as a windowed panel, not full-screen on desktop; full-screen sheet on mobile)
Window with a title bar ("Settings") and an **X** to close. A **category rail** — on desktop a vertical list on the right, on mobile a horizontal scrolling strip on top — with: **Account, Customization, App icon, Sound, Automations, Goals, General.**
- **Account:** identity card, display name, **profile picture editor** (Letter / Preset / Photo with color + preset swatches and photo upload), a "show my profile picture to friends" toggle (off by default).
- **Customization:** a **live Preview card** (a mini mock of the home screen showing the chosen theme + background + pattern), Light/Dark theme, background swatches, pattern picker (None/Dots/Grid/Lines/Cross), toggles for Seasonal theme, Zen mode, Micro-animations, Ambient music.
- **App icon:** grid of selectable app icons incl. seasonal/holiday ones (locked until unlocked), with an "auto seasonal icon by date" toggle.
- **Sound:** master sound toggle; on mobile also a notification-sound picker (preview ▶ buttons), vibrate, and "strong alert."
- **Automations (desktop):** a global "stop all tasks" keybind + a "Stop all tasks now" button.
- **Goals:** set a personal reward goal (X reminders done, or an N-day streak) + a reward text.
- **General:** timezone dropdown + "set timezone automatically" toggle.

### 5. Reminders
Create/edit form (as a modal / sheet): title, description, date, time, an image (desktop), and a **Repeat** selector (Once / Daily / Weekdays / Weekends / Weekly). When a reminder fires: a warm alert card with title, time, and Dismiss / Snooze.

### 6. Gamification
- **Daily progress bar** (on home).
- **Stats panel** (opens from the stats pill): level + XP with a progress bar, big number tiles (Streak / Done / completion-rate), a small **7-day bar chart**, best streak + missed count, and an **Achievements** grid (unlocked = terra tint, locked = faded with a 🔒). Milestones like "First Step", "Getting Going (10)", "On Fire (7-day streak)", etc.
- **Streak flame** in the header that grows/glows with the streak.
- **Confetti** burst when the last reminder of the day is cleared.
- **Custom reward** celebration modal ("Reward unlocked!") when a goal is hit.

### 7. Notepad (full-screen "constellation")
A full-screen canvas with a solid themed background covered in tiny star-like dots. **Tap anywhere to drop a note.** Notes are small rounded gradient cards you can drag around; each has a pencil (color) button and a delete X, plus a text area. The color editor offers **Change colour** (single) or **Add gradient** (2+ colors that blend, e.g. red→orange→yellow). Every note is connected to every other note by soft grey lines, so many notes look like a **constellation**. Full **zoom** (pinch / scroll wheel / + − buttons + reset %) and **pan** (drag empty space). Close via X top-right.

### 8. Friends (cloud, optional)
Opens as a window. If not signed into a (separate, optional) cloud account, show a small sign in / create form. Once in: a header with your avatar + @handle + Sign out, and tabs: **Friends**, **Requests**, **Find**, **Board**.
- **Find:** search by @username or name; each result has an "Add" button.
- **Requests:** incoming requests with accept ✓ / decline ✕.
- **Friends:** list of friends; each row has **Share reminder** and **Notepad** actions plus remove. (Friendships are always mutual/two-way.)
- **Board (leaderboard):** you + friends ranked by XP, showing rank, avatar, streak (flame), level, and XP.
- **Share reminder:** a sheet with a **New / Select** toggle — create a fresh shared reminder (title/date/time/repeat) or pick an existing one — shared with a chosen friend. Shared reminders appear on both people's home screens and remind both.
- **Shared notepad:** the same constellation notepad but **co-edited live** with a friend (same zoom/pan), header shows "Shared with [name]".

### 9. Automations (desktop only)
A section on home listing "Automations" (macros): Auto Clicker, Key Presser, Auto Typer, Mouse Jiggler. Each is a card with an icon, name, description, a run/stop control, a global hotkey chip, and live run stats. A "New task" preset picker + config form to create them.

---

## Platform & responsiveness
- **Desktop:** roomy multi-column layouts; settings/stats/friends open as centered "windows"; automations visible.
- **Mobile (iPhone):** single column, big tap targets, bottom-safe-area aware; settings/notepad become full-screen sheets; images and desktop-only automations are hidden; respect the notch/Dynamic Island and home indicator (safe-area insets).

## Voice & microcopy
Warm, quiet, encouraging, a little poetic. Examples: "What do you want to remember?", "A quiet sky, waiting for stars", "Nothing on your mind yet", "Reward unlocked!". Never shouty. Lowercase-friendly, gentle.

## How it works (behaviour & logic)

Build the interactions so the prototype actually behaves like the real app:

**Storage & accounts**
- **Local-first:** each user's account, reminders, notes, and progress are saved on the device and persist across restarts (no internet needed). A device can hold multiple local accounts (username + password); the last one auto-logs-in.
- **Optional cloud account (for friends only):** a *separate* email/password login (Firebase). Signing into it unlocks friends/sharing; the offline app works fine without it. This login persists (sign in once).

**Reminders & scheduling**
- Create a reminder with a title, date/time, and a repeat rule: **Once, Daily, Weekdays, Weekends, Weekly.**
- The first fire time snaps to the next valid occurrence (e.g. a "Weekends" reminder made on a Wednesday waits until Saturday rather than firing immediately). Cards show a live countdown ("in 2h 15m"); it never shows "now" for a future recurring one.
- **When due:** it alerts — on desktop a floating alert window + optional chime; on mobile an OS notification (with the chosen sound, vibration, and optional "strong alert" repeat-buzz).
- **Dismiss** a recurring reminder → it advances to its next occurrence; a one-time reminder → it's cleared. **Snooze** = +5 minutes. **Done** on a card does the same (advance or clear).

**Gamification (all local, auto-saved)**
- Completing a reminder = **+10 XP**, plus **+5** if done within ~30 min of its due time ("on time").
- **Level** is derived from cumulative XP on a rising curve (each level costs more than the last).
- **Streak:** an on-time completion extends your day streak by 1; a completion the next day continues it; missing a day resets it. Best streak is remembered.
- **Daily progress** = reminders done today ÷ reminders due today. Hitting 100% (last one cleared) triggers a one-per-day **confetti** burst.
- **Achievements** unlock automatically when thresholds are crossed (first done, 10/50/100 done, 3/7/30-day streaks, a level milestone) and pop a toast.
- **Custom reward:** the user sets a goal (X completions or an N-day streak) + reward text; reaching it shows a celebration modal.
- **Seasonal app-icon unlocks (mobile):** completing ~3 reminders during a season/holiday permanently unlocks that season's app icon.

**Personalization**
- Theme (light/dark), background gradient, overlay pattern, seasonal theme (auto-switches by the calendar date), zen mode, micro-animations, and looping ambient music are all toggles that apply instantly and are remembered. Timezone can be manual or auto (drives every displayed time).

**Notepad**
- Notes are saved per user. **Tap empty canvas → new note.** Drag to move; pencil → recolor (single color, or build a multi-color gradient); delete with X. Every note links to every other with soft grey lines (a growing constellation). The whole canvas **pans** (drag empty space) and **zooms** (pinch / wheel / buttons).

**Friends & cloud (real-time)**
- Search users by @handle or name → send a request → they accept. **Friendships are always mutual and atomic** (both sides are written together and self-heal, so they can't end up one-sided). Friends, requests, and the leaderboard update **live on both devices** the instant something changes.
- **Leaderboard** ranks you + friends by XP (your XP/streak/avatar publish to your cloud profile automatically).
- **Privacy:** a friend only sees your profile photo if you turned "show my profile picture to friends" on (off by default).

**Sharing (real-time, both people)**
- **Shared reminder:** created for a friend (new, or picked from your existing reminders). It appears on **both** home screens with a "Shared · [name]" badge and reminds **both** of you; marking it done/editing syncs to both instantly.
- **Shared notepad:** a co-edited constellation. Adding, moving, recoloring, or deleting a note shows up for the other person **live**, with the same pan/zoom.

**Platform differences**
- **Desktop (Electron):** floating alert windows; a "New task" **automations** section (auto-clicker, key-presser, auto-typer, mouse-jiggler) with global hotkeys and run stats.
- **Mobile (iOS):** OS notifications instead of alert windows; automations and reminder images are hidden; layouts are full-screen and respect safe areas (notch / home indicator).

## Deliverables
Design the full set of screens for both desktop and mobile using the tokens above, a reusable component library (buttons, pills, cards, inputs, badges, avatars, chips, modals/sheets, the sidebar, tab bars), and both **light and dark** themes. Lead with the light theme, terra + cream palette, Fraunces + Geist type, and the `Lull.` wordmark identity throughout.
