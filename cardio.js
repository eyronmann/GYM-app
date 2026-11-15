'use strict';
/*
  Cardio: runs and walks, on a treadmill or outdoors.

  Loaded before app.js. It uses app.js's helpers (db, commit, render, toast,
  esc, uid, ...) only inside functions, which run after app.js has loaded.

  Saving follows AGENTS.md: every button goes through commit(). The one
  exception is the save every 10 seconds while GPS points arrive, which calls
  save() directly, like typing does. If that save fails the run stays on
  screen and the toast says so.

  Always read db.activeRun fresh. commit() replaces db when a save fails, so a
  run object kept in a variable across a commit can be a stale copy.

  WHAT A WEB APP CAN AND CAN'T DO HERE (read before "fixing" any of it)
  - GPS only works while this app is open with the screen on. A locked phone
    or another app in front stops the tracking. So a GPS run keeps the screen
    awake, and "Lock screen" covers it so a pocket can't press buttons.
    Background tracking needs a native app.
  - When the app leaves the screen, the run is paused at once and saved, and it
    stays paused until Resume is tapped. Nothing is counted for the time away.
  - While a run is paused, GPS and the motion sensor are switched off and the
    screen is allowed to sleep. Resume switches them back on, and the clock
    waits for the next good fix, so finding the signal again costs no pace.
  - Nothing here uses the network. The route is drawn on this phone from the
    recorded points, on a plain background. There is no street map and there
    are no directions: both need an online map service or a map database far
    too big for this app, and an online service would be sent your location.
  - Location is asked for only when a GPS run is started or resumed.
  - Browsers have no step counter. During a GPS run, footstrikes are counted
    from the phone's motion sensor. The count is saved only when it works out
    to a believable walking or running rhythm; otherwise no steps are saved.
    It is an estimate, it depends on where the phone is carried, and it is
    labelled "est.". Never replace a missing count with a number made up from pace.
  - "Back to start" is the straight-line distance and compass direction to
    where the run began. It is not a route and the screen says so.

  WHAT THE NUMBERS ARE
  - Distance comes from GPS fixes that pass the filters below.
  - Elapsed time is the wall clock from the first fix to Finish. Moving time
    leaves out pauses and standing still. Pace and speed use moving time.
  - Calories are an estimate from the ACSM walking and running equations, using
    the latest weigh-in. Expect it to be off by 10 to 20 percent. Every screen
    labels it "est." and must keep doing so.
*/

const GPS_MAX_ACCURACY = 35;   // metres: fixes worse than this are not recorded
const GPS_MIN_STEP = 5;        // metres: smaller movement is GPS jitter. Half the fix's accuracy is used if that is larger
const GPS_MAX_SPEED = 8;       // metres per second (about 29 km/h): faster than this is a GPS jump
const GPS_GAP_MS = 20000;      // no fix for this long counts as a gap (screen off, or no signal)
const STOP_AFTER_MS = 15000;   // no progress for this long, then slower than STOP_SPEED, counts as standing still
const STOP_SPEED = 0.5;        // metres per second
const ROUTE_MAX_POINTS = 200;  // saved routes are thinned to about this many points to save storage
const RUN_NAMES = { run: 'Run', walk: 'Walk' };
let runType = 'run';
let runWhere = 'gps';      // 'gps' outdoors, or 'timer' for a treadmill
let gpsWatch = null;
let gps = { state: 'off', acc: null, here: null, msg: '' };
let lastFixAt = null;      // time of the last good fix, used to spot gaps
let lastRunSaveAt = 0;
let touchLock = false;
let stepState = null;      // motion-sensor step counting, while it is running
let stepRequest = 0;       // goes up on every start and stop of step counting, so a late permission answer can be recognised
let mapDrawn = '';         // what the live map last drew, so it is only redrawn when something changed

/* ------------------------------------------------------------------ */
/* Numbers                                                             */
/* ------------------------------------------------------------------ */

function metresBetween(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

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
// How long a GPS run has made no progress right now, if that is long enough to count as standing still.
function idleMs(r) {
  if (!r.gps || r.paused || !r.lastResumeAt || !r.pts.length) return 0;
  const idle = Date.now() - Math.max(r.pts[r.pts.length - 1][2], r.lastResumeAt);
  return idle > STOP_AFTER_MS ? idle : 0;
}
// Moving time: the clock minus time spent standing still (only GPS can tell).
const runMovingMs = (r) => Math.max(0, runClockMs(r) - r.stoppedMs - idleMs(r));

// Speed over the last 30 seconds, in metres per second. Falls to 0 when you stop.
function recentSpeed(r) {
  if (r.paused || r.pts.length < 2) return 0;
  const now = Date.now();
  const from = now - 30000;
  let d = 0;
  let oldest = null;
  for (let i = r.pts.length - 1; i > 0; i--) {
    const p = r.pts[i];
    if (p[2] < from) break;
    oldest = p;
    if (p[3]) break; // start of a stretch: nothing before it joins up
    const q = r.pts[i - 1];
    if (q[2] < from) break;
    d += metresBetween(q, p);
    oldest = q;
  }
  if (!oldest) return 0;
  const secs = (now - oldest[2]) / 1000;
  return secs >= 5 ? d / secs : 0;
}

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

function startRun(useGps) {
  if (db.active) { toast('Finish or discard your workout first.'); return false; }
  if (db.activeRun) return false;
  if (useGps && !('geolocation' in navigator)) { toast("This browser can't read GPS. Use the timer instead."); return false; }
  const ok = commit(() => { db.activeRun = newRun(useGps); });
  if (ok && useGps) {
    mapDrawn = '';
    lastFixAt = null;
    startGps(); // the phone asks for location permission here, not before
    startSteps();
    keepAwake();
  }
  render();
  if (ok) window.scrollTo(0, 0);
  return ok;
}

// Stop the clock on a run object (no saving here; callers do it inside commit()).
function stopClock(r) {
  if (r.paused) return;
  const now = Date.now();
  r.stoppedMs += idleMs(r); // no progress right up to this moment
  // A signal gap is normally counted when the next good fix arrives. One that is still
  // going on now would never be counted, so count it here. No distance is added for it.
  // (lastFixAt is cleared by stopGps() once the pause or finish has been saved, so the
  // same gap can't be counted again.)
  if (r.gps && lastFixAt != null && now - lastFixAt > GPS_GAP_MS) r.gapMs += now - lastFixAt;
  if (r.lastResumeAt) r.activeMs += now - r.lastResumeAt;
  r.lastResumeAt = null;
  r.paused = true;
}

// byApp is true when the app pauses the run itself because it left the screen.
function pauseRun(byApp) {
  if (!db.activeRun || db.activeRun.paused) return false;
  const ok = commit(() => {
    stopClock(db.activeRun);
    if (byApp) db.activeRun.recovered = true;
  });
  // Paused and saved: stop listening and let the screen sleep. Resume starts them again.
  if (ok && db.activeRun.gps) {
    stopGps();
    stopSteps();
    releaseWake();
  }
  return ok;
}

function resumeRun() {
  if (!db.activeRun || !db.activeRun.paused) return false;
  const ok = commit(() => {
    const r = db.activeRun;
    r.paused = false;
    r.recovered = false;
    // A GPS run's clock waits for the next good fix, as it did at the start. That fix
    // begins a new stretch, so nothing between the pause and now is joined to the route.
    r.lastResumeAt = r.gps ? null : Date.now();
    r.breakNext = r.pts.length > 0;
  });
  if (ok && db.activeRun.gps) {
    lastFixAt = null;
    startGps();
    startSteps();
    keepAwake();
  }
  return ok;
}

// Thin a recorded track into saved stretches: [ [ [lat, lng], ... ], ... ]. A pause starts a new stretch.
function simplifyRoute(pts) {
  const segs = [];
  pts.forEach((p) => {
    if (p[3] || !segs.length) segs.push([]);
    segs[segs.length - 1].push([p[0], p[1]]);
  });
  const every = Math.max(1, Math.ceil(pts.length / ROUTE_MAX_POINTS));
  return segs
    .map((seg) => seg.filter((_, i) => i % every === 0 || i === seg.length - 1))
    .filter((seg) => seg.length > 1);
}

function finishGpsRun() {
  const r = db.activeRun;
  if (!r) return;
  if (r.dist < 50) {
    if (confirm('Less than 50 m was tracked, so there is nothing to save. Discard this session?')) discardRun(true);
    return;
  }
  const name = RUN_NAMES[r.type];
  // If storage refuses, commit() puts the run back exactly as it was, still in progress.
  const ok = commit(() => {
    const a = db.activeRun;
    const end = Date.now();
    stopClock(a);
    const secs = Math.max(1, Math.round((a.activeMs - a.stoppedMs) / 1000));
    db.runs.push({
      id: a.id, type: a.type, treadmill: false, startedAt: a.startedAt, finishedAt: new Date(end).toISOString(),
      secs, elapsedSecs: Math.max(secs, Math.round((end - (a.firstAt || end)) / 1000)),
      dist: Math.round(a.dist), incline: null, kcal: cardioKcal(a.type, a.dist, secs, a.kg, 0), kg: a.kg,
      steps: believableSteps(a, secs), gapSecs: Math.round(a.gapMs / 1000), route: simplifyRoute(a.pts),
    });
    db.activeRun = null;
  });
  if (ok) endRun(`${name} saved.`);
  else render();
}

// Called once when the app opens (and after a restore). A GPS run left going when the app
// closed is paused at its last recorded point, so the missing time isn't counted as running.
// GPS is not switched back on here: that happens when Resume is tapped.
function recoverRun() {
  const r = db.activeRun;
  if (!r || !r.gps || r.paused) return;
  const pauseAtLastPoint = () => {
    const a = db.activeRun;
    const lastT = a.pts.length ? a.pts[a.pts.length - 1][2] : null;
    if (a.lastResumeAt && lastT && lastT > a.lastResumeAt) a.activeMs += lastT - a.lastResumeAt;
    a.lastResumeAt = null;
    a.paused = true;
    a.recovered = true;
  };
  // If this can't be saved, still pause what is on screen: a clock that counted the time the app was closed would be wrong.
  if (!commit(pauseAtLastPoint)) pauseAtLastPoint();
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
  touchLock = false;
  stopGps();
  stopSteps();
  releaseWake();
  closeSheet();
  render();
  window.scrollTo(0, 0);
  if (msg) toast(msg);
}

/* ------------------------------------------------------------------ */
/* GPS                                                                 */
/* ------------------------------------------------------------------ */

function startGps() {
  if (gpsWatch != null) return;
  if (!('geolocation' in navigator)) { gps = { state: 'error', acc: null, here: null, msg: "This browser can't read GPS." }; return; }
  gps = { state: 'waiting', acc: null, here: gps.here, msg: '' };
  gpsWatch = navigator.geolocation.watchPosition(onFix, onGpsError, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
}

function stopGps() {
  if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = null;
  lastFixAt = null;
  gps = { state: 'off', acc: null, here: null, msg: '' };
}

function onFix(pos) {
  const c = pos.coords;
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || !Number.isFinite(c.accuracy)) return;
  const here = [+c.latitude.toFixed(5), +c.longitude.toFixed(5)];
  const good = c.accuracy <= GPS_MAX_ACCURACY;
  const firstFix = gps.state !== 'ok' && gps.state !== 'weak';
  gps = { state: good ? 'ok' : 'weak', acc: Math.round(c.accuracy), here, msg: '' };
  const r = db.activeRun;
  if (r && r.gps && !r.paused && good) {
    const wasWaiting = r.lastResumeAt == null;
    addPoint(r, here, Date.now(), c.accuracy);
    // Between saves these points exist only in this window. Saying so makes the
    // other-window check keep a safety copy of them before it reloads.
    if (Date.now() - lastRunSaveAt > 10000) { lastRunSaveAt = Date.now(); save(); } else unsaved = true;
    if (wasWaiting) { render(); return; }
  }
  if (firstFix && r) { render(); return; }
  updateRunScreen();
}

function onGpsError(err) {
  const denied = err && err.code === 1;
  gps = {
    state: denied ? 'error' : gps.state === 'off' ? 'off' : 'waiting', acc: null, here: gps.here,
    msg: denied ? 'Location is blocked for this app. Allow it in your phone or browser settings, then pause and resume.' : '',
  };
  if (denied) {
    if (gpsWatch != null) navigator.geolocation.clearWatch(gpsWatch);
    gpsWatch = null;
    if (tab === 'today') render();
  } else updateRunScreen();
}

// Record one good fix. The clock starts at the first one, so waiting for GPS doesn't hurt your pace.
function addPoint(r, here, t, acc) {
  if (r.lastResumeAt == null) r.lastResumeAt = t;
  if (r.firstAt == null) r.firstAt = t;
  const gap = lastFixAt != null && t - lastFixAt > GPS_GAP_MS ? t - lastFixAt : 0;
  lastFixAt = t;
  if (gap) r.gapMs += gap;
  const last = r.pts[r.pts.length - 1];
  if (!last) { r.pts.push([here[0], here[1], t]); return; }
  if (r.breakNext) {
    // First fix after a pause: start a new stretch without joining it to the old one.
    r.pts.push([here[0], here[1], t, 1]);
    r.breakNext = false;
    return;
  }
  const d = metresBetween(last, here);
  const ms = t - last[2];
  // Standing still, GPS wanders by a few metres. Ignore movement it can't tell from that.
  if (d < Math.max(GPS_MIN_STEP, acc / 2)) return;
  if (ms > 0 && d / (ms / 1000) > GPS_MAX_SPEED) return;
  // A long wait followed by a few metres was standing still, not moving.
  // (After a signal gap the distance is the straight line between the two fixes: the least you covered.)
  if (ms > STOP_AFTER_MS && d / (ms / 1000) < STOP_SPEED) r.stoppedMs += ms;
  r.dist += d;
  r.pts.push([here[0], here[1], t]);
}

/* ------------------------------------------------------------------ */
/* Steps from the motion sensor (an estimate)                          */
/* ------------------------------------------------------------------ */

// Only ever called from a Start or Resume tap: iPhones grant the motion sensor only from a tap.
function startSteps() {
  if (stepState || !('DeviceMotionEvent' in window)) return;
  stepRequest += 1;
  const mine = stepRequest;
  const begin = () => {
    // The phone may answer the permission question late: after a pause, a finish, a discard,
    // or a newer request. Listen only if this is still the latest request and its run is
    // still being tracked.
    const r = db.activeRun;
    if (mine !== stepRequest || stepState || !r || !r.gps || r.paused) return;
    stepState = { avg: 9.8, up: false, lastAt: 0 };
    window.addEventListener('devicemotion', onMotion);
  };
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission().then((p) => { if (p === 'granted') begin(); }).catch(() => {});
  } else begin();
}

function stopSteps() {
  stepRequest += 1; // any permission answer still on its way is now out of date
  window.removeEventListener('devicemotion', onMotion);
  stepState = null;
}

// Each footstrike is a bump in total acceleration above its running average.
// At most one step per 280 ms, which allows up to about 210 steps a minute.
function onMotion(e) {
  const r = db.activeRun;
  const a = e.accelerationIncludingGravity;
  if (!r || !r.gps || r.paused || r.lastResumeAt == null || !stepState || !a || a.x == null) return;
  const bump = Math.hypot(a.x, a.y, a.z) - stepState.avg;
  stepState.avg += bump * 0.02;
  const now = Date.now();
  if (!stepState.up && bump > 1.5 && now - stepState.lastAt > 280) {
    stepState.up = true;
    stepState.lastAt = now;
    r.steps += 1;
    unsaved = true; // in memory only until the next 10-second save, like new GPS points
  } else if (stepState.up && bump < 0.5) stepState.up = false;
}

// The sensor's count, or null when it doesn't work out to a believable rhythm
// (no sensor, permission refused, phone not on the body). Null is saved as "not counted".
function believableSteps(r, secs) {
  const perMin = secs > 0 ? r.steps / (secs / 60) : 0;
  return r.steps > 20 && perMin >= 60 && perMin <= 210 ? r.steps : null;
}

/* ------------------------------------------------------------------ */
/* Back to start (straight line only)                                  */
/* ------------------------------------------------------------------ */

const COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
function compassTo(from, to) {
  const rad = Math.PI / 180;
  const dLng = (to[1] - from[1]) * rad;
  const y = Math.sin(dLng) * Math.cos(to[0] * rad);
  const x = Math.cos(from[0] * rad) * Math.sin(to[0] * rad) - Math.sin(from[0] * rad) * Math.cos(to[0] * rad) * Math.cos(dLng);
  const deg = ((Math.atan2(y, x) / rad) + 360) % 360;
  return COMPASS[Math.round(deg / 45) % 8];
}
function homeText(r) {
  const here = liveHere(r);
  if (!here || !r.pts.length) return '';
  const d = metresBetween(here, r.pts[0]);
  if (d < 30) return 'You are at your start point.';
  const far = d >= 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d / 10) * 10} m`;
  return `Your start point is ${far} to the ${compassTo(here, r.pts[0])}, in a straight line.`;
}

/* ------------------------------------------------------------------ */
/* Route drawing (on this phone, no map service)                       */
/* ------------------------------------------------------------------ */

const MAP_W = 358;
const MAP_H = 240;

// Fit points into the picture. At the size of a run the ground is flat enough to treat
// latitude and longitude as a grid in metres. minSpan stops a tiny track filling the frame.
function mapView(points, minSpan) {
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const lng0 = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180); // metres per degree of longitude here
  const ky = 110540;                                    // metres per degree of latitude
  const w = Math.max(minSpan, (Math.max(...lngs) - Math.min(...lngs)) * kx);
  const h = Math.max(minSpan, (Math.max(...lats) - Math.min(...lats)) * ky);
  const scale = Math.min((MAP_W - 56) / w, (MAP_H - 56) / h); // pixels per metre
  return { lat0, lng0, kx, ky, scale };
}

function mapInnerSvg(segs, here, homeLine) {
  const all = segs.flat().concat(here ? [here] : []);
  if (!all.length) return '';
  const v = mapView(all, 120);
  const px = (p) => `${(MAP_W / 2 + (p[1] - v.lng0) * v.kx * v.scale).toFixed(1)},${(MAP_H / 2 - (p[0] - v.lat0) * v.ky * v.scale).toFixed(1)}`;
  const dot = (p, cls) => { const [x, y] = px(p).split(','); return `<circle cx="${x}" cy="${y}" r="6" class="${cls}"/>`; };
  // Long live tracks are drawn from every nth point so redrawing stays quick.
  const lines = segs.filter((s) => s.length > 1).map((s) => {
    const every = Math.max(1, Math.ceil(s.length / 400));
    return s.filter((_, i) => i % every === 0 || i === s.length - 1).map(px).join(' ');
  });
  const first = segs.length && segs[0].length ? segs[0][0] : null;
  const lastSeg = segs[segs.length - 1];
  const end = here || (lastSeg && lastSeg.length ? lastSeg[lastSeg.length - 1] : null);
  // Scale bar: the longest round distance that fits in about 100 px.
  const bar = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10].find((m) => m * v.scale <= 100) || 10;
  const barPx = (bar * v.scale).toFixed(1);
  return `${homeLine && here && first ? `<polyline points="${px(here)} ${px(first)}" class="home-line"/>` : ''}
    ${lines.map((l) => `<polyline points="${l}" class="route-edge"/>`).join('')}
    ${lines.map((l) => `<polyline points="${l}" class="route"/>`).join('')}
    ${first ? dot(first, 'pin-start') : ''}${end ? dot(end, here ? 'pin-here' : 'pin-end') : ''}
    <path d="M14 ${MAP_H - 14} h${barPx}" class="scale-bar"/><text x="14" y="${MAP_H - 22}" class="map-text">${bar >= 1000 ? `${bar / 1000} km` : `${bar} m`}</text>
    <text x="${MAP_W - 14}" y="24" text-anchor="end" class="map-text">N ↑</text>`;
}

function mapHtml(segs, here, live) {
  const inner = mapInnerSvg(segs, here, live);
  if (!inner) return '';
  const where = live && here ? `You are at <span class="num">${here[0].toFixed(5)}, ${here[1].toFixed(5)}</span>${gps.acc != null ? ` (within about ${gps.acc} m)` : ''}. ` : '';
  return `
    <figure class="map-card">
      <svg viewBox="0 0 ${MAP_W} ${MAP_H}" class="map" role="img" aria-label="Your route"><g${live ? ' id="run-map"' : ''}>${inner}</g></svg>
      <figcaption class="muted small">${live ? `<span id="run-where">${where}</span>` : ''}Green is the start${live ? ', blue is you, and the dashed line points straight back to the start' : ', red is the finish'}. Drawn on this phone from your GPS points, north up. There is no street map behind it.</figcaption>
    </figure>`;
}

const savedMapHtml = (run) => (run.route.length ? mapHtml(run.route, null, false) : '');

// The track of the run in progress as stretches of points.
function liveSegs(r) {
  const segs = [];
  r.pts.forEach((p) => {
    if (p[3] || !segs.length) segs.push([]);
    segs[segs.length - 1].push(p);
  });
  return segs;
}
const liveHere = (r) => gps.here || (r.pts.length ? r.pts[r.pts.length - 1] : null);

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

function gpsLine(r) {
  if (gps.state === 'error') return gps.msg;
  if (r.paused) return r.recovered ? 'Paused, because the app left the screen. Tap Resume to carry on.' : 'Paused. GPS is off until you resume.';
  if (gps.state === 'ok') return `GPS locked, accurate to about ${gps.acc} m.`;
  if (gps.state === 'weak') return `Weak GPS (about ${gps.acc} m off). Move into the open. Nothing is recorded until it improves.`;
  return 'Looking for GPS. Stand in the open for a moment.';
}

// The numbers on the screen of a session in progress.
function runNumbers(r) {
  const secs = runMovingMs(r) / 1000;
  if (!r.gps) return { time: durText(secs) };
  const avg = secs > 0 ? r.dist / secs : 0;
  const now = recentSpeed(r);
  const kcal = cardioKcal(r.type, r.dist, secs, r.kg, 0);
  const wall = r.firstAt ? (Date.now() - r.firstAt) / 1000 : 0;
  const steps = believableSteps(r, secs);
  return {
    dist: kmText(r.dist), time: durText(secs), elapsed: durText(wall), pace: paceText(avg), now: paceText(now),
    speed: speedText(now), avg: speedText(avg), kcal: kcal == null ? '–' : kcalText(kcal),
    steps: steps == null ? '–' : steps.toLocaleString(), gps: gpsLine(r), home: homeText(r),
  };
}

// Runs once a second and on every GPS fix: update the numbers without rebuilding the screen.
function updateRunScreen() {
  const r = db.activeRun;
  if (!r || tab !== 'today') return;
  const n = runNumbers(r);
  document.querySelectorAll('[data-rs]').forEach((el) => { if (el.dataset.rs in n) el.textContent = n[el.dataset.rs]; });
  if (!r.gps || touchLock) return;
  const here = liveHere(r);
  const map = document.getElementById('run-map');
  if (!map) { if (here && document.getElementById('run-nomap')) render(); return; }
  const key = `${r.pts.length}|${here ? here.join(',') : ''}|${gps.acc}`;
  if (key === mapDrawn) return;
  mapDrawn = key;
  map.innerHTML = mapInnerSvg(liveSegs(r), here, true);
  const where = document.getElementById('run-where');
  if (where && here) where.innerHTML = `You are at <span class="num">${here[0].toFixed(5)}, ${here[1].toFixed(5)}</span>${gps.acc != null ? ` (within about ${gps.acc} m)` : ''}. `;
}

function viewGpsRun(r) {
  const n = runNumbers(r);
  const waiting = !r.paused && r.lastResumeAt == null;

  if (touchLock) {
    return `
      <div class="run-lock">
        <p class="muted" style="margin:0">${RUN_NAMES[r.type]} in progress</p>
        <p class="huge num" style="margin:0"><span data-rs="dist">${n.dist}</span> <span class="unit">km</span></p>
        <div class="stats two" style="width:100%">
          ${statHtml('time', n.time, 'moving time', 'lead')}
          ${statHtml('pace', n.pace, 'avg pace /km', 'lead')}
        </div>
        <p class="muted small" data-rs="gps" style="margin:0;text-align:center">${esc(n.gps)}</p>
        <button type="button" class="btn block" data-hold="unlock">Hold to unlock</button>
      </div>`;
  }

  mapDrawn = '';
  return `${warningsHtml()}
    <div class="wo-head" style="--plate:var(--plate-green);--plate-ink:#fff">
      <span class="disc" aria-hidden="true">${r.type === 'walk' ? 'W' : 'R'}</span>
      <div class="grow">
        <h2>${RUN_NAMES[r.type]}${r.paused ? ', paused' : ''}</h2>
        <p class="muted small" data-rs="gps" style="margin:0">${esc(n.gps)}</p>
      </div>
    </div>
    ${r.paused && r.recovered ? '<div class="notice warn">Tracking stopped when this app left the screen (the phone locked, you switched apps, or the app was closed). Nothing has been recorded since then. Tap Resume to carry on.</div>' : ''}
    ${waiting && gps.state !== 'error' ? `<div class="notice">${r.pts.length ? 'The clock starts again by itself at the next good GPS fix.' : 'The clock starts by itself at the first good GPS fix. This can take up to a minute outdoors, and longer indoors.'}</div>` : ''}
    ${r.paused || ('wakeLock' in navigator && !wakeRefused) ? '' : "<div class=\"notice warn\">This browser isn't keeping the screen on. Set your phone's screen timeout to its longest setting before you run, or tracking stops when the screen turns off. (iPhones before iOS 18.4 can't do this in an app added to the Home Screen.)</div>"}
    <section class="card">
      <p class="huge num" style="margin:0 0 10px"><span data-rs="dist">${n.dist}</span> <span class="unit">km</span></p>
      <div class="stats two">
        ${statHtml('time', n.time, 'moving time', 'lead')}
        ${statHtml('pace', n.pace, 'avg pace /km', 'lead')}
      </div>
      <div class="stats" style="margin-top:6px">
        ${statHtml('elapsed', n.elapsed, 'elapsed')}
        ${statHtml('now', n.now, 'pace now /km')}
        ${statHtml('speed', n.speed, 'km/h now')}
        ${statHtml('avg', n.avg, 'avg km/h')}
        ${statHtml('kcal', n.kcal, 'kcal (est.)')}
        ${statHtml('steps', n.steps, 'steps (est.)')}
      </div>
      ${r.kg ? '' : '<p class="muted small" style="margin:10px 0 0">No calories, because there is no weigh-in yet. Log one in Body before your next run.</p>'}
    </section>
    <div style="margin-top:12px">${mapHtml(liveSegs(r), liveHere(r), true) || '<div class="card muted small" id="run-nomap">Your route appears here once GPS finds you.</div>'}</div>
    <p class="small" style="margin:10px 0 0"><strong data-rs="home">${esc(n.home)}</strong> <span class="muted">That is a direction, not a route: this app has no streets.</span></p>
    <div class="finish-bar">
      <div class="two-col">
        <button type="button" class="btn" data-action="${r.paused ? 'run-resume' : 'run-pause'}">${r.paused ? 'Resume' : 'Pause'}</button>
        <button type="button" class="btn" data-action="run-lock">Lock screen</button>
      </div>
      <button type="button" class="btn primary block" data-action="run-finish">Finish and save</button>
      <button type="button" class="btn danger block" data-action="run-discard">Discard</button>
    </div>
    <p class="muted small" style="margin-top:14px">Keep this screen on and the app open. If the phone locks or you switch apps, the run pauses and waits for you to tap Resume. Use Lock screen before putting the phone in a pocket or armband. Steps are counted from the phone's movement, so they only show when the phone is on your body, and they are an estimate. Your location stays on this phone.</p>`;
}

function viewRun() {
  const r = db.activeRun;
  if (r.gps) return viewGpsRun(r);
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
  if (x.gapSecs >= 30) extra.push(`GPS had no usable signal for about ${durText(x.gapSecs)} while tracking. Distance across a gap is a straight line, and none is added for a gap at the very end, so the real distance is a bit longer.`);
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
  const useGps = runWhere === 'gps';
  return `
    ${segHtml('run-where', runWhere, [['gps', 'Outdoors, GPS'], ['timer', 'Treadmill, timer']], 'Where')}
    <button type="button" class="btn plate block" style="--plate:var(--plate-green);--plate-ink:#fff" data-action="${useGps ? 'run-start-gps' : 'run-start-timer'}">Start ${what}${useGps ? '' : ' timer'}</button>
    <p class="muted small" style="margin:10px 0 0">${useGps
    ? 'Tracks distance, pace, speed and your route by GPS. Your phone will ask for location permission. The screen has to stay on with this app open the whole time, so it uses more battery than a normal run app. If the phone locks or you switch apps, the run pauses until you tap Resume. Nothing is sent anywhere.'
    : 'Counts the time. You enter the distance or speed from the treadmill at the end.'}</p>`;
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
        ${last.route.length ? `<div style="margin-top:12px">${savedMapHtml(last)}</div>` : ''}
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
      <div class="run-map-slot" style="margin-top:12px"></div>
      <div class="row wrap" style="margin-top:12px;gap:8px">
        <button type="button" class="btn small danger" data-action="run-delete" data-id="${esc(x.id)}">Delete this ${RUN_NAMES[x.type].toLowerCase()}</button>
        ${x.route.length ? `<button type="button" class="btn small" data-action="route-delete" data-id="${esc(x.id)}">Delete only the route</button>` : ''}
      </div>
    </details>`).join('');
  return `<div class="stack">${items}</div>`;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

const CARDIO_ACTIONS = {
  'run-type': (el) => { runType = el.dataset.mode; render(); },
  'run-where': (el) => { runWhere = el.dataset.mode; render(); },
  'run-start-gps': () => { startRun(true); },
  'run-start-timer': () => { startRun(false); },
  'run-pause': () => { pauseRun(); render(); },
  'run-resume': () => { resumeRun(); render(); },
  'run-finish': () => (db.activeRun && db.activeRun.gps ? finishGpsRun() : finishTimer()),
  'run-lock': () => { touchLock = true; render(); window.scrollTo(0, 0); },
  'route-delete': (el) => {
    const x = db.runs.find((y) => y.id === el.dataset.id);
    if (!x || !confirm('Delete the route of this session and keep its numbers? The route can\'t be brought back.')) return;
    const ok = commit(() => { db.runs.find((y) => y.id === x.id).route = []; });
    render();
    if (ok) toast('Route deleted. The numbers are kept.');
  },
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

// Hold the unlock button for a second. A brush against it in a pocket does nothing.
let holdTimer = null;
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest || !e.target.closest('[data-hold="unlock"]')) return;
  clearTimeout(holdTimer);
  holdTimer = setTimeout(() => { touchLock = false; render(); }, 1000);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((name) => document.addEventListener(name, () => clearTimeout(holdTimer), true));

// A saved run's route is only drawn when its card is opened, so History doesn't draw every route at once.
document.addEventListener('toggle', (e) => {
  const card = e.target;
  if (!card.matches || !card.matches('details[data-run]') || !card.open) return;
  const slot = card.querySelector('.run-map-slot');
  const run = db.runs.find((x) => x.id === card.dataset.run);
  if (slot && run && !slot.innerHTML) slot.innerHTML = savedMapHtml(run);
}, true);

// Leaving the app mid-run: tracking is about to stop, so pause the run and save it now.
// It stays paused until Resume is tapped. That tap is also what lets the phone hand the
// wake lock and the sensors back. If the pause can't be saved, the run carries on in
// memory as before and the time away shows up as a signal gap.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !db.activeRun || !db.activeRun.gps || db.activeRun.paused) return;
  // Browsers also report "hidden" while a page reloads. When the app itself asked for the
  // reload (another window saved), this window's copy is already dealt with: don't save again.
  if (reloading) return;
  pauseRun(true);
  if (tab === 'today') render();
});

setInterval(updateRunScreen, 1000);
