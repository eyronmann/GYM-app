'use strict';
/*
  Gym Log: a workout logger for one person, running offline on a phone.

  Everything is saved in this browser's localStorage under STORAGE_KEY.
  There is no server. The only copy of the data outside the phone is a
  backup file the user exports from the Backup tab.

  Read AGENTS.md before changing this file. The data-format rules there
  are what keep old workouts readable after an update.
*/

const STORAGE_KEY = 'gymlog.v1';
const DATA_VERSION = 1;
const APP_VERSION = '1.0.0';

// One bumper-plate colour per workout in the rotation (A red, B blue, C yellow, D green, then repeat).
const PLATES = [
  { plate: 'var(--plate-red)', ink: '#ffffff' },
  { plate: 'var(--plate-blue)', ink: '#ffffff' },
  { plate: 'var(--plate-yellow)', ink: 'var(--floor)' },
  { plate: 'var(--plate-green)', ink: '#ffffff' },
];

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

const $ = (sel, root = document) => root.querySelector(sel);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Exercises are matched across workouts by name, so "Hack Squat" in A and C share one history.
const keyOf = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

function toNum(v) {
  if (v === '' || v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
const fmt = (n) => (n == null ? '' : String(Math.round(n * 100) / 100));
const letter = (i) => String.fromCharCode(65 + (i % 26));
const plateStyle = (i) => {
  const p = PLATES[((i % PLATES.length) + PLATES.length) % PLATES.length];
  return `--plate:${p.plate};--plate-ink:${p.ink}`;
};
const repsText = (r) => String(r || '').replace(/(\d)\s*-\s*(\d)/g, '$1–$2');

function setText(s) {
  if (s.w == null || s.w === 0) return `${s.r} reps`;
  return `${fmt(s.w)} × ${s.r}`;
}

function topReps(text) {
  const nums = String(text || '').match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : null;
}

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
function ago(iso) {
  const d = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeLabel = (iso) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const daysSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 86400000 : Infinity);

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ------------------------------------------------------------------ */
/* Data: defaults, loading, saving                                     */
/* ------------------------------------------------------------------ */

function exercise(name, sets, reps) {
  return { id: uid(), name, sets, reps };
}

// Starting program. Edit it in the Program tab; these are only a starting point.
function defaultProgram() {
  return [
    {
      id: uid(), name: 'Strength', exercises: [
        exercise('Hack Squat', 3, '5-6'),
        exercise('Barbell Bench Press', 3, '5-6'),
        exercise('T-Bar Row', 3, '6-8'),
        exercise('Dumbbell Shoulder Press', 2, '6-8'),
        exercise('Barbell Curl', 2, '8-10'),
      ],
    },
    {
      id: uid(), name: 'Hypertrophy', exercises: [
        exercise('Leg Press', 3, '10-15'),
        exercise('Incline Dumbbell Press', 3, '8-12'),
        exercise('Lat Pulldown', 3, '10-12'),
        exercise('Cable Lateral Raise', 3, '12-15'),
        exercise('Cable Triceps Pushdown', 3, '10-15'),
        exercise('Leg Extension', 2, '12-15'),
      ],
    },
    {
      id: uid(), name: 'Balanced', exercises: [
        exercise('Hack Squat', 3, '8-10'),
        exercise('Dumbbell Bench Press', 3, '8-10'),
        exercise('Seated Cable Row', 3, '8-12'),
        exercise('Dumbbell Lateral Raise', 3, '12-15'),
        exercise('Hammer Curl', 2, '10-12'),
        exercise('Overhead Cable Triceps Extension', 2, '10-12'),
      ],
    },
  ];
}

function defaultData() {
  return {
    version: DATA_VERSION,
    settings: { unit: 'kg', restSeconds: 90, restSound: true, keepAwake: true },
    program: defaultProgram(),
    sessions: [],
    active: null,
    lastBackupAt: null,
    installTipDismissed: false,
  };
}

// Takes anything that looks like saved data (from storage or a backup file)
// and returns a complete, current-version object. Throws if it isn't ours.
function migrate(d) {
  if (!d || typeof d !== 'object' || (!Array.isArray(d.sessions) && !Array.isArray(d.program))) {
    throw new Error('Not Gym Log data');
  }
  const base = defaultData();
  const program = (Array.isArray(d.program) ? d.program : [])
    .filter((w) => w && typeof w === 'object')
    .map((w) => ({
      id: String(w.id || uid()),
      name: String(w.name || 'Workout'),
      exercises: (Array.isArray(w.exercises) ? w.exercises : [])
        .filter((e) => e && e.name)
        .map((e) => ({ id: String(e.id || uid()), name: String(e.name), sets: clampSets(e.sets), reps: String(e.reps ?? '') })),
    }));
  const sessions = (Array.isArray(d.sessions) ? d.sessions : [])
    .filter((s) => s && s.finishedAt && Array.isArray(s.entries))
    .map((s) => ({
      ...s,
      entries: s.entries
        .filter((e) => e && e.name)
        .map((e) => ({
          ...e,
          key: e.key || keyOf(e.name),
          sets: (Array.isArray(e.sets) ? e.sets : []).map((x) => ({ w: toNum(x.w), r: toNum(x.r) })).filter((x) => x.r != null),
        })),
    }))
    .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));

  return {
    version: DATA_VERSION,
    settings: { ...base.settings, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}) },
    program: program.length ? program : base.program,
    sessions,
    active: d.active && Array.isArray(d.active.entries) ? d.active : null,
    lastBackupAt: d.lastBackupAt || null,
    installTipDismissed: !!d.installTipDismissed,
  };
}

function clampSets(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 3;
}

let startupNotice = '';

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    startupNotice = 'This browser is blocking storage, so nothing will be saved. Open the app normally, not in a private tab.';
    return defaultData();
  }
  if (!raw) return defaultData();
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    // Never overwrite data we could not read. Park it under its own key and start fresh.
    try { localStorage.setItem(`${STORAGE_KEY}.unreadable.${Date.now()}`, raw); } catch (_) { /* full */ }
    startupNotice = 'Saved data could not be read, so it was set aside untouched. Import your latest backup from the Backup tab.';
    return defaultData();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    toast('Could not save. Export a backup from the Backup tab now.');
  }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let db = load();
let tab = 'today';
let historyMode = 'sessions';
let deferredInstall = null;

/* ------------------------------------------------------------------ */
/* Workout logic                                                       */
/* ------------------------------------------------------------------ */

function programIndex(workoutId) {
  return db.program.findIndex((w) => w.id === workoutId);
}

// The rotation: whatever comes after the last finished workout.
function nextWorkoutIndex() {
  if (!db.program.length) return -1;
  const last = db.sessions[db.sessions.length - 1];
  if (!last) return 0;
  const i = programIndex(last.workoutId);
  return i === -1 ? 0 : (i + 1) % db.program.length;
}

// The most recent finished session that included this exercise.
function lastFor(key) {
  for (let i = db.sessions.length - 1; i >= 0; i--) {
    const s = db.sessions[i];
    const e = s.entries.find((x) => x.key === key);
    if (e && e.sets.length) return { at: s.finishedAt, label: s.label, workoutId: s.workoutId, sets: e.sets };
  }
  return null;
}

// "Add weight" when every set last time reached the top of the rep range.
function readyToAddWeight(entry, last) {
  if (!last) return false;
  const top = topReps(entry.targetReps);
  if (!top) return false;
  const need = Math.max(1, entry.targetSets || last.sets.length);
  return last.sets.length >= need && last.sets.slice(0, need).every((s) => s.r >= top);
}

// What to pre-fill in an empty set: the set just before it today, otherwise the same set last time.
function suggestion(entry, i, last) {
  const prev = i > 0 ? entry.sets[i - 1] : null;
  if (prev && prev.done) return { w: prev.w, r: prev.r };
  const src = last ? last.sets[i] || last.sets[last.sets.length - 1] : null;
  return src ? { w: fmt(src.w), r: src.r != null ? String(src.r) : '' } : { w: '', r: '' };
}

function newSet() {
  return { w: '', r: '', done: false };
}

function startWorkout(index) {
  const w = db.program[index];
  if (!w) return;
  db.active = {
    id: uid(),
    workoutId: w.id,
    label: letter(index),
    name: w.name,
    startedAt: new Date().toISOString(),
    entries: w.exercises.map((e) => ({
      id: uid(),
      key: keyOf(e.name),
      name: e.name,
      targetSets: e.sets,
      targetReps: e.reps,
      sets: Array.from({ length: clampSets(e.sets) }, newSet),
    })),
  };
  save();
  render();
  window.scrollTo(0, 0);
  keepAwake();
}

function findEntry(entryId) {
  return db.active ? db.active.entries.find((e) => e.id === entryId) : null;
}

function toggleSet(entryId, i) {
  const entry = findEntry(entryId);
  if (!entry || !entry.sets[i]) return;
  const set = entry.sets[i];
  if (set.done) {
    set.done = false;
    save();
    render();
    return;
  }
  const sug = suggestion(entry, i, lastFor(entry.key));
  if (set.w === '') set.w = sug.w;
  if (set.r === '') set.r = sug.r;
  if (!(toNum(set.r) > 0)) {
    toast('Enter the reps you did, then tick the set.');
    const input = document.querySelector(`input[data-entry="${entryId}"][data-set="${i}"][data-field="r"]`);
    if (input) input.focus();
    return;
  }
  set.done = true;
  save();
  render();
  startRest(entry.name);
}

function finishWorkout() {
  const a = db.active;
  if (!a) return;
  const entries = a.entries
    .map((e) => ({
      key: e.key,
      name: e.name,
      targetSets: e.targetSets,
      targetReps: e.targetReps,
      sets: e.sets.filter((s) => s.done && toNum(s.r) > 0).map((s) => ({ w: toNum(s.w), r: toNum(s.r) })),
    }))
    .filter((e) => e.sets.length);

  if (!entries.length) {
    if (confirm('No sets are ticked, so there is nothing to save. Discard this workout?')) discardWorkout(true);
    return;
  }
  const unticked = a.entries.reduce((n, e) => n + e.sets.filter((s) => !s.done && (s.w !== '' || s.r !== '')).length, 0);
  if (unticked && !confirm(`${unticked} set${unticked > 1 ? 's have' : ' has'} numbers but no tick, and won't be saved. Finish anyway?`)) return;

  db.sessions.push({
    id: a.id,
    workoutId: a.workoutId,
    label: a.label,
    name: a.name,
    startedAt: a.startedAt,
    finishedAt: new Date().toISOString(),
    entries,
  });
  db.active = null;
  save();
  stopRest();
  releaseWake();
  render();
  window.scrollTo(0, 0);
  toast('Workout saved.');
}

function discardWorkout(skipConfirm) {
  if (!skipConfirm && !confirm('Discard this workout? None of its sets will be saved.')) return;
  db.active = null;
  save();
  stopRest();
  releaseWake();
  render();
  window.scrollTo(0, 0);
}

/* ------------------------------------------------------------------ */
/* Rest timer                                                          */
/* ------------------------------------------------------------------ */

let rest = null; // { endsAt, what, over }
let restInterval = null;
let audioCtx = null;

function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (_) { /* no audio */ }
}

function beep() {
  if (!audioCtx || !db.settings.restSound) return;
  try {
    const t = audioCtx.currentTime;
    [0, 0.25].forEach((offset) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t + offset);
      g.gain.exponentialRampToValueAtTime(0.35, t + offset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t + offset);
      o.stop(t + offset + 0.2);
    });
  } catch (_) { /* ignore */ }
}

function startRest(what) {
  const secs = Number(db.settings.restSeconds) || 0;
  if (!secs) return;
  unlockAudio();
  rest = { endsAt: Date.now() + secs * 1000, what, over: false };
  const el = $('#timer');
  el.innerHTML = `
    <span class="t"></span>
    <span class="what"></span>
    <button type="button" data-action="rest-add">+15s</button>
    <button type="button" data-action="rest-skip">Skip</button>`;
  el.hidden = false;
  clearInterval(restInterval);
  restInterval = setInterval(tickRest, 250);
  tickRest();
}

function tickRest() {
  const el = $('#timer');
  if (!rest) { el.hidden = true; return; }
  const msLeft = rest.endsAt - Date.now();
  if (msLeft <= 0 && !rest.over) {
    rest.over = true;
    if (navigator.vibrate) navigator.vibrate([250, 120, 250]);
    beep();
  }
  if (rest.over && -msLeft > 5000) { stopRest(); return; }
  const left = Math.max(0, Math.ceil(msLeft / 1000));
  el.classList.toggle('over', rest.over);
  $('.t', el).textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  $('.what', el).textContent = rest.over ? 'Rest over. Next set.' : `Resting after ${rest.what}`;
}

function stopRest() {
  rest = null;
  clearInterval(restInterval);
  restInterval = null;
  $('#timer').hidden = true;
}

/* ------------------------------------------------------------------ */
/* Keep the screen on during a workout                                 */
/* ------------------------------------------------------------------ */

let wakeLock = null;
async function keepAwake() {
  if (!db.active || !db.settings.keepAwake || wakeLock || !('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (_) { /* not allowed right now */ }
}
function releaseWake() {
  try { if (wakeLock) wakeLock.release(); } catch (_) { /* ignore */ }
  wakeLock = null;
}

/* ------------------------------------------------------------------ */
/* Backup                                                              */
/* ------------------------------------------------------------------ */

function backupFile() {
  const stamp = new Date().toISOString().slice(0, 10);
  const json = JSON.stringify({ app: 'gym-log', exportedAt: new Date().toISOString(), ...db }, null, 2);
  return new File([json], `gym-log-backup-${stamp}.json`, { type: 'application/json' });
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function markBackedUp(msg) {
  db.lastBackupAt = new Date().toISOString();
  save();
  render();
  toast(msg);
}

const canShareFiles = () => {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })); }
  catch (_) { return false; }
};

function exportBackup(mode) {
  const file = backupFile();
  if (mode === 'share' && canShareFiles()) {
    navigator.share({ files: [file], title: 'Gym Log backup' })
      .then(() => markBackedUp('Backup sent.'))
      .catch((err) => { if (err && err.name !== 'AbortError') { downloadFile(file); markBackedUp('Backup downloaded.'); } });
    return;
  }
  downloadFile(file);
  markBackedUp('Backup downloaded.');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try {
      data = migrate(JSON.parse(reader.result));
    } catch (_) {
      toast("That file isn't a Gym Log backup.");
      return;
    }
    const n = data.sessions.length;
    if (!confirm(`Replace everything on this phone with this backup? It has ${n} workout${n === 1 ? '' : 's'}.`)) return;
    // Keep the data being replaced, just in case.
    try { localStorage.setItem(`${STORAGE_KEY}.before-import`, JSON.stringify(db)); } catch (_) { /* full */ }
    db = data;
    stopRest();
    save();
    render();
    toast('Backup restored.');
  };
  reader.readAsText(file);
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

const isStandalone = () =>
  (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function noticesHtml() {
  const out = [];
  if (startupNotice) out.push(`<div class="notice warn">${esc(startupNotice)}</div>`);

  if (!isStandalone() && !db.installTipDismissed) {
    const how = isIOS()
      ? 'In Safari, tap Share, then Add to Home Screen. Install before you start logging: the installed app keeps its own data, separate from Safari.'
      : 'Open the browser menu (⋮) and tap Add to Home screen or Install app.';
    out.push(`
      <div class="notice">
        <p><strong>Put it on your home screen</strong><br><span class="muted small">${how}</span></p>
        <div class="row">
          ${deferredInstall ? '<button type="button" class="btn small primary" data-action="install">Install app</button>' : ''}
          <button type="button" class="btn small ghost" data-action="dismiss-install">Got it</button>
        </div>
      </div>`);
  }

  if (db.sessions.length >= 3 && daysSince(db.lastBackupAt) > 14) {
    const when = db.lastBackupAt ? `Last backup ${ago(db.lastBackupAt)}.` : 'You have never backed up.';
    out.push(`
      <div class="notice warn">
        <p><strong>${db.sessions.length} workouts exist only on this phone.</strong><br><span class="muted small">${when} Clearing browser data would erase them.</span></p>
        <button type="button" class="btn small primary" data-action="export">Back up now</button>
      </div>`);
  }
  return out.join('');
}

function viewToday() {
  if (!db.program.length) {
    return `${noticesHtml()}
      <div class="empty"><strong>No workouts in your program.</strong>Add one in the Program tab to start logging.</div>
      <button type="button" class="btn block" data-goto="program">Open Program</button>`;
  }
  const i = nextWorkoutIndex();
  const w = db.program[i];
  const lastAny = db.sessions[db.sessions.length - 1];
  const lastLine = lastAny ? `Last trained ${ago(lastAny.finishedAt)}, workout ${esc(lastAny.label)}.` : 'Nothing logged yet.';

  const others = db.program
    .map((ow, oi) => (oi === i ? '' : `
      <button type="button" class="btn small" data-action="start" data-index="${oi}" style="${plateStyle(oi)}">
        <span class="disc" style="--size:24px">${letter(oi)}</span>${esc(ow.name)}
      </button>`))
    .join('');

  return `${noticesHtml()}
    <section class="next" style="${plateStyle(i)}">
      <span class="disc big" aria-hidden="true">${letter(i)}</span>
      <div>
        <p class="label">Next in your rotation</p>
        <h2>${esc(w.name)}</h2>
        <p class="muted small" style="margin:0">${lastLine}</p>
      </div>
    </section>
    <ul class="preview">
      ${w.exercises.map((e) => `<li><span>${esc(e.name)}</span><span class="muted num">${e.sets} × ${esc(repsText(e.reps))}</span></li>`).join('')}
    </ul>
    <button type="button" class="btn plate block" data-action="start" data-index="${i}" style="${plateStyle(i)}">Start workout ${letter(i)}</button>
    ${others ? `<p class="muted small" style="margin:18px 0 0">Doing a different one today?</p><div class="switch">${others}</div>` : ''}`;
}

function viewWorkout() {
  const a = db.active;
  const pi = programIndex(a.workoutId);
  const style = plateStyle(pi === -1 ? a.label.charCodeAt(0) - 65 : pi);
  const unit = esc(db.settings.unit);

  const cards = a.entries.map((entry) => {
    const last = lastFor(entry.key);
    const where = last && last.workoutId !== a.workoutId && last.label ? `, in ${esc(last.label)}` : '';
    const lastHtml = last
      ? `<div class="last"><span class="when">Last time (${ago(last.at)}${where})</span>${last.sets.map((s) => `<span class="chip">${setText(s)}</span>`).join('')}</div>`
      : '<div class="last"><span class="when">First time logging this one.</span></div>';
    const hint = readyToAddWeight(entry, last) ? '<p class="hint">You hit every rep last time. Add weight today.</p>' : '';

    const rows = entry.sets.map((s, i) => {
      const sug = suggestion(entry, i, last);
      return `
        <tr class="${s.done ? 'done' : ''}">
          <td>${i + 1}</td>
          <td><input type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next"
                data-entry="${entry.id}" data-set="${i}" data-field="w"
                value="${esc(s.w)}" placeholder="${esc(sug.w)}" aria-label="${esc(entry.name)} set ${i + 1} weight in ${unit}"></td>
          <td><input type="text" inputmode="numeric" autocomplete="off" enterkeyhint="done"
                data-entry="${entry.id}" data-set="${i}" data-field="r"
                value="${esc(s.r)}" placeholder="${esc(sug.r)}" aria-label="${esc(entry.name)} set ${i + 1} reps"></td>
          <td class="tick-cell"><button type="button" class="tick" data-action="tick" data-entry="${entry.id}" data-set="${i}"
                aria-pressed="${s.done}" aria-label="Set ${i + 1} done">✓</button></td>
        </tr>`;
    }).join('');

    return `
      <section class="card ex" style="${style}">
        <div class="ex-top">
          <h3>${esc(entry.name)}</h3>
          <span class="target num">${entry.targetSets ? `${entry.targetSets} × ${esc(repsText(entry.targetReps))}` : ''}</span>
        </div>
        ${lastHtml}
        ${hint}
        <table class="sets">
          <thead><tr><th scope="col" class="c">Set</th><th scope="col" class="c">${unit}</th><th scope="col" class="c">Reps</th><th scope="col"><span class="sr-only">Done</span></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="ex-actions">
          <button type="button" class="btn small ghost" data-action="add-set" data-entry="${entry.id}">Add set</button>
          <button type="button" class="btn small ghost" data-action="remove-set" data-entry="${entry.id}" ${entry.sets.length <= 1 ? 'disabled' : ''}>Remove last set</button>
        </div>
      </section>`;
  }).join('');

  const done = a.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const total = a.entries.reduce((n, e) => n + e.sets.length, 0);

  return `
    <div class="wo-head" style="${style}">
      <span class="disc" aria-hidden="true">${esc(a.label)}</span>
      <div class="grow">
        <h2>${esc(a.name)}</h2>
        <p class="muted small" style="margin:0">Started ${timeLabel(a.startedAt)}. <span class="num">${done} of ${total}</span> sets done.</p>
      </div>
    </div>
    ${cards || '<div class="empty"><strong>This workout has no exercises.</strong>Add one below.</div>'}
    <button type="button" class="btn block ghost" style="margin-top:12px" data-action="add-exercise">Add an exercise</button>
    <div class="finish-bar">
      <button type="button" class="btn primary block" data-action="finish">Finish and save workout</button>
      <button type="button" class="btn danger block" data-action="discard">Discard workout</button>
    </div>`;
}

function sessionPlate(s) {
  const pi = programIndex(s.workoutId);
  return plateStyle(pi === -1 ? (s.label || 'A').charCodeAt(0) - 65 : pi);
}

function viewHistory() {
  const seg = `
    <div class="seg" role="group" aria-label="History view">
      <button type="button" data-action="history-mode" data-mode="sessions" aria-pressed="${historyMode === 'sessions'}">Workouts</button>
      <button type="button" data-action="history-mode" data-mode="exercises" aria-pressed="${historyMode === 'exercises'}">Exercises</button>
    </div>`;

  if (!db.sessions.length) {
    return `${seg}<div class="empty"><strong>No workouts yet.</strong>Finish a workout and it shows up here.</div>`;
  }

  if (historyMode === 'sessions') {
    const items = [...db.sessions].reverse().map((s) => {
      const mins = Math.max(1, Math.round((new Date(s.finishedAt) - new Date(s.startedAt)) / 60000));
      const setCount = s.entries.reduce((n, e) => n + e.sets.length, 0);
      return `
        <details class="card" style="${sessionPlate(s)}">
          <summary>
            <div class="row">
              <span class="disc" aria-hidden="true">${esc(s.label)}</span>
              <div class="grow">
                <h3>${esc(s.name)}</h3>
                <p class="muted small" style="margin:0">${dateLabel(s.finishedAt)}, ${mins} min, ${setCount} sets</p>
              </div>
            </div>
          </summary>
          <ul class="sess-lines">
            ${s.entries.map((e) => `<li><div>${esc(e.name)}</div><div class="sets-line">${e.sets.map(setText).join(', ')}</div></li>`).join('')}
          </ul>
          <button type="button" class="btn small danger" data-action="delete-session" data-id="${esc(s.id)}">Delete this workout</button>
        </details>`;
    }).join('');
    return `${seg}<div class="stack">${items}</div>`;
  }

  // Exercises view: every exercise ever logged, most recently trained first.
  const map = new Map();
  db.sessions.forEach((s) => {
    s.entries.forEach((e) => {
      if (!map.has(e.key)) map.set(e.key, { name: e.name, records: [] });
      const rec = map.get(e.key);
      rec.name = e.name;
      rec.records.push({ at: s.finishedAt, sets: e.sets });
    });
  });
  const list = [...map.values()].sort((a, b) => new Date(b.records[b.records.length - 1].at) - new Date(a.records[a.records.length - 1].at));
  const items = list.map((ex) => {
    let best = null;
    ex.records.forEach((r) => r.sets.forEach((s) => {
      if (!best || (s.w ?? 0) > (best.w ?? 0) || ((s.w ?? 0) === (best.w ?? 0) && s.r > best.r)) best = s;
    }));
    const latest = ex.records[ex.records.length - 1];
    return `
      <details class="card">
        <summary>
          <h3>${esc(ex.name)}</h3>
          <p class="muted small" style="margin:2px 0 0">Last ${ago(latest.at)}: <span class="num">${latest.sets.map(setText).join(', ')}</span></p>
          <p class="small" style="margin:2px 0 0">Best set: <strong class="num">${best ? setText(best) : '-'}</strong></p>
        </summary>
        <ul class="sess-lines">
          ${[...ex.records].reverse().map((r) => `<li><div class="muted small">${dateLabel(r.at)}</div><div class="sets-line">${r.sets.map(setText).join(', ')}</div></li>`).join('')}
        </ul>
      </details>`;
  }).join('');
  return `${seg}<div class="stack">${items}</div>`;
}

function viewProgram() {
  const order = db.program.map((_, i) => letter(i)).join(', then ');
  const workouts = db.program.map((w, wi) => `
    <section class="card" style="${plateStyle(wi)}">
      <div class="row" style="margin-bottom:6px">
        <span class="disc" aria-hidden="true">${letter(wi)}</span>
        <label class="field grow"><span>Workout ${letter(wi)} name</span>
          <input type="text" data-prog="wname" data-w="${w.id}" value="${esc(w.name)}"></label>
      </div>
      ${w.exercises.map((e, ei) => `
        <div class="prog-ex">
          <input type="text" class="name" data-prog="ename" data-w="${w.id}" data-e="${e.id}" value="${esc(e.name)}" placeholder="Exercise name" aria-label="Exercise name">
          <input type="text" class="n" inputmode="numeric" data-prog="esets" data-w="${w.id}" data-e="${e.id}" value="${e.sets}" aria-label="${esc(e.name)} sets">
          <span class="x" aria-hidden="true">×</span>
          <input type="text" class="n" data-prog="ereps" data-w="${w.id}" data-e="${e.id}" value="${esc(e.reps)}" placeholder="8-12" aria-label="${esc(e.name)} reps">
          <span class="muted small" aria-hidden="true">reps</span>
          <div class="tools">
            <button type="button" class="icon-btn" data-action="move-ex" data-dir="-1" data-w="${w.id}" data-e="${e.id}" aria-label="Move ${esc(e.name)} up" ${ei === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon-btn" data-action="move-ex" data-dir="1" data-w="${w.id}" data-e="${e.id}" aria-label="Move ${esc(e.name)} down" ${ei === w.exercises.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon-btn" data-action="remove-ex" data-w="${w.id}" data-e="${e.id}" aria-label="Remove ${esc(e.name)}">✕</button>
          </div>
        </div>`).join('')}
      <div class="row" style="margin-top:10px">
        <button type="button" class="btn small" data-action="add-ex" data-w="${w.id}">Add exercise</button>
        <span class="grow"></span>
        <button type="button" class="btn small danger" data-action="delete-workout" data-w="${w.id}">Delete workout</button>
      </div>
    </section>`).join('');

  return `
    <p class="muted small">Your rotation runs ${order}, then starts over. Changes save as you type and apply from your next workout.</p>
    <p class="muted small">History is matched by exercise name. Renaming an exercise starts a fresh history; the old entries stay under the old name.</p>
    <div class="stack">${workouts}</div>
    <button type="button" class="btn block" style="margin-top:14px" data-action="add-workout">Add workout ${letter(db.program.length)}</button>`;
}

function viewData() {
  const s = db.settings;
  const restOpts = [0, 60, 90, 120, 150, 180, 240]
    .map((v) => `<option value="${v}" ${Number(s.restSeconds) === v ? 'selected' : ''}>${v ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : 'Off'}</option>`)
    .join('');
  const last = db.lastBackupAt ? `Last backup: ${dateLabel(db.lastBackupAt)}.` : 'No backup yet.';

  return `
    <section class="card">
      <h3>Backup</h3>
      <p class="muted small" style="margin-top:4px">Your workouts are stored only on this phone. Clearing browser data or losing the phone erases them unless you have a backup file. ${last}</p>
      <div class="stack">
        ${canShareFiles() ? '<button type="button" class="btn primary block" data-action="share">Send backup to Drive or a chat</button>' : ''}
        <button type="button" class="btn block ${canShareFiles() ? '' : 'primary'}" data-action="export">Download backup file</button>
        <label class="btn block ghost">Restore from a backup file
          <input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </section>

    <section class="card" style="margin-top:14px">
      <h3>Settings</h3>
      <div class="stack" style="margin-top:10px">
        <label class="field"><span>Weight unit (a label only, numbers are not converted)</span>
          <select data-setting="unit">
            <option value="kg" ${s.unit === 'kg' ? 'selected' : ''}>kg</option>
            <option value="lb" ${s.unit === 'lb' ? 'selected' : ''}>lb</option>
          </select></label>
        <label class="field"><span>Rest timer after each set</span>
          <select data-setting="restSeconds">${restOpts}</select></label>
        <label class="row"><input type="checkbox" data-setting="restSound" ${s.restSound ? 'checked' : ''} style="width:22px;min-height:22px"> Beep when rest is over</label>
        <label class="row"><input type="checkbox" data-setting="keepAwake" ${s.keepAwake ? 'checked' : ''} style="width:22px;min-height:22px"> Keep the screen on during a workout</label>
      </div>
    </section>

    <section class="card" style="margin-top:14px">
      <h3>Erase everything</h3>
      <p class="muted small" style="margin-top:4px">Deletes every workout and resets your program on this phone. Download a backup first.</p>
      <button type="button" class="btn danger block" data-action="erase">Erase all data</button>
    </section>
    <p class="muted small" style="text-align:center;margin-top:18px">Gym Log ${APP_VERSION}</p>`;
}

const TITLES = { today: 'Today', history: 'History', program: 'Program', data: 'Backup and settings' };

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
    b.classList.toggle('live', b.dataset.tab === 'today' && !!db.active);
  });
  let html = '';
  if (tab === 'today') html = db.active ? viewWorkout() : viewToday();
  else if (tab === 'history') html = viewHistory();
  else if (tab === 'program') html = viewProgram();
  else html = viewData();
  $('#view').innerHTML = html;
  $('#title').textContent = tab === 'today' && db.active ? 'Workout in progress' : TITLES[tab];
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function workoutById(id) { return db.program.find((w) => w.id === id); }

const actions = {
  start: (el) => {
    if (db.active && !confirm('A workout is already in progress. Discard it and start this one?')) return;
    startWorkout(Number(el.dataset.index));
  },
  tick: (el) => { unlockAudio(); toggleSet(el.dataset.entry, Number(el.dataset.set)); },
  'add-set': (el) => {
    const e = findEntry(el.dataset.entry);
    if (e) { e.sets.push(newSet()); save(); render(); }
  },
  'remove-set': (el) => {
    const e = findEntry(el.dataset.entry);
    if (!e || e.sets.length <= 1) return;
    const lastSet = e.sets[e.sets.length - 1];
    if (lastSet.done && !confirm('The last set is ticked. Remove it anyway?')) return;
    e.sets.pop(); save(); render();
  },
  'add-exercise': () => {
    const name = (prompt('Exercise name') || '').trim();
    if (!name) return;
    db.active.entries.push({ id: uid(), key: keyOf(name), name, targetSets: 3, targetReps: '', sets: [newSet(), newSet(), newSet()] });
    save(); render();
  },
  finish: () => finishWorkout(),
  discard: () => discardWorkout(false),
  'rest-add': () => { if (rest) { rest.endsAt = Math.max(rest.endsAt, Date.now()) + 15000; rest.over = false; tickRest(); } },
  'rest-skip': () => stopRest(),
  'history-mode': (el) => { historyMode = el.dataset.mode; render(); },
  'delete-session': (el) => {
    const s = db.sessions.find((x) => x.id === el.dataset.id);
    if (!s || !confirm(`Delete ${s.name} from ${dateLabel(s.finishedAt)}? This can't be undone.`)) return;
    db.sessions = db.sessions.filter((x) => x.id !== s.id);
    save(); render(); toast('Workout deleted.');
  },
  'move-ex': (el) => {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    const i = w.exercises.findIndex((e) => e.id === el.dataset.e);
    const j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= w.exercises.length) return;
    [w.exercises[i], w.exercises[j]] = [w.exercises[j], w.exercises[i]];
    save(); render();
  },
  'remove-ex': (el) => {
    const w = workoutById(el.dataset.w);
    const e = w && w.exercises.find((x) => x.id === el.dataset.e);
    if (!e || !confirm(`Remove ${e.name} from ${w.name}? Its history stays.`)) return;
    w.exercises = w.exercises.filter((x) => x.id !== e.id);
    save(); render();
  },
  'add-ex': (el) => {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    w.exercises.push(exercise('', 3, '8-12'));
    save(); render();
    const inputs = document.querySelectorAll(`input[data-prog="ename"][data-w="${w.id}"]`);
    if (inputs.length) inputs[inputs.length - 1].focus();
  },
  'delete-workout': (el) => {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    if (db.program.length <= 1) { toast('Keep at least one workout.'); return; }
    if (!confirm(`Delete workout ${w.name}? Logged history stays.`)) return;
    db.program = db.program.filter((x) => x.id !== w.id);
    save(); render();
  },
  'add-workout': () => {
    db.program.push({ id: uid(), name: 'New workout', exercises: [] });
    save(); render();
  },
  export: () => exportBackup('download'),
  share: () => exportBackup('share'),
  erase: () => {
    const typed = prompt('This deletes every workout on this phone. Type ERASE to confirm.');
    if (typed !== 'ERASE') return;
    stopRest(); releaseWake();
    db = defaultData();
    save(); tab = 'today'; render(); toast('All data erased.');
  },
  install: async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (_) { /* ignore */ }
    deferredInstall = null;
    render();
  },
  'dismiss-install': () => { db.installTipDismissed = true; save(); render(); },
};

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabs button[data-tab]');
  if (tabBtn) { tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const go = e.target.closest('[data-goto]');
  if (go) { tab = go.dataset.goto; render(); window.scrollTo(0, 0); return; }
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  // Logging a set
  if (el.dataset.field && db.active) {
    const entry = findEntry(el.dataset.entry);
    const set = entry && entry.sets[Number(el.dataset.set)];
    if (set) { set[el.dataset.field] = el.value.trim(); save(); }
    return;
  }
  // Editing the program
  if (el.dataset.prog) {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    if (el.dataset.prog === 'wname') { w.name = el.value; save(); return; }
    const ex = w.exercises.find((x) => x.id === el.dataset.e);
    if (!ex) return;
    if (el.dataset.prog === 'ename') ex.name = el.value;
    if (el.dataset.prog === 'ereps') ex.reps = el.value;
    if (el.dataset.prog === 'esets' && el.value.trim() !== '') ex.sets = clampSets(el.value);
    save();
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[data-import]') && el.files && el.files[0]) {
    importBackup(el.files[0]);
    el.value = '';
    return;
  }
  if (el.dataset.setting) {
    const k = el.dataset.setting;
    db.settings[k] = el.type === 'checkbox' ? el.checked : k === 'restSeconds' ? Number(el.value) : el.value;
    save();
    if (k === 'keepAwake') { if (el.checked) keepAwake(); else releaseWake(); }
    return;
  }
  // Tidy program fields once the user leaves them.
  if (el.dataset.prog) {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    if (el.dataset.prog === 'wname' && !el.value.trim()) { w.name = 'Workout'; el.value = w.name; }
    const ex = w.exercises.find((x) => x.id === el.dataset.e);
    if (ex && el.dataset.prog === 'esets') { ex.sets = clampSets(el.value); el.value = ex.sets; }
    if (ex && el.dataset.prog === 'ename') ex.name = el.value.trim();
    save();
  }
});

// Enter on weight jumps to reps; Enter on reps ticks the set.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (!el.dataset || !el.dataset.field) return;
  e.preventDefault();
  if (el.dataset.field === 'w') {
    const reps = document.querySelector(`input[data-entry="${el.dataset.entry}"][data-set="${el.dataset.set}"][data-field="r"]`);
    if (reps) reps.focus();
  } else {
    const entry = findEntry(el.dataset.entry);
    const set = entry && entry.sets[Number(el.dataset.set)];
    if (set && !set.done) { unlockAudio(); toggleSet(el.dataset.entry, Number(el.dataset.set)); }
    else el.blur();
  }
});

// Drop empty exercises from the program when leaving the Program tab.
function tidyProgram() {
  let changed = false;
  db.program.forEach((w) => {
    const before = w.exercises.length;
    w.exercises = w.exercises.filter((x) => x.name.trim());
    if (w.exercises.length !== before) changed = true;
  });
  if (changed) save();
}
document.querySelector('.tabs').addEventListener('click', tidyProgram, true);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { keepAwake(); if (rest) tickRest(); }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (tab === 'today' && !db.active) render();
});

window.addEventListener('storage', (e) => {
  // Another tab changed the data: reload it so the two never overwrite each other.
  if (e.key === STORAGE_KEY && e.newValue) {
    try { db = migrate(JSON.parse(e.newValue)); render(); } catch (_) { /* ignore */ }
  }
});

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
render();
if (db.active) keepAwake();
