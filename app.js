'use strict';
/*
  Gym Log: a workout, body-weight and food logger for one person,
  running offline on a phone.

  Everything is saved in this browser's localStorage under STORAGE_KEY.
  There is no server. The only copy of the data outside the phone is a
  backup file the user exports from More > Backup and settings.

  Built-in data lives in data/exercises.js (window.EXERCISES) and
  data/foods.js (window.FOODS).

  Read AGENTS.md before changing this file. The data-format rules there
  are what keep old workouts readable after an update.
*/

const STORAGE_KEY = 'gymlog.v1'; // never rename, see AGENTS.md
const DATA_VERSION = 2;
const APP_VERSION = '2.0.3';

// One bumper-plate colour per workout in the rotation (A red, B blue, C yellow, D green, then repeat).
const PLATES = [
  { plate: 'var(--plate-red)', ink: '#ffffff' },
  { plate: 'var(--plate-blue)', ink: '#ffffff' },
  { plate: 'var(--plate-yellow)', ink: 'var(--floor)' },
  { plate: 'var(--plate-green)', ink: '#ffffff' },
];

const CATS = ['Legs', 'Chest', 'Back', 'Shoulders', 'Arms', 'Core'];

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
const r1 = (n) => Math.round(n * 10) / 10;
const macro = (n) => (Math.abs(n) < 10 ? r1(n) : Math.round(n));
const kcalText = (n) => Math.round(n).toLocaleString();
const pad2 = (n) => String(n).padStart(2, '0');
const letter = (i) => String.fromCharCode(65 + (i % 26));
const plateStyle = (i) => {
  const p = PLATES[((i % PLATES.length) + PLATES.length) % PLATES.length];
  return `--plate:${p.plate};--plate-ink:${p.ink}`;
};
const repsText = (r) => String(r || '').replace(/(\d)\s*-\s*(\d)/g, '$1–$2');

function setText(s) {
  if (!s) return '-';
  if (s.w == null || s.w === 0) return `${s.r} reps`;
  return `${fmt(s.w)} × ${s.r}`;
}

function topReps(text) {
  const nums = String(text || '').match(/\d+/g);
  return nums ? Math.max(...nums.map(Number)) : null;
}

// Dates. Body weight and food use local calendar days stored as "YYYY-MM-DD".
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDay = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parseDay(s); d.setDate(d.getDate() + n); return localDate(d); };
function dayLabel(s) {
  if (s === localDate()) return 'Today';
  if (s === addDays(localDate(), -1)) return 'Yesterday';
  return parseDay(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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

function clockText(fromIso) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
}

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  // An open sheet sits in the browser's top layer, so the toast has to live inside it to be seen.
  const d = $('#sheet');
  const host = d && d.open ? d : document.body;
  if (el.parentElement !== host) host.appendChild(el);
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

/* ------------------------------------------------------------------ */
/* Built-in libraries                                                  */
/* ------------------------------------------------------------------ */

const LIB = Array.isArray(window.EXERCISES) ? window.EXERCISES : [];
const LIB_BY_ID = new Map(LIB.map((e) => [e.id, e]));
const LIB_BY_KEY = new Map(LIB.map((e) => [keyOf(e.name), e]));
const libFor = (name) => LIB_BY_KEY.get(keyOf(name)) || null;
const altsOf = (e) => (e && Array.isArray(e.alts) ? e.alts.map((id) => LIB_BY_ID.get(id)).filter(Boolean) : []);

const FOOD_DB = Array.isArray(window.FOODS) ? window.FOODS : [];
const FOOD_BY_ID = new Map(FOOD_DB.map((f) => [f.id, f]));

/* ------------------------------------------------------------------ */
/* Data: defaults, loading, saving                                     */
/* ------------------------------------------------------------------ */

function exercise(name, sets, reps) {
  return { id: uid(), name, sets, reps };
}

// Starting program. Edit it in More > Program; these are only a starting point.
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
    settings: {
      unit: 'kg', restSeconds: 90, restSound: true, keepAwake: true,
      calorieTarget: null, proteinTarget: null,
    },
    program: defaultProgram(),
    sessions: [],
    active: null,
    bodyweights: [],
    foods: [],
    foodLog: [],
    lastBackupAt: null,
    installTipDismissed: false,
  };
}

const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// Takes anything that looks like saved data (from storage or a backup file, version 1 or 2)
// and returns a complete, current-version object.
// - Throws an error with code 'not-ours' if it isn't Gym Log data,
//   and code 'newer' if a newer version of the app wrote it (we must not downgrade it).
// - Nothing damaged passes silently. Every problem adds 1 to report.dropped: a record that
//   is left out, a field that had to be repaired (for example a missing id), or a list
//   that is missing or isn't a list when that data version must have it.
//   Callers keep an untouched copy of the original (or block saving) whenever it is > 0.
// - Data this app wrote itself always passes with 0 (checked by the tests).
function migrate(d, report = { dropped: 0 }) {
  if (!d || typeof d !== 'object' || Array.isArray(d) || (!Array.isArray(d.sessions) && !Array.isArray(d.program))) {
    throw Object.assign(new Error('Not Gym Log data'), { code: 'not-ours' });
  }
  if (d.version != null && !(Number.isInteger(d.version) && d.version >= 1)) {
    throw Object.assign(new Error('Unknown data version'), { code: 'not-ours' });
  }
  if (d.version > DATA_VERSION) {
    throw Object.assign(new Error('Saved by a newer version'), { code: 'newer' });
  }
  const problem = () => { report.dropped += 1; };
  // Every version this app ever saved has a version number. Read a file without one
  // by the oldest rules, but count it so the original is kept.
  if (d.version == null) problem();
  const version = d.version == null ? 1 : d.version;

  // A list field. Missing is fine only where that data version didn't have it yet.
  const list = (value, requiredFrom = 1) => {
    if (Array.isArray(value)) return value;
    if (value === undefined && version < requiredFrom) return [];
    problem(); // the whole list is unreadable or missing
    return [];
  };
  // Keep the items that pass, and count the ones that don't.
  const keep = (arr, ok) => {
    const out = arr.filter((x) => { try { return !!ok(x); } catch (_) { return false; } });
    report.dropped += arr.length - out.length;
    return out;
  };
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const isStr = (v) => typeof v === 'string';
  // Stored numbers must really be numbers. A damaged value is never quietly turned into 0.
  const num = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (typeof v === 'string' && v.trim() !== '') return Number(v.trim().replace(',', '.'));
    return NaN;
  };
  const isAmount = (v) => Number.isFinite(num(v)) && num(v) >= 0;
  const isNutrition = (x) => ['kcal', 'p', 'c', 'f'].every((k) => isAmount(x[k]));
  const isDate = (v) => isStr(v) && !Number.isNaN(new Date(v).getTime());
  // Ids link records together. A missing one is repaired, and counted.
  const idOf = (x, prefix = '') => (isStr(x.id) && x.id ? x.id : (problem(), `${prefix}${uid()}`));
  // A text field the app always writes as text. Anything else is repaired to the fallback, and counted.
  const text = (v, fallback) => (isStr(v) ? v : (problem(), fallback));

  const base = defaultData();

  // Settings: keep what's valid, count what isn't.
  const settings = { ...base.settings };
  if (d.settings !== undefined) {
    if (!isObj(d.settings)) problem();
    else {
      const valid = {
        unit: (v) => v === 'kg' || v === 'lb',
        restSeconds: (v) => Number.isInteger(v) && v >= 0 && v <= 3600,
        restSound: (v) => typeof v === 'boolean',
        keepAwake: (v) => typeof v === 'boolean',
        calorieTarget: (v) => v === null || (typeof v === 'number' && v > 0),
        proteinTarget: (v) => v === null || (typeof v === 'number' && v > 0),
      };
      Object.keys(d.settings).forEach((k) => {
        if (!valid[k]) return; // not a setting this version uses
        if (valid[k](d.settings[k])) settings[k] = d.settings[k];
        else problem();
      });
    }
  }

  // Program. Names may be empty: that's a box the user hasn't filled in yet.
  const programList = list(d.program);
  const program = keep(programList, isObj)
    .map((w) => ({
      id: idOf(w),
      name: text(w.name, 'Workout'),
      exercises: keep(list(w.exercises), (e) => isObj(e) && isStr(e.name))
        .map((e) => ({
          id: idOf(e),
          name: e.name,
          sets: Number.isInteger(e.sets) && e.sets >= 1 && e.sets <= 10 ? e.sets : (problem(), clampSets(e.sets)),
          reps: text(e.reps, ''),
        })),
    }));
  if (!program.length && Array.isArray(d.program)) problem(); // an empty program is replaced by the starter one

  // Finished workouts. A set's weight is a number, or null for bodyweight; missing means damaged.
  const isSet = (x) => isObj(x) && isAmount(x.r) && num(x.r) > 0 && (x.w === null || isAmount(x.w));
  const sessions = keep(list(d.sessions), (s) => isObj(s) && isDate(s.finishedAt) && Array.isArray(s.entries))
    .map((s) => ({
      ...s,
      id: idOf(s),
      startedAt: isDate(s.startedAt) ? s.startedAt : (problem(), s.finishedAt),
      label: text(s.label, 'A'),
      name: text(s.name, ''),
      entries: keep(s.entries, (e) => isObj(e) && isStr(e.name))
        .map((e) => ({
          ...e,
          key: isStr(e.key) && e.key ? e.key : (problem(), keyOf(e.name)),
          sets: keep(list(e.sets), isSet).map((x) => ({ w: x.w === null ? null : num(x.w), r: num(x.r) })),
        })),
    }))
    .sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));

  // The workout in progress. Its set values are text while typing, and done is true/false.
  let active = null;
  if (d.active != null) {
    const a = d.active;
    if (isObj(a) && Array.isArray(a.entries) && isDate(a.startedAt)) {
      const isField = (v) => isStr(v) || (typeof v === 'number' && Number.isFinite(v));
      active = {
        ...a,
        id: idOf(a),
        label: text(a.label, 'A'),
        name: text(a.name, ''),
        entries: keep(a.entries, (e) => isObj(e) && isStr(e.name) && Array.isArray(e.sets))
          .map((e) => ({
            ...e,
            id: idOf(e),
            key: isStr(e.key) && e.key ? e.key : (problem(), keyOf(e.name)),
            sets: keep(e.sets, (x) => isObj(x) && typeof x.done === 'boolean' && isField(x.w) && isField(x.r))
              .map((x) => ({ w: String(x.w), r: String(x.r), done: x.done })),
          })),
      };
    } else problem();
  }

  // Added in data version 2: required from version 2 on, legitimately absent in version 1.
  const bodyweights = keep(list(d.bodyweights, 2), (b) => isObj(b) && isDay(b.date) && num(b.w) > 0)
    .map((b) => ({ id: idOf(b), date: b.date, w: num(b.w) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const foods = keep(list(d.foods, 2), (x) => isObj(x) && isStr(x.name) && x.name && isNutrition(x))
    .map((x) => ({
      id: idOf(x, 'c-'), name: x.name, serving: text(x.serving, '1 serving'),
      kcal: num(x.kcal), p: num(x.p), c: num(x.c), f: num(x.f), custom: true,
    }));
  const foodLog = keep(list(d.foodLog, 2), (x) => isObj(x) && isDay(x.date) && isStr(x.name) && x.name && isNutrition(x) && num(x.qty) > 0)
    .map((x) => ({
      id: idOf(x), date: x.date,
      foodId: x.foodId === null || x.foodId === undefined ? null : (isStr(x.foodId) ? x.foodId : (problem(), null)),
      name: x.name, serving: text(x.serving, ''), qty: num(x.qty),
      kcal: num(x.kcal), p: num(x.p), c: num(x.c), f: num(x.f),
    }));

  let lastBackupAt = null;
  if (d.lastBackupAt != null) {
    if (isDate(d.lastBackupAt)) lastBackupAt = d.lastBackupAt;
    else problem();
  }

  return {
    version: DATA_VERSION,
    settings,
    program: program.length ? program : base.program,
    sessions,
    active,
    bodyweights,
    foods,
    foodLog,
    lastBackupAt,
    installTipDismissed: d.installTipDismissed === true,
  };
}

function clampSets(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 3;
}

/* ------------------------------------------------------------------ */
/* Loading, saving, and protecting saved data                          */
/* ------------------------------------------------------------------ */

let startupNotice = '';
const NOTE_KEY = 'gymlog.note'; // sessionStorage: a message to show after a reload

// Recovery mode: set when saved data exists but can't be used safely AND we couldn't
// keep a copy of it. While it is set, save() refuses to write, so nothing is overwritten.
// { reason: 'unreadable' | 'newer' | 'skipped' | 'read-failed', raw: the untouched saved text }
// For 'read-failed' the browser wouldn't hand over the saved data at all, so raw is null.
let recovery = null;

// Safety copies live next to the main data as gymlog.v1.<reason>.<timestamp>.
// The app never deletes them on its own; the owner can download or delete them in Backup.
const SAFETY_PREFIX = `${STORAGE_KEY}.`;
function keepSafetyCopy(reason, raw) {
  try {
    localStorage.setItem(`${SAFETY_PREFIX}${reason}.${Date.now()}`, raw);
    return true;
  } catch (_) {
    return false;
  }
}
function listSafetyCopies() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const m = k && k.startsWith(SAFETY_PREFIX) && k.slice(SAFETY_PREFIX.length).match(/^([a-z-]+)\.(\d+)$/);
      if (m) out.push({ key: k, reason: m[1], at: Number(m[2]) });
    }
  } catch (_) { /* storage blocked */ }
  return out.sort((a, b) => b.at - a.at);
}

function load() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    // We can't see what is saved, so we can't know it's safe to write. Pause saving until a reload can read it.
    recovery = { reason: 'read-failed', raw: null };
    return defaultData();
  }
  if (!raw) return defaultData();

  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (_) { parsed = undefined; }

  const report = { dropped: 0 };
  let data = null;
  let problem = parsed === undefined ? 'unreadable' : null;
  if (!problem) {
    try {
      data = migrate(parsed, report);
    } catch (e) {
      problem = e.code === 'newer' ? 'newer' : 'unreadable';
    }
  }

  if (problem === 'newer') {
    // A newer app version wrote this. Never downgrade it: block saving and ask for a reload.
    recovery = { reason: 'newer', raw };
    return defaultData();
  }
  if (problem === 'unreadable') {
    if (keepSafetyCopy('unreadable', raw)) {
      startupNotice = 'Saved data could not be read, so an untouched copy was kept. Download it from More > Backup and settings, or restore your latest backup there.';
      return defaultData();
    }
    recovery = { reason: 'unreadable', raw };
    return defaultData();
  }
  if (report.dropped > 0) {
    // Most of it loaded, but some records couldn't be read. Keep the original before anything is saved over it.
    if (!keepSafetyCopy('skipped', raw)) {
      recovery = { reason: 'skipped', raw, partial: data, dropped: report.dropped };
      return defaultData();
    }
    startupNotice = `${report.dropped} problem${report.dropped === 1 ? ' was' : 's were'} found in your saved data, so damaged records were left out or repaired. An untouched copy of everything was kept in More > Backup and settings.`;
  }
  return data;
}

// Returns true only if the data really reached storage.
// True while this window shows changes that storage refused (only typing can leave these).
let unsaved = false;

function save() {
  if (recovery) {
    unsaved = true;
    toast('Not saved: your earlier data needs recovering first. See the notice on the Today tab.');
    return false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    unsaved = false;
    return true;
  } catch (e) {
    unsaved = true;
    toast('Could not save. Phone storage may be full. Download a backup from More > Backup and settings now.');
    return false;
  }
}

// How a tap changes saved data: snapshot, change, save, and undo the change if storage
// refuses (or if the change backs out by returning false). Returns true only when saved.
// Callers show success only after this returns true.
// (Typing into a box is the one exception: the typed text stays on screen if a save fails,
// and the failure toast says so. Undoing keystrokes would fight the user.)
function commit(change) {
  const before = JSON.stringify(db);
  let ok = false;
  try {
    ok = change() !== false;
  } catch (e) {
    db = JSON.parse(before);
    throw e;
  }
  if (ok && save()) return true;
  db = JSON.parse(before);
  return false;
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

let db = load();
try {
  const note = sessionStorage.getItem(NOTE_KEY);
  if (note) {
    sessionStorage.removeItem(NOTE_KEY);
    startupNotice = startupNotice ? `${note} ${startupNotice}` : note;
  }
} catch (_) { /* sessionStorage blocked */ }
let tab = 'today';
let historyMode = 'sessions';
let bodyMode = 'weight';
let moreMode = 'program';
let foodDate = localDate();
let libQ = '';
let libCat = 'All';
let sheet = null; // the open bottom sheet: { kind, ...context }
let deferredInstall = null;

function getFood(id) {
  return db.foods.find((f) => f.id === id) || FOOD_BY_ID.get(id) || null;
}

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

// Heaviest set ever (ties broken by more reps).
function bestFor(key) {
  let best = null;
  db.sessions.forEach((s) => s.entries.forEach((e) => {
    if (e.key !== key) return;
    e.sets.forEach((x) => {
      if (!best || (x.w ?? 0) > (best.w ?? 0) || ((x.w ?? 0) === (best.w ?? 0) && x.r > best.r)) best = x;
    });
  }));
  return best;
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

// A typed weight is fine when empty (bodyweight) or a number of zero or more.
// (toNum('abc') is null, and null >= 0 is true in JavaScript, hence the explicit check.)
function validWeight(w) {
  if (w === '' || w == null) return true;
  const n = toNum(w);
  return n !== null && n >= 0;
}

function newSet() {
  return { w: '', r: '', done: false };
}

function newEntry(name, sets, reps) {
  return {
    id: uid(), key: keyOf(name), name, targetSets: sets, targetReps: reps,
    sets: Array.from({ length: clampSets(sets) }, newSet),
  };
}

function startWorkout(index) {
  const w = db.program[index];
  if (!w) return;
  const ok = commit(() => {
    db.active = {
      id: uid(),
      workoutId: w.id,
      label: letter(index),
      name: w.name,
      startedAt: new Date().toISOString(),
      entries: w.exercises.map((e) => newEntry(e.name, e.sets, e.reps)),
    };
  });
  render();
  if (!ok) return;
  window.scrollTo(0, 0);
  keepAwake();
}

function findEntry(entryId) {
  return db.active ? db.active.entries.find((e) => e.id === entryId) : null;
}

function toggleSet(entryId, i) {
  let needReps = false;
  let badWeight = false;
  let ticked = null;
  const ok = commit(() => {
    const entry = findEntry(entryId);
    if (!entry || !entry.sets[i]) return false;
    const set = entry.sets[i];
    if (set.done) { set.done = false; return true; }
    const sug = suggestion(entry, i, lastFor(entry.key));
    if (set.w === '') set.w = sug.w;
    if (set.r === '') set.r = sug.r;
    if (!(toNum(set.r) > 0)) { needReps = true; return false; }
    if (!validWeight(set.w)) { badWeight = true; return false; }
    set.done = true;
    ticked = entry.name;
    return true;
  });
  render();
  if (needReps || badWeight) {
    toast(needReps ? 'Enter the reps you did, then tick the set.' : 'That weight isn\'t a number. Fix it, or leave it empty for bodyweight.');
    const input = document.querySelector(`input[data-entry="${entryId}"][data-set="${i}"][data-field="${needReps ? 'r' : 'w'}"]`);
    if (input) input.focus();
  }
  if (ok && ticked) startRest(ticked);
}

// Swap an exercise mid-workout (machine taken, etc.). Call inside commit().
// No sets ticked yet: replace it. Some ticked: keep those and add the new one right after.
// Returns the message to show once saved, or false if nothing should change.
function swapEntry(entryId, newName) {
  const a = db.active;
  const i = a.entries.findIndex((e) => e.id === entryId);
  if (i === -1) return false;
  const e = a.entries[i];
  if (keyOf(e.name) === keyOf(newName)) return false;
  const typed = e.sets.filter((s) => !s.done && (s.w !== '' || s.r !== '')).length;
  if (typed && !confirm(`${typed} unticked ${e.name} set${typed === 1 ? ' has' : 's have'} numbers typed in. Swapping clears ${typed === 1 ? 'it' : 'them'}. Your ticked sets stay. Swap anyway?`)) return false;
  const doneCount = e.sets.filter((s) => s.done).length;
  if (!doneCount) {
    e.name = newName;
    e.key = keyOf(newName);
    e.sets = e.sets.map(newSet);
    return `Swapped to ${newName}.`;
  }
  const left = Math.max(1, e.sets.length - doneCount);
  e.sets = e.sets.filter((s) => s.done);
  a.entries.splice(i + 1, 0, newEntry(newName, left, e.targetReps));
  return `Added ${newName}. Your ticked ${e.name} sets stay.`;
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
  // A ticked set can still be edited, so check its weight again before saving it for good.
  const badEntry = a.entries.find((e) => e.sets.some((x) => x.done && !validWeight(x.w)));
  if (badEntry) {
    toast(`A ticked ${badEntry.name} set has a weight that isn't a number. Fix it, or leave it empty for bodyweight.`);
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
  if (!save()) {
    // Storage refused the write: put everything back so the workout stays open and nothing is lost.
    db.sessions.pop();
    db.active = a;
    render();
    return;
  }
  stopRest();
  releaseWake();
  render();
  window.scrollTo(0, 0);
  toast('Workout saved.');
}

function discardWorkout(skipConfirm) {
  if (!skipConfirm && !confirm('Discard this workout? None of its sets will be saved.')) return;
  if (!commit(() => { db.active = null; })) { render(); return; }
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
  $('.t', el).textContent = `${Math.floor(left / 60)}:${pad2(left % 60)}`;
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
/* Body weight                                                         */
/* ------------------------------------------------------------------ */

function avgWeight(from, to) {
  const xs = db.bodyweights.filter((b) => b.date >= from && b.date <= to).map((b) => b.w);
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function saveWeight() {
  const w = toNum($('#bw-w').value);
  const date = $('#bw-date').value || localDate();
  if (!(w > 0 && w < 500)) { toast('Enter your weight first.'); $('#bw-w').focus(); return; }
  if (!isDay(date) || date > localDate()) { toast('Pick today or an earlier date.'); return; }
  const before = db.bodyweights.map((b) => ({ ...b }));
  const existing = db.bodyweights.find((b) => b.date === date);
  if (existing) existing.w = w;
  else db.bodyweights.push({ id: uid(), date, w });
  db.bodyweights.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (!save()) { db.bodyweights = before; return; }
  render();
  toast(existing ? `Updated ${dayLabel(date).toLowerCase()}'s weight.` : 'Weight saved.');
}

/* ------------------------------------------------------------------ */
/* Food                                                                */
/* ------------------------------------------------------------------ */

function dayTotals(date) {
  return db.foodLog
    .filter((x) => x.date === date)
    .reduce((t, x) => ({ kcal: t.kcal + x.kcal * x.qty, p: t.p + x.p * x.qty, c: t.c + x.c * x.qty, f: t.f + x.f * x.qty }),
      { kcal: 0, p: 0, c: 0, f: 0 });
}

function recentFoods() {
  const seen = new Set();
  const out = [];
  for (let i = db.foodLog.length - 1; i >= 0 && out.length < 8; i--) {
    const id = db.foodLog[i].foodId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const f = getFood(id);
    if (f) out.push(f);
  }
  return out;
}

function logFood(foodId, date, qty) {
  const f = getFood(foodId);
  if (!f || !(qty > 0)) return;
  // Copy the numbers so later edits to a food never change past days.
  db.foodLog.push({ id: uid(), date, foodId: f.id, name: f.name, serving: f.serving, qty, kcal: f.kcal, p: f.p, c: f.c, f: f.f });
  if (!save()) { db.foodLog.pop(); return false; }
  return true;
}

/* ------------------------------------------------------------------ */
/* Backup                                                              */
/* ------------------------------------------------------------------ */

function backupFile() {
  const stamp = localDate();
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
  const before = db.lastBackupAt;
  db.lastBackupAt = new Date().toISOString();
  if (!save()) { db.lastBackupAt = before; return; }
  render();
  toast(msg);
}

// Starting a download doesn't prove the file landed on the phone, so ask before
// counting it as a backup (the overdue-backup reminder depends on this date).
function confirmDownloaded(file) {
  setTimeout(() => {
    if (confirm(`Check your Downloads for ${file.name}. Is it there?`)) markBackedUp('Backup recorded.');
    else toast("Not counted as a backup. Try 'Send backup to Drive or a chat' instead.");
  }, 1200);
}

const canShareFiles = () => {
  try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })); }
  catch (_) { return false; }
};

function exportBackup(mode) {
  const file = backupFile();
  if (mode === 'share' && canShareFiles()) {
    // share() only resolves after the user picked where it went, so that counts as done.
    navigator.share({ files: [file], title: 'Gym Log backup' })
      .then(() => markBackedUp('Backup sent.'))
      .catch((err) => { if (err && err.name !== 'AbortError') { downloadFile(file); confirmDownloaded(file); } });
    return;
  }
  downloadFile(file);
  confirmDownloaded(file);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onerror = () => toast("Couldn't read that file. Nothing was changed.");
  reader.onload = () => {
    let data;
    const report = { dropped: 0 };
    try {
      data = migrate(JSON.parse(reader.result), report);
    } catch (e) {
      toast(e && e.code === 'newer'
        ? 'That backup is from a newer version of the app. Reload the app to update it, then try again. Nothing was changed.'
        : "That file isn't a Gym Log backup. Nothing was changed.");
      return;
    }
    if (recovery && recovery.reason === 'read-failed') {
      toast("Your saved data can't be read right now, so restoring is paused to avoid writing over it. Reload the app first.");
      return;
    }
    if (report.dropped > 0 && !confirm(`This backup has ${report.dropped} problem${report.dropped === 1 ? '' : 's'}: damaged records would be left out or repaired. Import it anyway?`)) return;
    const n = data.sessions.length;
    if (!confirm(`Replace everything on this phone with this backup? It has ${n} workout${n === 1 ? '' : 's'}, ${data.bodyweights.length} weigh-in${data.bodyweights.length === 1 ? '' : 's'} and ${data.foodLog.length} food entr${data.foodLog.length === 1 ? 'y' : 'ies'}.`)) return;

    // Keep an untouched copy of what is being replaced. No copy, no import.
    let current = null;
    if (recovery) current = recovery.raw;
    else {
      try { current = localStorage.getItem(STORAGE_KEY); } catch (_) { current = null; }
    }
    if (current && !keepSafetyCopy('before-import', current)) {
      toast("Couldn't keep a safety copy of your current data, so nothing was imported. Download a backup and free up space first.");
      return;
    }

    const previous = db;
    const previousRecovery = recovery;
    db = data;
    recovery = null; // the old data is now safely copied, so saving may resume
    if (!save()) {
      db = previous;
      recovery = previousRecovery;
      render();
      return;
    }
    stopRest();
    startupNotice = '';
    render();
    toast('Backup restored. Your previous data was kept as a safety copy.');
  };
  reader.readAsText(file);
}

function downloadText(name, text) {
  downloadFile(new File([text], name, { type: 'application/json' }));
}

/* ------------------------------------------------------------------ */
/* Shared view pieces                                                  */
/* ------------------------------------------------------------------ */

const isStandalone = () =>
  (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

function segHtml(action, current, options, label) {
  return `<div class="seg" role="group" aria-label="${esc(label)}">${options
    .map(([value, text]) => `<button type="button" data-action="${action}" data-mode="${value}" aria-pressed="${current === value}">${esc(text)}</button>`)
    .join('')}</div>`;
}

function chipsHtml(current, action) {
  return `<div class="chips" role="group" aria-label="Muscle group">${['All', ...CATS]
    .map((c) => `<button type="button" class="chip-btn" data-action="${action}" data-cat="${c}" aria-pressed="${c === current}">${c}</button>`)
    .join('')}</div>`;
}

function filterLib(q, cat) {
  const k = keyOf(q);
  return LIB.filter((e) => (cat === 'All' || e.cat === cat)
    && (!k || keyOf(e.name).includes(k) || keyOf(e.equip).includes(k) || keyOf(e.cat).includes(k)));
}

function libListHtml(list, action) {
  if (!list.length) return '<p class="muted small pad-y">No exercises match.</p>';
  return list.map((e) => `
    <button type="button" class="list-item" data-action="${action}" data-id="${e.id}">
      <span class="grow"><span class="li-title">${esc(e.name)}</span><span class="muted small">${esc(e.cat)}, ${esc(e.equip.toLowerCase())}</span></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`).join('');
}

function foodItemHtml(f) {
  return `
    <button type="button" class="list-item" data-action="food-pick" data-id="${esc(f.id)}">
      <span class="grow">
        <span class="li-title">${esc(f.name)}${f.custom ? ' <span class="tag">yours</span>' : ''}</span>
        <span class="muted small">${esc(f.serving)}: ${kcalText(f.kcal)} kcal, ${macro(f.p)} g protein</span>
      </span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
}

function recoveryHtml() {
  if (!recovery) return '';
  const download = '<button type="button" class="btn small primary" data-action="recovery-download">Download saved data</button>';
  const reload = '<button type="button" class="btn small" data-action="recovery-reload">Reload app</button>';
  if (recovery.reason === 'read-failed') {
    return `
      <div class="notice warn">
        <p><strong>Saving is paused.</strong><br><span class="small">The browser wouldn't let the app read your saved data, so it can't tell what's there. Nothing will be saved until it can, so your data can't be overwritten. Reload to try again. If this keeps happening, the browser is blocking site storage (for example a private tab, or site data turned off).</span></p>
        <div class="row wrap">${reload}</div>
      </div>`;
  }
  if (recovery.reason === 'newer') {
    return `
      <div class="notice warn">
        <p><strong>Saving is paused.</strong><br><span class="small">Your data was saved by a newer version of this app. Reload to get that version. Until then nothing is saved, so your data can't be overwritten.</span></p>
        <div class="row wrap">${download}${reload}</div>
      </div>`;
  }
  const what = recovery.reason === 'skipped'
    ? `${recovery.dropped} problem${recovery.dropped === 1 ? ' was' : 's were'} found in your saved data`
    : "Your saved data couldn't be read";
  const next = recovery.reason === 'skipped'
    ? '<button type="button" class="btn small" data-action="recovery-keep">Keep what loaded</button>'
    : '<button type="button" class="btn small" data-action="recovery-fresh">Start fresh</button>';
  return `
    <div class="notice warn">
      <p><strong>Saving is paused.</strong><br><span class="small">${what}, and there's no room on the phone to keep a safety copy. Nothing will be saved until you choose, so your data can't be overwritten. Download it first, then restore a backup from More > Backup and settings, or continue below.</span></p>
      <div class="row wrap">${download}${next}</div>
    </div>`;
}

// Data-safety warnings. Shown on Today whether or not a workout is in progress.
function warningsHtml() {
  return recoveryHtml() + (startupNotice ? `<div class="notice warn">${esc(startupNotice)}</div>` : '');
}

function noticesHtml() {
  const out = [warningsHtml()];

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

  const total = db.sessions.length + db.foodLog.length + db.bodyweights.length;
  if (total >= 5 && daysSince(db.lastBackupAt) > 14) {
    const when = db.lastBackupAt ? `Last backup ${ago(db.lastBackupAt)}.` : 'You have never backed up.';
    out.push(`
      <div class="notice warn">
        <p><strong>Your logs exist only on this phone.</strong><br><span class="muted small">${when} Clearing browser data would erase them.</span></p>
        <button type="button" class="btn small primary" data-action="export">Back up now</button>
      </div>`);
  }
  return out.join('');
}

/* ------------------------------------------------------------------ */
/* Views: Today and the workout                                        */
/* ------------------------------------------------------------------ */

function viewToday() {
  if (!db.program.length) {
    return `${noticesHtml()}
      <div class="empty"><strong>No workouts in your program.</strong>Add one in More > Program to start logging.</div>
      <button type="button" class="btn block" data-goto="more" data-mode="program">Open Program</button>`;
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
    const lib = libFor(entry.name);
    const where = last && last.workoutId !== a.workoutId && last.label ? `, in ${esc(last.label)}` : '';
    const lastHtml = last
      ? `<div class="last"><span class="when">Last time (${ago(last.at)}${where})</span>${last.sets.map((s) => `<span class="chip">${setText(s)}</span>`).join('')}</div>`
      : '<div class="last"><span class="when">First time logging this one.</span></div>';
    const hint = readyToAddWeight(entry, last) ? '<p class="hint">You hit every rep last time. Add weight today.</p>' : '';
    const title = lib
      ? `<button type="button" class="title-btn" data-action="lib-open" data-id="${lib.id}">${esc(entry.name)} <span class="info" aria-label="How to do it">ⓘ</span></button>`
      : `<h3>${esc(entry.name)}</h3>`;

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
          ${title}
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
          <button type="button" class="btn small ghost" data-action="remove-set" data-entry="${entry.id}" ${entry.sets.length <= 1 ? 'disabled' : ''}>Remove set</button>
          <span class="grow"></span>
          <button type="button" class="btn small ghost" data-action="swap" data-entry="${entry.id}">Swap</button>
        </div>
      </section>`;
  }).join('');

  const done = a.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const total = a.entries.reduce((n, e) => n + e.sets.length, 0);

  return `${warningsHtml()}
    <div class="wo-head" style="${style}">
      <span class="disc" aria-hidden="true">${esc(a.label)}</span>
      <div class="grow">
        <h2>${esc(a.name)}</h2>
        <p class="muted small" style="margin:0">Started ${timeLabel(a.startedAt)}. <span class="num">${done} of ${total}</span> sets done.</p>
      </div>
      <div class="clock" aria-label="Workout time"><span class="num" id="wo-clock">${clockText(a.startedAt)}</span></div>
    </div>
    ${cards || '<div class="empty"><strong>This workout has no exercises.</strong>Add one below.</div>'}
    <button type="button" class="btn block ghost" style="margin-top:12px" data-action="pick-open" data-purpose="workout-add">Add an exercise</button>
    <div class="finish-bar">
      <button type="button" class="btn primary block" data-action="finish">Finish and save workout</button>
      <button type="button" class="btn danger block" data-action="discard">Discard workout</button>
    </div>`;
}

/* ------------------------------------------------------------------ */
/* Views: Exercises                                                    */
/* ------------------------------------------------------------------ */

function viewExercises() {
  return `
    <input type="search" class="search" id="lib-q" placeholder="Search, e.g. squat or cable" value="${esc(libQ)}" aria-label="Search exercises" autocomplete="off">
    ${chipsHtml(libCat, 'lib-cat')}
    <div id="lib-list" class="list">${libListHtml(filterLib(libQ, libCat), 'lib-open')}</div>
    <p class="muted small" style="margin-top:14px">${LIB.length} exercises built around your gym's equipment. Tap one for form cues, alternatives and your numbers.</p>`;
}

/* ------------------------------------------------------------------ */
/* Views: Body (weight and food)                                       */
/* ------------------------------------------------------------------ */

function weightChart() {
  const list = db.bodyweights;
  const from = addDays(localDate(), -59);
  const pts = list.filter((b) => b.date >= from);
  if (pts.length < 2) return '';
  const W = 320; const H = 130; const L = 34; const R = 8; const T = 10; const B = 14;
  const dayIndex = (s) => Math.round((parseDay(s) - parseDay(pts[0].date)) / 86400000);
  const span = Math.max(1, dayIndex(pts[pts.length - 1].date));
  let lo = Math.min(...pts.map((p) => p.w));
  let hi = Math.max(...pts.map((p) => p.w));
  if (hi - lo < 1) { const mid = (hi + lo) / 2; lo = mid - 0.5; hi = mid + 0.5; }
  const x = (s) => L + (dayIndex(s) / span) * (W - L - R);
  const y = (w) => Math.min(H - B, Math.max(T, T + ((hi - w) / (hi - lo)) * (H - T - B)));
  const avgLine = pts.map((p) => {
    const xs = list.filter((b) => b.date >= addDays(p.date, -6) && b.date <= p.date).map((b) => b.w);
    return `${x(p.date).toFixed(1)},${y(xs.reduce((s, v) => s + v, 0) / xs.length).toFixed(1)}`;
  }).join(' ');
  return `
    <figure class="card chart-card">
      <svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Body weight over the last 60 days">
        <line x1="${L}" x2="${W - R}" y1="${y(hi)}" y2="${y(hi)}" class="grid"/>
        <line x1="${L}" x2="${W - R}" y1="${y(lo)}" y2="${y(lo)}" class="grid"/>
        <text x="0" y="${y(hi) + 4}" class="ax">${r1(hi).toFixed(1)}</text>
        <text x="0" y="${y(lo) + 4}" class="ax">${r1(lo).toFixed(1)}</text>
        ${pts.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="2.6" class="dot"/>`).join('')}
        <polyline points="${avgLine}" class="avg"/>
      </svg>
      <figcaption class="muted small">Dots are daily weigh-ins. The line is your 7-day average.</figcaption>
    </figure>`;
}

function viewWeight() {
  const unit = esc(db.settings.unit);
  const today = localDate();
  const list = db.bodyweights;
  const latest = list[list.length - 1];
  const thisWeek = avgWeight(addDays(today, -6), today);
  const prevWeek = avgWeight(addDays(today, -13), addDays(today, -7));

  let stats = '';
  if (thisWeek != null) {
    const diff = prevWeek != null ? thisWeek - prevWeek : null;
    const change = diff != null
      ? `${diff >= 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)} ${unit} compared with the 7 days before.`
      : 'Keep weighing in. Your weekly change shows after two weeks.';
    stats = `
      <section class="card">
        <p class="muted small" style="margin:0">Average over the last 7 days</p>
        <p class="big num" style="margin:2px 0 4px">${thisWeek.toFixed(1)} <span class="unit">${unit}</span></p>
        <p class="small" style="margin:0">${change}</p>
      </section>`;
  } else if (latest) {
    stats = `<section class="card"><p class="small" style="margin:0">Last weigh-in: <strong class="num">${fmt(latest.w)} ${unit}</strong> on ${esc(dayLabel(latest.date))}.</p></section>`;
  }

  const rows = [...list].reverse().map((b) => `
    <div class="row-item">
      <span class="grow">${esc(dayLabel(b.date))}</span>
      <strong class="num">${fmt(b.w)} ${unit}</strong>
      <button type="button" class="icon-btn" data-action="bw-delete" data-id="${b.id}" aria-label="Delete ${esc(dayLabel(b.date))} weigh-in">✕</button>
    </div>`).join('');

  return `
    <section class="card">
      <div class="two-col">
        <label class="field"><span>Weight (${unit})</span>
          <input type="text" inputmode="decimal" id="bw-w" autocomplete="off" placeholder="${latest ? fmt(latest.w) : ''}"></label>
        <label class="field"><span>Date</span>
          <input type="date" id="bw-date" value="${today}" max="${today}"></label>
      </div>
      <button type="button" class="btn primary block" style="margin-top:10px" data-action="bw-save">Save weight</button>
      <p class="muted small" style="margin:10px 0 0">Weigh in each morning after the toilet, before eating. Daily numbers swing with water and food, so watch the 7-day average.</p>
    </section>
    <div class="stack" style="margin-top:12px">
      ${stats}
      ${weightChart()}
      ${rows ? `<section class="card"><h3 class="sub">All weigh-ins</h3>${rows}</section>` : ''}
    </div>`;
}

function viewFood() {
  const d = foodDate;
  const today = localDate();
  const s = db.settings;
  const entries = db.foodLog.filter((x) => x.date === d);
  const t = dayTotals(d);
  const bar = (v, target) => (target
    ? `<div class="bar${v > target ? ' over' : ''}" role="presentation"><span style="width:${Math.min(100, (v / target) * 100).toFixed(1)}%"></span></div>`
    : '');

  const rows = entries.map((x) => `
    <div class="row-item">
      <span class="grow">
        <span class="li-title">${esc(x.name)}</span>
        <span class="muted small">${fmt(x.qty)} × ${esc(x.serving)}</span>
      </span>
      <span class="right">
        <span class="num li-title">${kcalText(x.kcal * x.qty)} kcal</span>
        <span class="muted small num">${macro(x.p * x.qty)} g protein</span>
      </span>
      <button type="button" class="icon-btn" data-action="food-remove" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">✕</button>
    </div>`).join('');

  return `
    <div class="daynav">
      <button type="button" class="icon-btn" data-action="food-day" data-d="-1" aria-label="Previous day">‹</button>
      <strong>${esc(dayLabel(d))}</strong>
      <button type="button" class="icon-btn" data-action="food-day" data-d="1" aria-label="Next day" ${d >= today ? 'disabled' : ''}>›</button>
    </div>
    <section class="card">
      <div class="tot-row"><span><span class="big num">${kcalText(t.kcal)}</span> kcal</span><span class="muted small num">${s.calorieTarget ? `target ${kcalText(s.calorieTarget)}` : ''}</span></div>
      ${bar(t.kcal, s.calorieTarget)}
      <div class="tot-row" style="margin-top:12px"><span><strong class="num">${macro(t.p)} g</strong> protein</span><span class="muted small num">${s.proteinTarget ? `target ${s.proteinTarget} g` : ''}</span></div>
      ${bar(t.p, s.proteinTarget)}
      <p class="muted small" style="margin:12px 0 0">Carbs <span class="num">${macro(t.c)} g</span>, fat <span class="num">${macro(t.f)} g</span></p>
      <button type="button" class="btn small ghost" style="margin-top:10px" data-action="targets">${s.calorieTarget || s.proteinTarget ? 'Change daily targets' : 'Set daily targets'}</button>
    </section>
    <button type="button" class="btn primary block" style="margin:14px 0" data-action="food-open">Add food</button>
    ${rows
    ? `<section class="card">${rows}</section>`
    : `<div class="empty"><strong>Nothing logged ${d === today ? 'today' : 'for this day'}.</strong>Add everything you eat and drink, or the totals will be too low to trust.</div>`}
    <p class="muted small" style="margin-top:14px">Built-in values are typical averages. For packaged food, the label is more accurate: add it as your own food.</p>`;
}

function viewBody() {
  return segHtml('body-mode', bodyMode, [['weight', 'Weight'], ['food', 'Food']], 'Body section')
    + (bodyMode === 'weight' ? viewWeight() : viewFood());
}

/* ------------------------------------------------------------------ */
/* Views: History                                                      */
/* ------------------------------------------------------------------ */

function sessionPlate(s) {
  const pi = programIndex(s.workoutId);
  return plateStyle(pi === -1 ? (s.label || 'A').charCodeAt(0) - 65 : pi);
}

function viewHistory() {
  const seg = segHtml('history-mode', historyMode, [['sessions', 'Workouts'], ['exercises', 'Exercises']], 'History view');

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
      if (!map.has(e.key)) map.set(e.key, { key: e.key, name: e.name, records: [] });
      const rec = map.get(e.key);
      rec.name = e.name;
      rec.records.push({ at: s.finishedAt, sets: e.sets });
    });
  });
  const list = [...map.values()].sort((a, b) => new Date(b.records[b.records.length - 1].at) - new Date(a.records[a.records.length - 1].at));
  const items = list.map((ex) => {
    const best = bestFor(ex.key);
    const latest = ex.records[ex.records.length - 1];
    return `
      <details class="card">
        <summary>
          <h3>${esc(ex.name)}</h3>
          <p class="muted small" style="margin:2px 0 0">Last ${ago(latest.at)}: <span class="num">${latest.sets.map(setText).join(', ')}</span></p>
          <p class="small" style="margin:2px 0 0">Best set: <strong class="num">${setText(best)}</strong></p>
        </summary>
        <ul class="sess-lines">
          ${[...ex.records].reverse().map((r) => `<li><div class="muted small">${dateLabel(r.at)}</div><div class="sets-line">${r.sets.map(setText).join(', ')}</div></li>`).join('')}
        </ul>
      </details>`;
  }).join('');
  return `${seg}<div class="stack">${items}</div>`;
}

/* ------------------------------------------------------------------ */
/* Views: More (program, backup, settings)                             */
/* ------------------------------------------------------------------ */

function viewProgram() {
  const order = db.program.map((_, i) => letter(i)).join(', then ');
  const workouts = db.program.map((w, wi) => `
    <section class="card" style="${plateStyle(wi)}">
      <div class="row" style="margin-bottom:6px">
        <span class="disc" aria-hidden="true">${letter(wi)}</span>
        <label class="field grow"><span>Workout ${letter(wi)} name</span>
          <input type="text" data-prog="wname" data-w="${w.id}" value="${esc(w.name)}"></label>
      </div>
      ${w.exercises.map((e, ei) => {
    const lib = libFor(e.name);
    return `
        <div class="prog-ex">
          <input type="text" class="name" data-prog="ename" data-w="${w.id}" data-e="${e.id}" value="${esc(e.name)}" placeholder="Exercise name" aria-label="Exercise name">
          <input type="text" class="n" inputmode="numeric" data-prog="esets" data-w="${w.id}" data-e="${e.id}" value="${e.sets}" aria-label="${esc(e.name)} sets">
          <span class="x" aria-hidden="true">×</span>
          <input type="text" class="n" data-prog="ereps" data-w="${w.id}" data-e="${e.id}" value="${esc(e.reps)}" placeholder="8-12" aria-label="${esc(e.name)} reps">
          <span class="muted small" aria-hidden="true">reps</span>
          <div class="tools">
            ${lib ? `<button type="button" class="icon-btn" data-action="lib-open" data-id="${lib.id}" aria-label="How to do ${esc(e.name)}">ⓘ</button>` : ''}
            <button type="button" class="icon-btn" data-action="move-ex" data-dir="-1" data-w="${w.id}" data-e="${e.id}" aria-label="Move ${esc(e.name)} up" ${ei === 0 ? 'disabled' : ''}>↑</button>
            <button type="button" class="icon-btn" data-action="move-ex" data-dir="1" data-w="${w.id}" data-e="${e.id}" aria-label="Move ${esc(e.name)} down" ${ei === w.exercises.length - 1 ? 'disabled' : ''}>↓</button>
            <button type="button" class="icon-btn" data-action="remove-ex" data-w="${w.id}" data-e="${e.id}" aria-label="Remove ${esc(e.name)}">✕</button>
          </div>
        </div>`;
  }).join('')}
      <div class="row" style="margin-top:10px">
        <button type="button" class="btn small" data-action="pick-open" data-purpose="program" data-w="${w.id}">Add exercise</button>
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
    .map((v) => `<option value="${v}" ${Number(s.restSeconds) === v ? 'selected' : ''}>${v ? `${Math.floor(v / 60)}:${pad2(v % 60)}` : 'Off'}</option>`)
    .join('');
  const last = db.lastBackupAt ? `Last backup: ${dateLabel(db.lastBackupAt)}.` : 'No backup yet.';

  return `
    <section class="card">
      <h3>Backup</h3>
      <p class="muted small" style="margin-top:4px">Your workouts, weigh-ins and food logs are stored only on this phone. Clearing browser data or losing the phone erases them unless you have a backup file. ${last}</p>
      <div class="stack">
        ${canShareFiles() ? '<button type="button" class="btn primary block" data-action="share">Send backup to Drive or a chat</button>' : ''}
        <button type="button" class="btn block ${canShareFiles() ? '' : 'primary'}" data-action="export">Download backup file</button>
        <label class="btn block ghost">Restore from a backup file
          <input type="file" accept="application/json,.json" data-import hidden></label>
      </div>
    </section>

    ${safetyCopiesHtml()}

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
        <label class="row check"><input type="checkbox" data-setting="restSound" ${s.restSound ? 'checked' : ''}> Beep when rest is over</label>
        <label class="row check"><input type="checkbox" data-setting="keepAwake" ${s.keepAwake ? 'checked' : ''}> Keep the screen on during a workout</label>
      </div>
    </section>

    <section class="card" style="margin-top:14px">
      <h3>Erase everything</h3>
      <p class="muted small" style="margin-top:4px">Deletes every workout, weigh-in and food log, and resets your program on this phone. Download a backup first.</p>
      <button type="button" class="btn danger block" data-action="erase">Erase all data</button>
    </section>
    <p class="muted small" style="text-align:center;margin-top:18px">Gym Log ${APP_VERSION}</p>`;
}

const COPY_LABELS = {
  'before-import': 'Before a restore',
  'other-window': 'This window, before another window saved',
  unreadable: "Data that couldn't be read",
  skipped: 'Before damaged records were left out or repaired',
};

function safetyCopiesHtml() {
  const copies = listSafetyCopies();
  if (!copies.length) return '';
  return `
    <section class="card" style="margin-top:14px">
      <h3>Safety copies</h3>
      <p class="muted small" style="margin-top:4px">Untouched copies the app kept before replacing or skipping data. They stay until you delete them.</p>
      ${copies.map((c) => `
        <div class="row-item">
          <span class="grow"><span class="li-title">${esc(COPY_LABELS[c.reason] || c.reason)}</span><span class="muted small">${esc(dateLabel(c.at))}, ${esc(timeLabel(c.at))}</span></span>
          <button type="button" class="btn small" data-action="copy-download" data-key="${esc(c.key)}">Download</button>
          <button type="button" class="icon-btn" data-action="copy-delete" data-key="${esc(c.key)}" aria-label="Delete this safety copy">✕</button>
        </div>`).join('')}
    </section>`;
}

function viewMore() {
  return segHtml('more-mode', moreMode, [['program', 'Program'], ['data', 'Backup and settings']], 'More section')
    + (moreMode === 'program' ? viewProgram() : viewData());
}

/* ------------------------------------------------------------------ */
/* Bottom sheets                                                       */
/* ------------------------------------------------------------------ */

function sheetHead(title, sub) {
  return `
    <div class="sheet-head">
      <div class="grow"><h2>${esc(title)}</h2>${sub ? `<p class="muted small" style="margin:2px 0 0">${esc(sub)}</p>` : ''}</div>
      <button type="button" class="icon-btn" data-action="sheet-close" aria-label="Close">✕</button>
    </div>`;
}

function sheetExercise(s) {
  const e = LIB_BY_ID.get(s.id);
  if (!e) return sheetHead('Exercise not found', '');
  const key = keyOf(e.name);
  const last = lastFor(key);
  const best = bestFor(key);
  const alts = altsOf(e);
  const video = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} proper form`)}`;
  return `
    ${sheetHead(e.name, `${e.cat}, ${e.equip.toLowerCase()}`)}
    <div class="sheet-in stack">
      <section>
        <h3 class="sub">How to do it right</h3>
        <ul class="cues">${e.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      </section>
      <a class="btn block" href="${video}" target="_blank" rel="noopener">Watch form videos on YouTube</a>
      <section>
        <h3 class="sub">Your numbers</h3>
        ${last
    ? `<p class="small" style="margin:0 0 4px">Last time (${ago(last.at)}): <strong class="num">${last.sets.map(setText).join(', ')}</strong></p>
           <p class="small" style="margin:0">Best set: <strong class="num">${setText(best)}</strong></p>`
    : '<p class="muted small" style="margin:0">Not logged yet.</p>'}
      </section>
      ${alts.length ? `<section><h3 class="sub">Alternatives</h3><div class="list">${libListHtml(alts, 'lib-open')}</div></section>` : ''}
      <section>
        <h3 class="sub">Add to a workout</h3>
        <div class="switch" style="margin:0">${db.program.map((w, i) => `
          <button type="button" class="btn small" data-action="lib-add" data-id="${e.id}" data-w="${w.id}" style="${plateStyle(i)}">
            <span class="disc" style="--size:24px">${letter(i)}</span>${esc(w.name)}
          </button>`).join('')}</div>
      </section>
    </div>`;
}

function pickListHtml(s) {
  const q = s.q.trim();
  const custom = q && !LIB_BY_KEY.has(keyOf(q))
    ? `<button type="button" class="btn block ghost" style="margin:8px 0" data-action="pick-custom">Add “${esc(q)}” as your own exercise</button>`
    : '';
  return custom + libListHtml(filterLib(s.q, s.cat), 'pick');
}

function sheetPick(s) {
  let title = 'Add an exercise';
  let sub = '';
  let top = '';
  if (s.purpose === 'program') {
    const w = workoutById(s.w);
    sub = w ? `To workout ${letter(programIndex(w.id))}, ${w.name}` : '';
  } else if (s.purpose === 'workout-add') {
    sub = 'To this workout';
  } else if (s.purpose === 'swap') {
    const entry = findEntry(s.entryId);
    title = `Swap ${entry ? entry.name : 'exercise'}`;
    const alts = entry ? altsOf(libFor(entry.name)) : [];
    if (alts.length) {
      top = `<h3 class="sub">Alternatives</h3><div class="list" style="margin-bottom:16px">${libListHtml(alts, 'pick')}</div><h3 class="sub">Or pick any exercise</h3>`;
    }
  }
  return `
    ${sheetHead(title, sub)}
    <div class="sheet-in">
      ${top}
      <input type="search" class="search" id="pick-q" placeholder="Search exercises" value="${esc(s.q)}" aria-label="Search exercises" autocomplete="off">
      ${chipsHtml(s.cat, 'pick-cat')}
      <div id="pick-list" class="list">${pickListHtml(s)}</div>
    </div>`;
}

function foodListHtml(q) {
  const k = keyOf(q);
  const all = [...db.foods, ...FOOD_DB];
  let html = '';
  if (!k) {
    const recent = recentFoods();
    if (recent.length) html += `<h3 class="sub">Recent</h3>${recent.map(foodItemHtml).join('')}<h3 class="sub" style="margin-top:14px">All foods</h3>`;
  }
  const list = k ? all.filter((f) => keyOf(f.name).includes(k) || (f.tags && keyOf(f.tags).includes(k))) : all;
  if (!list.length) {
    return `${html}<p class="muted small pad-y">No food matches “${esc(q.trim())}”. Add it as your own food with the numbers from its label.</p>`;
  }
  return html + list.map(foodItemHtml).join('');
}

function sheetFoodPick(s) {
  return `
    ${sheetHead('Add food', dayLabel(s.date))}
    <div class="sheet-in">
      <input type="search" class="search" id="food-q" placeholder="Search, e.g. rice or itlog" value="${esc(s.q)}" aria-label="Search food" autocomplete="off">
      <button type="button" class="btn block ghost" style="margin-bottom:10px" data-action="food-new">Add your own food</button>
      <div id="food-list" class="list">${foodListHtml(s.q)}</div>
    </div>`;
}

function macroBoxHtml(f, q) {
  return `
    <div class="macro"><span class="num big">${kcalText(f.kcal * q)}</span><span class="muted small">kcal</span></div>
    <div class="macro"><span class="num big">${macro(f.p * q)}</span><span class="muted small">g protein</span></div>
    <div class="macro"><span class="num big">${macro(f.c * q)}</span><span class="muted small">g carbs</span></div>
    <div class="macro"><span class="num big">${macro(f.f * q)}</span><span class="muted small">g fat</span></div>`;
}

function sheetFoodAmount(s) {
  const f = getFood(s.foodId);
  if (!f) return sheetHead('Food not found', '');
  const where = s.date === localDate() ? 'today' : dayLabel(s.date);
  return `
    ${sheetHead(f.name, `One serving is ${f.serving}`)}
    <div class="sheet-in stack">
      <div class="stepper">
        <button type="button" class="btn" data-action="qty" data-d="-0.5" aria-label="Half a serving less">−</button>
        <div class="qty"><span class="num big" id="qty-val">${fmt(s.qty)}</span><span class="muted small">serving${s.qty === 1 ? '' : 's'}</span></div>
        <button type="button" class="btn" data-action="qty" data-d="0.5" aria-label="Half a serving more">+</button>
      </div>
      <div class="macros" id="macro-box">${macroBoxHtml(f, s.qty)}</div>
      ${f.est ? '<p class="muted small" style="margin:0">Recipes and brands vary, so treat this as an estimate.</p>' : ''}
      <button type="button" class="btn primary block" data-action="food-log">Add to ${esc(where.toLowerCase() === 'yesterday' ? 'yesterday' : where)}</button>
      ${f.custom ? `<button type="button" class="btn small danger" data-action="food-delete-custom" data-id="${esc(f.id)}">Delete this food</button>` : ''}
    </div>`;
}

function sheetFoodNew(s) {
  return `
    ${sheetHead('Add your own food', 'Copy the numbers from the label, per serving')}
    <div class="sheet-in stack">
      <label class="field"><span>Name</span><input type="text" id="nf-name" value="${esc(s.name || '')}" placeholder="e.g. My protein shake"></label>
      <label class="field"><span>One serving is</span><input type="text" id="nf-serving" placeholder="e.g. 1 glass, or 1 pack (60 g)"></label>
      <div class="two-col">
        <label class="field"><span>Calories (kcal)</span><input type="text" inputmode="decimal" id="nf-kcal"></label>
        <label class="field"><span>Protein (g)</span><input type="text" inputmode="decimal" id="nf-p"></label>
        <label class="field"><span>Carbs (g)</span><input type="text" inputmode="decimal" id="nf-c"></label>
        <label class="field"><span>Fat (g)</span><input type="text" inputmode="decimal" id="nf-f"></label>
      </div>
      <button type="button" class="btn primary block" data-action="food-save-new">Save food</button>
    </div>`;
}

function sheetTargets() {
  const s = db.settings;
  return `
    ${sheetHead('Daily targets', 'Leave a box empty to hide that target')}
    <div class="sheet-in stack">
      <div class="two-col">
        <label class="field"><span>Calories (kcal)</span><input type="text" inputmode="numeric" id="tg-kcal" value="${s.calorieTarget ?? ''}"></label>
        <label class="field"><span>Protein (g)</span><input type="text" inputmode="numeric" id="tg-p" value="${s.proteinTarget ?? ''}"></label>
      </div>
      <button type="button" class="btn primary block" data-action="targets-save">Save targets</button>
    </div>`;
}

const SHEETS = { exercise: sheetExercise, pick: sheetPick, food: sheetFoodPick, amount: sheetFoodAmount, newfood: sheetFoodNew, targets: sheetTargets };

function renderSheet() {
  if (!sheet) return;
  // Content goes in #sheet-body so the toast element (moved into the dialog while it is open) survives.
  $('#sheet-body').innerHTML = SHEETS[sheet.kind](sheet);
}

function openSheet(s) {
  sheet = s;
  renderSheet();
  const d = $('#sheet');
  if (!d.open) {
    try { d.showModal(); } catch (_) { d.setAttribute('open', ''); }
  }
  d.scrollTop = 0;
}

function closeSheet() {
  const d = $('#sheet');
  if (d.open) d.close();
  sheet = null;
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

function title() {
  if (tab === 'today') return db.active ? 'Workout in progress' : 'Today';
  if (tab === 'exercises') return 'Exercises';
  if (tab === 'body') return bodyMode === 'weight' ? 'Body weight' : 'Food';
  if (tab === 'history') return 'History';
  return moreMode === 'program' ? 'Program' : 'Backup and settings';
}

function render() {
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
    b.classList.toggle('live', b.dataset.tab === 'today' && !!db.active);
  });
  let html = '';
  if (tab === 'today') html = db.active ? viewWorkout() : viewToday();
  else if (tab === 'exercises') html = viewExercises();
  else if (tab === 'body') html = viewBody();
  else if (tab === 'history') html = viewHistory();
  else html = viewMore();
  $('#view').innerHTML = html;
  $('#title').textContent = title();
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function workoutById(id) { return db.program.find((w) => w.id === id); }

function applyPick(name) {
  const s = sheet;
  if (!s || !name) return;
  let msg = '';
  let note = '';
  const ok = commit(() => {
    if (s.purpose === 'program') {
      const w = workoutById(s.w);
      if (!w) return false;
      if (w.exercises.some((x) => keyOf(x.name) === keyOf(name))) { note = `${name} is already in ${w.name}.`; return false; }
      w.exercises.push(exercise(name, 3, '8-12'));
      msg = `Added ${name} to ${w.name}.`;
      return true;
    }
    if (s.purpose === 'workout-add') {
      if (!db.active) return false;
      db.active.entries.push(newEntry(name, 3, ''));
      msg = `Added ${name}.`;
      return true;
    }
    if (s.purpose === 'swap') {
      if (!db.active) return false;
      msg = swapEntry(s.entryId, name);
      return !!msg;
    }
    return false;
  });
  if (!ok) {
    // Not saved: the picker stays open and the workout or program is exactly as before.
    render();
    if (note) toast(note);
    return;
  }
  closeSheet();
  render();
  toast(msg);
}

const actions = {
  start: (el) => {
    if (db.active && !confirm('A workout is already in progress. Discard it and start this one?')) return;
    startWorkout(Number(el.dataset.index));
  },
  tick: (el) => { unlockAudio(); toggleSet(el.dataset.entry, Number(el.dataset.set)); },
  'add-set': (el) => {
    commit(() => {
      const e = findEntry(el.dataset.entry);
      if (!e) return false;
      e.sets.push(newSet());
      return true;
    });
    render();
  },
  'remove-set': (el) => {
    const e = findEntry(el.dataset.entry);
    if (!e || e.sets.length <= 1) return;
    const lastSet = e.sets[e.sets.length - 1];
    const hasNumbers = lastSet.done || lastSet.w !== '' || lastSet.r !== '';
    if (hasNumbers && !confirm(`Set ${e.sets.length} of ${e.name} has numbers in it. Remove it anyway?`)) return;
    commit(() => { e.sets.pop(); });
    render();
  },
  swap: (el) => openSheet({ kind: 'pick', purpose: 'swap', entryId: el.dataset.entry, q: '', cat: 'All' }),
  'pick-open': (el) => openSheet({ kind: 'pick', purpose: el.dataset.purpose, w: el.dataset.w, q: '', cat: 'All' }),
  'pick-cat': (el) => { sheet.cat = el.dataset.cat; renderSheet(); },
  pick: (el) => { const e = LIB_BY_ID.get(el.dataset.id); if (e) applyPick(e.name); },
  'pick-custom': () => applyPick(sheet.q.trim()),
  finish: () => finishWorkout(),
  discard: () => discardWorkout(false),
  'rest-add': () => { if (rest) { rest.endsAt = Math.max(rest.endsAt, Date.now()) + 15000; rest.over = false; tickRest(); } },
  'rest-skip': () => stopRest(),

  // Exercise library
  'lib-cat': (el) => { libCat = el.dataset.cat; render(); },
  'lib-open': (el) => openSheet({ kind: 'exercise', id: el.dataset.id }),
  'lib-add': (el) => {
    const e = LIB_BY_ID.get(el.dataset.id);
    const w = workoutById(el.dataset.w);
    if (!e || !w) return;
    if (w.exercises.some((x) => keyOf(x.name) === keyOf(e.name))) { toast(`${e.name} is already in ${w.name}.`); return; }
    if (commit(() => { w.exercises.push(exercise(e.name, 3, '8-12')); })) toast(`Added to ${w.name}.`);
  },

  // History
  'history-mode': (el) => { historyMode = el.dataset.mode; render(); },
  'delete-session': (el) => {
    const s = db.sessions.find((x) => x.id === el.dataset.id);
    if (!s || !confirm(`Delete ${s.name} from ${dateLabel(s.finishedAt)}? This can't be undone.`)) return;
    const ok = commit(() => { db.sessions = db.sessions.filter((x) => x.id !== s.id); });
    render();
    if (ok) toast('Workout deleted.');
  },

  // Body weight
  'body-mode': (el) => { bodyMode = el.dataset.mode; render(); },
  'bw-save': () => saveWeight(),
  'bw-delete': (el) => {
    const b = db.bodyweights.find((x) => x.id === el.dataset.id);
    if (!b || !confirm(`Delete the ${fmt(b.w)} ${db.settings.unit} weigh-in from ${dayLabel(b.date)}?`)) return;
    commit(() => { db.bodyweights = db.bodyweights.filter((x) => x.id !== b.id); });
    render();
  },

  // Food
  'food-day': (el) => {
    const next = addDays(foodDate, Number(el.dataset.d));
    if (next > localDate()) return;
    foodDate = next; render();
  },
  'food-open': () => openSheet({ kind: 'food', date: foodDate, q: '' }),
  'food-pick': (el) => openSheet({ kind: 'amount', foodId: el.dataset.id, date: sheet ? sheet.date : foodDate, qty: 1 }),
  qty: (el) => {
    sheet.qty = Math.max(0.5, Math.min(20, sheet.qty + Number(el.dataset.d)));
    const f = getFood(sheet.foodId);
    $('#qty-val').textContent = fmt(sheet.qty);
    $('#macro-box').innerHTML = macroBoxHtml(f, sheet.qty);
    $('#qty-val').nextElementSibling.textContent = sheet.qty === 1 ? 'serving' : 'servings';
  },
  'food-log': () => {
    const f = getFood(sheet.foodId);
    if (!logFood(sheet.foodId, sheet.date, sheet.qty)) return; // sheet stays open; save() explained why
    closeSheet(); render();
    if (f) toast(`Added ${f.name}.`);
  },
  'food-remove': (el) => {
    const x = db.foodLog.find((y) => y.id === el.dataset.id);
    if (!x || !confirm(`Remove ${x.name} (${kcalText(x.kcal * x.qty)} kcal) from ${dayLabel(x.date).toLowerCase() === 'today' ? 'today' : dayLabel(x.date)}?`)) return;
    const before = db.foodLog;
    db.foodLog = db.foodLog.filter((y) => y.id !== x.id);
    if (!save()) { db.foodLog = before; return; }
    render();
  },
  'food-new': () => openSheet({ kind: 'newfood', date: sheet ? sheet.date : foodDate, name: sheet && sheet.q ? sheet.q.trim() : '' }),
  'food-save-new': () => {
    const name = $('#nf-name').value.trim();
    const kcal = toNum($('#nf-kcal').value);
    if (!name) { toast('Give the food a name.'); $('#nf-name').focus(); return; }
    if (kcal == null || kcal < 0) { toast('Enter the calories per serving.'); $('#nf-kcal').focus(); return; }
    const food = {
      id: `c-${uid()}`, name, serving: $('#nf-serving').value.trim() || '1 serving',
      kcal, p: Math.max(0, toNum($('#nf-p').value) || 0), c: Math.max(0, toNum($('#nf-c').value) || 0), f: Math.max(0, toNum($('#nf-f').value) || 0), custom: true,
    };
    db.foods.unshift(food);
    if (!save()) { db.foods.shift(); return; }
    openSheet({ kind: 'amount', foodId: food.id, date: sheet.date, qty: 1 });
    toast('Food saved. It shows up in search from now on.');
  },
  'food-delete-custom': (el) => {
    const f = db.foods.find((x) => x.id === el.dataset.id);
    if (!f || !confirm(`Delete ${f.name} from your foods? Days you already logged keep their numbers.`)) return;
    if (!commit(() => { db.foods = db.foods.filter((x) => x.id !== f.id); })) return;
    closeSheet(); render();
  },
  targets: () => openSheet({ kind: 'targets' }),
  'targets-save': () => {
    const k = toNum($('#tg-kcal').value);
    const p = toNum($('#tg-p').value);
    const ok = commit(() => {
      db.settings.calorieTarget = k > 0 ? Math.round(k) : null;
      db.settings.proteinTarget = p > 0 ? Math.round(p) : null;
    });
    if (!ok) return; // sheet stays open with what was typed
    closeSheet(); render(); toast('Targets saved.');
  },

  // Program
  'more-mode': (el) => { moreMode = el.dataset.mode; render(); },
  'move-ex': (el) => {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    const i = w.exercises.findIndex((e) => e.id === el.dataset.e);
    const j = i + Number(el.dataset.dir);
    if (i < 0 || j < 0 || j >= w.exercises.length) return;
    commit(() => { [w.exercises[i], w.exercises[j]] = [w.exercises[j], w.exercises[i]]; });
    render();
  },
  'remove-ex': (el) => {
    const w = workoutById(el.dataset.w);
    const e = w && w.exercises.find((x) => x.id === el.dataset.e);
    if (!e || !confirm(`Remove ${e.name || 'this exercise'} from ${w.name}? Its history stays.`)) return;
    commit(() => { w.exercises = w.exercises.filter((x) => x.id !== e.id); });
    render();
  },
  'delete-workout': (el) => {
    const w = workoutById(el.dataset.w);
    if (!w) return;
    if (db.program.length <= 1) { toast('Keep at least one workout.'); return; }
    if (!confirm(`Delete workout ${w.name}? Logged history stays.`)) return;
    commit(() => { db.program = db.program.filter((x) => x.id !== w.id); });
    render();
  },
  'add-workout': () => {
    commit(() => { db.program.push({ id: uid(), name: 'New workout', exercises: [] }); });
    render();
  },

  // Backup and settings
  export: () => exportBackup('download'),
  share: () => exportBackup('share'),
  erase: () => {
    const typed = prompt('This deletes every workout, weigh-in and food log on this phone. Type ERASE to confirm.');
    if (typed !== 'ERASE') return;
    if (!commit(() => { db = defaultData(); })) { render(); return; }
    stopRest(); releaseWake();
    tab = 'today'; render(); toast('All data erased.');
  },
  install: async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (_) { /* ignore */ }
    deferredInstall = null;
    render();
  },
  'dismiss-install': () => { commit(() => { db.installTipDismissed = true; }); render(); },
  'sheet-close': () => closeSheet(),

  // Recovery and safety copies
  'recovery-download': () => {
    if (recovery && recovery.raw) downloadText(`gym-log-saved-data-${localDate()}.json`, recovery.raw);
  },
  'recovery-reload': () => location.reload(),
  'recovery-fresh': () => {
    if (!confirm('Start fresh? This replaces the unreadable data on this phone for good. Download it first if you might need it.')) return;
    // save() refuses while recovery is set, so lift it for this one write and put it back on failure.
    const prevDb = db;
    const prevRecovery = recovery;
    recovery = null;
    db = defaultData();
    if (!save()) { db = prevDb; recovery = prevRecovery; render(); return; }
    render();
    toast('Started fresh.');
  },
  'recovery-keep': () => {
    if (!recovery || !recovery.partial) return;
    if (!confirm(`Continue with what loaded? Damaged records will be left out or repaired for good (${recovery.dropped} problem${recovery.dropped === 1 ? '' : 's'}). Download the saved data first if you might need it.`)) return;
    const prevDb = db;
    const r = recovery;
    recovery = null;
    db = r.partial;
    if (!save()) { db = prevDb; recovery = r; render(); return; }
    render();
    toast('Continuing with the data that loaded.');
  },
  'copy-download': (el) => {
    let text = null;
    try { text = localStorage.getItem(el.dataset.key); } catch (_) { text = null; }
    if (!text) { toast('That copy is no longer there.'); render(); return; }
    const stamp = el.dataset.key.slice(SAFETY_PREFIX.length).replace(/\./g, '-');
    downloadText(`gym-log-${stamp}.json`, text);
  },
  'copy-delete': (el) => {
    if (!confirm('Delete this safety copy for good? Download it first if you might need it.')) return;
    try { localStorage.removeItem(el.dataset.key); } catch (_) { /* ignore */ }
    render();
  },
};

document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('.tabs button[data-tab]');
  if (tabBtn) { tab = tabBtn.dataset.tab; render(); window.scrollTo(0, 0); return; }
  const go = e.target.closest('[data-goto]');
  if (go) {
    tab = go.dataset.goto;
    if (tab === 'more' && go.dataset.mode) moreMode = go.dataset.mode;
    render(); window.scrollTo(0, 0); return;
  }
  const el = e.target.closest('[data-action]');
  if (el && !el.disabled && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});

document.addEventListener('input', (e) => {
  const el = e.target;
  // Search boxes update only their list, so the keyboard stays open.
  if (el.id === 'lib-q') { libQ = el.value; $('#lib-list').innerHTML = libListHtml(filterLib(libQ, libCat), 'lib-open'); return; }
  if (el.id === 'pick-q' && sheet) { sheet.q = el.value; $('#pick-list').innerHTML = pickListHtml(sheet); return; }
  if (el.id === 'food-q' && sheet) { sheet.q = el.value; $('#food-list').innerHTML = foodListHtml(sheet.q); return; }
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
    const ok = commit(() => {
      db.settings[k] = el.type === 'checkbox' ? el.checked : k === 'restSeconds' ? Number(el.value) : el.value;
    });
    if (!ok) { render(); return; } // puts the control back to the saved setting
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

// Enter on weight jumps to reps; Enter on reps ticks the set; Enter in the weigh-in box saves it.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  const el = e.target;
  if (el.id === 'bw-w') { e.preventDefault(); saveWeight(); return; }
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

// Drop exercises left with no name when switching tabs.
function tidyProgram() {
  commit(() => {
    let changed = false;
    db.program.forEach((w) => {
      const before = w.exercises.length;
      w.exercises = w.exercises.filter((x) => x.name.trim());
      if (w.exercises.length !== before) changed = true;
    });
    return changed;
  });
}
document.querySelector('.tabs').addEventListener('click', tidyProgram, true);

// Sheet: tapping the dark backdrop closes it; so does the back gesture / Esc.
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
$('#sheet').addEventListener('close', () => { sheet = null; });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { keepAwake(); if (rest) tickRest(); }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (tab === 'today' && !db.active) render();
});

// Another window of this app (a browser tab, or the installed app) saved data.
// This window's copy in memory is now out of date, and writing it would overwrite the
// other window's work. So: keep anything here that only exists in memory as a safety
// copy, then reload, which runs every startup check (version, damaged records, safety
// copies, recovery mode) on what was actually saved.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY) return; // safety copies and other keys don't matter here

  // Saved data that only this window holds (unreadable or partly unreadable, no copy yet).
  if (recovery && recovery.raw && (recovery.reason === 'unreadable' || recovery.reason === 'skipped')
      && !keepSafetyCopy(recovery.reason, recovery.raw)) {
    // No room to keep it, and reloading would lose it. Stay put so it can still be downloaded.
    startupNotice = 'Another window changed your data. Download the saved data below before you reload, or it will be lost.';
    closeSheet();
    render();
    return;
  }

  let note = 'Reloaded because your data was changed in another window.';
  // Changes here that storage refused, or data the other window just cleared: keep them too.
  if (unsaved || e.newValue === null) {
    note = keepSafetyCopy('other-window', JSON.stringify(db))
      ? 'Reloaded because your data was changed in another window. What this window had was kept as a safety copy in More > Backup and settings.'
      : "Reloaded because your data was changed in another window. Changes this window couldn't save were lost.";
  }
  try { sessionStorage.setItem(NOTE_KEY, note); } catch (_) { /* no note, still safe */ }
  location.reload();
});

// Workout clock: update just the number once a second.
setInterval(() => {
  const el = document.getElementById('wo-clock');
  if (el && db.active) el.textContent = clockText(db.active.startedAt);
}, 1000);

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
render();
if (db.active) keepAwake();
