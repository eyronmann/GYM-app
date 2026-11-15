'use strict';
/*
  Cardio: runs and walks, on a treadmill or outdoors.

  Loaded before app.js. It uses app.js's helpers (db, commit, render, toast,
  esc, uid, ...) only inside functions, which run after app.js has loaded.

  Saving follows AGENTS.md: every button goes through commit().

  Always read db.activeRun fresh. commit() replaces db when a save fails, so a
  run object kept in a variable across a commit can be a stale copy.

  WHAT THE NUMBERS ARE
  - Pace and speed are distance divided by moving time.
  - Calories are an estimate from the ACSM walking and running equations, using
    the latest weigh-in. Expect it to be off by 10 to 20 percent. Every screen
    labels it "est." and must keep doing so.
*/

const RUN_NAMES = { run: 'Run', walk: 'Walk' };
let runType = 'run';

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

const clampNum = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const kmText = (m) => (m / 1000).toFixed(2);
function durText(secs) {
  const s = Math.max(0, Math.floor(secs + 0.001));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad2(m)}:${pad2(s % 60)}` : `${m}:${pad2(s % 60)}`;
}
// Pace in minutes per km from metres per second. Below a slow shuffle there is no meaningful pace.
function paceText(mps) {
  if (!(mps > 0.3)) return '–';
  const secs = Math.round(1000 / mps);
  return `${Math.floor(secs / 60)}:${pad2(secs % 60)}`;
}
const speedText = (mps) => (mps > 0 ? (mps * 3.6).toFixed(1) : '0.0');

// Latest weigh-in in kg, or null. Calories can't be estimated without it.
function bodyKg() {
  const latest = db.bodyweights[db.bodyweights.length - 1];
  if (!latest) return null;
  return r1(db.settings.unit === 'lb' ? latest.w * 0.45359 : latest.w);
}

// ACSM metabolic equations. Oxygen use in ml per kg per minute, speed in metres per minute,
// grade as a fraction (5 % incline = 0.05):
//   walking  0.1 × speed + 1.8 × speed × grade + 3.5
//   running  0.2 × speed + 0.9 × speed × grade + 3.5
// One litre of oxygen is about 5 kcal. This is the total burned during the session,
// resting burn included. Outdoors the grade is taken as 0: hills are not measured.
function cardioKcal(type, metres, secs, kg, inclinePct) {
  if (!kg || !(secs > 0) || !(metres > 0)) return null;
  const mins = secs / 60;
  const speed = metres / mins;
  const grade = (inclinePct || 0) / 100;
  const vo2 = (type === 'walk' ? 0.1 + 1.8 * grade : 0.2 + 0.9 * grade) * speed + 3.5;
  return Math.round((vo2 * kg * mins * 5) / 1000);
}

/* ------------------------------------------------------------------ */
/* The timer                                                           */
/* ------------------------------------------------------------------ */

// Time on the clock: everything since Start except pauses.
function runClockMs(r) {
  return r.activeMs + (!r.paused && r.lastResumeAt ? Date.now() - r.lastResumeAt : 0);
}
// Moving time: the clock minus time spent standing still (only GPS can tell).
const runMovingMs = (r) => Math.max(0, runClockMs(r) - r.stoppedMs);

function newRun(gps) {
  const now = Date.now();
  return {
    id: uid(), type: runType, gps, startedAt: new Date(now).toISOString(),
    // A GPS run's clock starts at its first good fix. A timer starts now.
    firstAt: gps ? null : now, lastResumeAt: gps ? null : now,
    activeMs: 0, stoppedMs: 0, paused: false, breakNext: false, recovered: false,
    dist: 0, gapMs: 0, steps: 0, kg: bodyKg(), pts: [],
  };
}

function startRun(gps) {
  if (db.active) { toast('Finish or discard your workout first.'); return false; }
  if (db.activeRun) return false;
  const ok = commit(() => { db.activeRun = newRun(gps); });
  render();
  if (ok) window.scrollTo(0, 0);
  return ok;
}

// Stop the clock on a run object (no saving here; callers do it inside commit()).
function stopClock(r) {
  if (r.paused) return;
  if (r.lastResumeAt) r.activeMs += Date.now() - r.lastResumeAt;
  r.lastResumeAt = null;
  r.paused = true;
}

function pauseRun() {
  if (!db.activeRun || db.activeRun.paused) return false;
  return commit(() => stopClock(db.activeRun));
}

function resumeRun() {
  if (!db.activeRun || !db.activeRun.paused) return false;
  return commit(() => {
    const r = db.activeRun;
    r.paused = false;
    r.recovered = false;
    // A GPS run with no points yet still waits for its first fix.
    r.lastResumeAt = !r.gps || r.pts.length ? Date.now() : null;
    r.breakNext = r.pts.length > 0;
  });
}

// A timed session has no distance yet: pause it and ask for the numbers.
// The session is only cleared when that form is saved.
function finishTimer() {
  const r = db.activeRun;
  if (!r) return;
  if (!r.paused && !pauseRun()) { render(); return; }
  render();
  openSheet({ kind: 'cardio', fromTimer: true });
}

function discardRun(skipConfirm) {
  if (!db.activeRun) return;
  if (!skipConfirm && !confirm('Discard this session? Nothing from it will be saved.')) return;
  const ok = commit(() => { db.activeRun = null; });
  if (ok) endRun('');
  else render();
}

// Tidy up after a session has been saved or discarded.
function endRun(msg) {
  closeSheet();
  render();
  window.scrollTo(0, 0);
  if (msg) toast(msg);
}

/* ------------------------------------------------------------------ */
/* Entering a session by hand (treadmill, or anything not tracked)     */
/* ------------------------------------------------------------------ */

function sheetCardio(s) {
  const r = s.fromTimer ? db.activeRun : null;
  const secs = r ? Math.round(runMovingMs(r) / 1000) : 0;
  const type = r ? r.type : runType;
  const opt = (value, text, current) => `<option value="${value}" ${value === current ? 'selected' : ''}>${text}</option>`;
  return `
    ${sheetHead(r ? 'Finish and save' : 'Add a session by hand', r ? 'The timer is paused. Enter what the treadmill shows.' : 'For a treadmill, or anything this app did not track')}
    <div class="sheet-in stack">
      <div class="two-col">
        <label class="field"><span>Activity</span><select id="cd-type">${opt('run', 'Run', type)}${opt('walk', 'Walk', type)}</select></label>
        <label class="field"><span>Where</span><select id="cd-where">${opt('treadmill', 'Treadmill', 'treadmill')}${opt('outdoors', 'Outdoors', 'treadmill')}</select></label>
      </div>
      ${r ? '' : `<label class="field"><span>Date</span><input type="date" id="cd-date" value="${localDate()}" max="${localDate()}"></label>`}
      <div class="two-col">
        <label class="field"><span>Minutes</span><input type="text" inputmode="numeric" id="cd-min" value="${r ? Math.floor(secs / 60) : ''}"></label>
        <label class="field"><span>Seconds</span><input type="text" inputmode="numeric" id="cd-sec" value="${r ? secs % 60 : ''}" placeholder="0"></label>
      </div>
      <div class="two-col">
        <label class="field"><span>Distance (km)</span><input type="text" inputmode="decimal" id="cd-km" placeholder="e.g. 3.2"></label>
        <label class="field"><span>or speed (km/h)</span><input type="text" inputmode="decimal" id="cd-kmh" placeholder="e.g. 9"></label>
      </div>
      <p class="muted small" style="margin:0">Fill in distance or speed. The other is worked out from the time.</p>
      <label class="field"><span>Incline (%), treadmill only, optional</span><input type="text" inputmode="decimal" id="cd-incline" placeholder="0"></label>
      <button type="button" class="btn primary block" data-action="cardio-save">Save</button>
      ${bodyKg() ? '' : '<p class="muted small" style="margin:0">No calorie estimate will be saved, because there is no weigh-in yet. Log one in Body first if you want it.</p>'}
    </div>`;
}

// Reads the form. Returns the session to save, or a message saying what to fix.
function readCardioForm(fromTimer) {
  const val = (id) => ($(id) ? $(id).value.trim() : '');
  const whole = (v) => (/^\d+$/.test(v) ? Number(v) : null);
  const mins = val('#cd-min') === '' ? 0 : whole(val('#cd-min'));
  const sec = val('#cd-sec') === '' ? 0 : whole(val('#cd-sec'));
  if (mins == null || sec == null || sec > 59) return 'Enter the time as whole minutes and seconds (0 to 59).';
  const secs = mins * 60 + sec;
  if (!(secs >= 10) || secs > 86400) return 'Enter how long it took.';

  const km = toNum(val('#cd-km'));
  const kmh = toNum(val('#cd-kmh'));
  if (val('#cd-km') && !(km > 0)) return 'Distance must be a number above 0.';
  if (val('#cd-kmh') && !(kmh > 0)) return 'Speed must be a number above 0.';
  if (km == null && kmh == null) return 'Enter the distance or the speed.';
  const fromSpeed = kmh == null ? null : (kmh * 1000 * secs) / 3600;
  // Both given: they must describe the same session, or one of them is a typo.
  if (km != null && fromSpeed != null && Math.abs(km * 1000 - fromSpeed) > Math.max(50, km * 50)) {
    return `That distance and speed don't match the time (${kmText(fromSpeed)} km at that speed). Clear one of them.`;
  }
  const dist = Math.round(km != null ? km * 1000 : fromSpeed);
  if (!(dist >= 10) || dist > 300000) return 'That distance looks wrong. Check it.';
  if (dist / secs > 8) return 'That is faster than 29 km/h. Check the time and distance.';

  const treadmill = val('#cd-where') !== 'outdoors';
  let incline = null;
  if (val('#cd-incline') !== '') {
    incline = toNum(val('#cd-incline'));
    if (incline == null || incline < 0 || incline > 40) return 'Incline must be between 0 and 40 percent.';
    if (!treadmill) return 'Incline is for the treadmill only. Clear it, or set Where to Treadmill.';
  }

  const type = val('#cd-type') === 'walk' ? 'walk' : 'run';
  let finishedAt = new Date();
  let startedAt = null;
  let elapsedSecs = secs;
  let kg = bodyKg();
  let id = uid();
  if (fromTimer) {
    const r = db.activeRun;
    if (!r) return 'The timer is gone. Close this and add the session by hand.';
    id = r.id;
    startedAt = r.startedAt;
    kg = r.kg || kg;
    elapsedSecs = Math.max(secs, Math.round((finishedAt.getTime() - (r.firstAt || finishedAt.getTime())) / 1000));
  } else {
    const day = val('#cd-date');
    if (!isDay(day) || day > localDate()) return 'Pick the date, today or earlier.';
    // An earlier day has no known time, so it is filed at noon.
    if (day !== localDate()) { finishedAt = parseDay(day); finishedAt.setHours(12, 0, 0, 0); }
    startedAt = new Date(finishedAt.getTime() - secs * 1000).toISOString();
  }
  return {
    id, type, treadmill, startedAt, finishedAt: finishedAt.toISOString(),
    secs, elapsedSecs, dist, incline, kcal: cardioKcal(type, dist, secs, kg, incline), kg,
    steps: null, gapSecs: 0, route: [],
  };
}

function saveCardioForm() {
  if (!sheet || sheet.kind !== 'cardio') return;
  const fromTimer = sheet.fromTimer === true;
  const run = readCardioForm(fromTimer);
  if (typeof run === 'string') { toast(run); return; }
  // If the save fails the form stays open, and a timed session stays paused, exactly as it was.
  const ok = commit(() => {
    db.runs.push(run);
    db.runs.sort((a, b) => new Date(a.finishedAt) - new Date(b.finishedAt));
    if (fromTimer) db.activeRun = null;
  });
  if (ok) endRun(`${RUN_NAMES[run.type]} saved.`);
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function statHtml(key, value, label, cls) {
  return `<div class="stat${cls ? ` ${cls}` : ''}"><span class="num big"${key ? ` data-rs="${key}"` : ''}>${value}</span><span class="muted small">${label}</span></div>`;
}

const runPlace = (x) => (x.treadmill ? 'treadmill' : x.route.length ? 'GPS' : 'outdoors');

// The numbers on the screen of a session in progress.
function runNumbers(r) {
  return { time: durText(runMovingMs(r) / 1000) };
}

// Runs once a second: update the numbers without rebuilding the screen.
function updateRunScreen() {
  const r = db.activeRun;
  if (!r || tab !== 'today') return;
  const n = runNumbers(r);
  document.querySelectorAll('[data-rs]').forEach((el) => { if (el.dataset.rs in n) el.textContent = n[el.dataset.rs]; });
}

function viewRun() {
  const r = db.activeRun;
  const n = runNumbers(r);
  return `${warningsHtml()}
    <div class="wo-head" style="--plate:var(--plate-green);--plate-ink:#fff">
      <span class="disc" aria-hidden="true">${r.type === 'walk' ? 'W' : 'R'}</span>
      <div class="grow">
        <h2>${RUN_NAMES[r.type]} timer${r.paused ? ', paused' : ''}</h2>
        <p class="muted small" style="margin:0">Started ${timeLabel(r.startedAt)}. Enter the distance when you finish.</p>
      </div>
    </div>
    <section class="card" style="text-align:center">
      <p class="huge num" style="margin:8px 0 4px" data-rs="time">${n.time}</p>
      <p class="muted small" style="margin:0 0 8px">time, pauses left out</p>
    </section>
    <div class="finish-bar">
      <button type="button" class="btn block" data-action="${r.paused ? 'run-resume' : 'run-pause'}">${r.paused ? 'Resume' : 'Pause'}</button>
      <button type="button" class="btn primary block" data-action="run-finish">Finish and save</button>
      <button type="button" class="btn danger block" data-action="run-discard">Discard</button>
    </div>
    <p class="muted small" style="margin-top:14px">The timer keeps counting if you lock the phone or leave the app.</p>`;
}

function runStatsHtml(x) {
  const mps = x.secs > 0 ? x.dist / x.secs : 0;
  const extra = [];
  if (x.steps != null && x.elapsedSecs - x.secs >= 5) extra.push(`Elapsed time ${durText(x.elapsedSecs)}, pauses and stops included.`);
  if (x.incline) extra.push(`Incline ${x.incline} %.`);
  if (x.kcal == null) extra.push('No calorie estimate: there was no weigh-in to base it on.');
  return `
    <div class="stats">
      ${statHtml('', kmText(x.dist), 'km')}
      ${statHtml('', durText(x.secs), 'moving time')}
      ${statHtml('', paceText(mps), 'avg pace /km')}
      ${statHtml('', speedText(mps), 'avg km/h')}
      ${statHtml('', x.kcal == null ? '–' : kcalText(x.kcal), 'kcal (est.)')}
      ${x.steps == null ? statHtml('', durText(x.elapsedSecs), 'elapsed time') : statHtml('', x.steps.toLocaleString(), 'steps (est.)')}
    </div>
    ${extra.length ? `<p class="muted small" style="margin:10px 0 0">${extra.join(' ')}</p>` : ''}`;
}

function cardioStartHtml() {
  const what = runType === 'walk' ? 'walk' : 'run';
  return `
    <button type="button" class="btn plate block" style="--plate:var(--plate-green);--plate-ink:#fff" data-action="run-start-timer">Start ${what} timer</button>`;
}

function viewCardio() {
  const weekFrom = startOfDay(new Date()) - 6 * 86400000;
  const week = db.runs.filter((x) => new Date(x.finishedAt).getTime() >= weekFrom);
  const last = db.runs[db.runs.length - 1];
  const weekLine = week.length
    ? `Last 7 days: <strong class="num">${kmText(week.reduce((n, x) => n + x.dist, 0))} km</strong> in ${week.length} session${week.length === 1 ? '' : 's'}.`
    : 'No cardio in the last 7 days.';

  return `
    ${warningsHtml()}
    ${segHtml('run-type', runType, [['run', 'Run'], ['walk', 'Walk']], 'Activity')}
    ${cardioStartHtml()}
    <div class="switch">
      <button type="button" class="btn small" data-action="routine-open" data-id="warmup-run">Warm-up</button>
      <button type="button" class="btn small" data-action="routine-open" data-id="cooldown-run">Cooldown</button>
      <button type="button" class="btn small" data-action="cardio-add">Add one by hand</button>
    </div>
    <p class="small" style="margin:16px 0 12px">${weekLine}</p>
    ${last ? `
      <section class="card">
        <h3 class="sub">Last ${RUN_NAMES[last.type].toLowerCase()}, ${ago(last.finishedAt)} (${runPlace(last)})</h3>
        ${runStatsHtml(last)}
      </section>` : ''}
    <p class="muted small" style="margin-top:14px">Calories are an estimate from the ACSM walking and running equations and your latest weigh-in. Expect it to be off by 10 to 20 percent.</p>`;
}

function viewRunHistory() {
  if (!db.runs.length) return '<div class="empty"><strong>No cardio yet.</strong>Finish a run or walk from Today > Cardio and it shows up here.</div>';
  const items = [...db.runs].reverse().map((x) => `
    <details class="card" data-run="${esc(x.id)}" style="--plate:var(--plate-green);--plate-ink:#fff">
      <summary>
        <div class="row">
          <span class="disc" aria-hidden="true">${x.type === 'walk' ? 'W' : 'R'}</span>
          <div class="grow">
            <h3>${RUN_NAMES[x.type]}, <span class="num">${kmText(x.dist)} km</span></h3>
            <p class="muted small" style="margin:0">${dateLabel(x.finishedAt)}, ${runPlace(x)}, <span class="num">${durText(x.secs)}</span>, <span class="num">${paceText(x.secs > 0 ? x.dist / x.secs : 0)}</span> /km</p>
          </div>
        </div>
      </summary>
      ${runStatsHtml(x)}
      <div class="row wrap" style="margin-top:12px;gap:8px">
        <button type="button" class="btn small danger" data-action="run-delete" data-id="${esc(x.id)}">Delete this ${RUN_NAMES[x.type].toLowerCase()}</button>
      </div>
    </details>`).join('');
  return `<div class="stack">${items}</div>`;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const CARDIO_ACTIONS = {
  'run-type': (el) => { runType = el.dataset.mode; render(); },
  'run-start-timer': () => { startRun(false); },
  'run-pause': () => { pauseRun(); render(); },
  'run-resume': () => { resumeRun(); render(); },
  'run-finish': () => finishTimer(),
  'run-discard': () => discardRun(false),
  'cardio-add': () => openSheet({ kind: 'cardio', fromTimer: false }),
  'cardio-save': () => saveCardioForm(),
  'run-delete': (el) => {
    const x = db.runs.find((y) => y.id === el.dataset.id);
    if (!x || !confirm(`Delete the ${kmText(x.dist)} km ${RUN_NAMES[x.type].toLowerCase()} from ${dateLabel(x.finishedAt)}? This can't be undone.`)) return;
    const ok = commit(() => { db.runs = db.runs.filter((y) => y.id !== x.id); });
    render();
    if (ok) toast('Deleted.');
  },
};

setInterval(updateRunScreen, 1000);
