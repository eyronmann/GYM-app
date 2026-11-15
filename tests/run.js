'use strict';
/*
  Tests for the data rules in AGENTS.md. Run with:   node tests/run.js
  They run the real app files against a fake page and fake storage (see harness.js),
  so they cannot change real saved data. They say nothing about a physical phone.
*/
const assert = require('assert');
const { boot, FakeStorage } = require('./harness');

const plain = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const near = (got, want, tol, msg) => assert.ok(Math.abs(got - want) <= tol, `${msg || 'value'}: got ${got}, wanted ${want} ± ${tol}`);
const tick = () => new Promise((resolve) => setImmediate(resolve));

/* ---------- sample saved data, one per data version ---------- */

const SESSION = {
  id: 's1', workoutId: 'w1', label: 'A', name: 'Push', startedAt: '2026-11-10T08:00:00.000Z', finishedAt: '2026-11-10T09:00:00.000Z',
  entries: [{ key: 'bench press', name: 'Bench Press', targetSets: 3, targetReps: '6-8', sets: [{ w: 60, r: 6 }, { w: 60, r: 5 }, { w: null, r: 12 }] }],
};
const PROGRAM = [
  { id: 'w1', name: 'Push', exercises: [{ id: 'e1', name: 'Bench Press', sets: 3, reps: '6-8' }] },
  { id: 'w2', name: 'Legs', exercises: [{ id: 'e2', name: 'Hack Squat', sets: 3, reps: '5-6' }] },
];
const V1 = {
  version: 1, settings: { unit: 'kg', restSeconds: 90, restSound: true, keepAwake: true },
  program: PROGRAM, sessions: [SESSION], active: null, lastBackupAt: null, installTipDismissed: true,
};
const V2 = {
  ...V1, version: 2, settings: { ...V1.settings, calorieTarget: 2400, proteinTarget: 100 },
  bodyweights: [{ id: 'b1', date: '2026-11-14', w: 50 }],
  foods: [{ id: 'c-1', name: 'My shake', serving: '1 glass', kcal: 650, p: 45, c: 70, f: 20, custom: true }],
  foodLog: [{ id: 'f1', date: '2026-11-14', foodId: null, name: 'Rice', serving: '1 cup', qty: 2, kcal: 200, p: 4, c: 45, f: 0 }],
};
const V3 = {
  ...V2, version: 3,
  moveLog: [{ id: 'm1', at: '2026-11-12T08:00:00.000Z', name: 'Posture routine', kind: 'Posture', secs: null, done: ['Chin Tuck', 'Wall Angel'], total: 8, notes: 'ok' }],
};
const RUN = {
  id: 'r1', type: 'run', treadmill: false, startedAt: '2026-11-13T22:00:00.000Z', finishedAt: '2026-11-13T22:30:00.000Z',
  secs: 1700, elapsedSecs: 1800, dist: 5000, incline: null, kcal: 290, kg: 50, steps: 4800, gapSecs: 0,
  route: [[[18.055, 120.565], [18.056, 120.565]], [[18.056, 120.566], [18.057, 120.566]]],
};
const TREADMILL = {
  id: 'r2', type: 'walk', treadmill: true, startedAt: '2026-11-14T10:00:00.000Z', finishedAt: '2026-11-14T10:30:00.000Z',
  secs: 1800, elapsedSecs: 1800, dist: 2500, incline: 2, kcal: 120, kg: 50, steps: null, gapSecs: 0, route: [],
};
const V4 = { ...V3, version: 4, runs: [RUN, TREADMILL], activeRun: null };

// Start a GPS run and deliver the first fix, which starts its clock.
function startGpsRun(a) {
  a.tap('today-mode', { mode: 'cardio' });
  a.tap('run-where', { mode: 'gps' });
  a.tap('run-start-gps');
  assert.ok(a.db.activeRun && a.db.activeRun.gps, 'a GPS run started');
  a.fix();
}
// Run north at `speed` m/s for `secs` seconds, one fix a second.
const runNorth = (a, secs, speed = 3) => { for (let i = 0; i < secs; i++) a.fix({ north: speed }); };

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

/* ---------- migration ---------- */

test('migrate: version 1, 2, 3 and 4 files load with 0 problems and their records unchanged', () => {
  const a = boot();
  [V1, V2, V3, V4].forEach((data) => {
    const { out, dropped, error } = a.migrate(data);
    assert.ok(!error, `v${data.version} was refused: ${error}`);
    assert.strictEqual(dropped, 0, `v${data.version} dropped`);
    assert.strictEqual(out.version, 4);
    same(out.sessions, data.sessions, `v${data.version} sessions`);
    same(out.program, data.program, `v${data.version} program`);
    same(out.bodyweights, data.bodyweights || [], `v${data.version} weigh-ins`);
    same(out.foodLog, data.foodLog || [], `v${data.version} food log`);
    same(out.foods, data.foods || [], `v${data.version} foods`);
    same(out.moveLog, data.moveLog || [], `v${data.version} mobility log`);
    same(out.runs, data.runs || [], `v${data.version} runs and routes`);
    assert.strictEqual(out.activeRun, null);
    // Migrating the result again changes nothing.
    const again = a.migrate(out);
    assert.strictEqual(again.dropped, 0);
    same(again.out, out);
  });
});

test('migrate: starting the app on version 2 data keeps it, writes no safety copy, and saves it as version 4', () => {
  const a = boot({ stored: V2 });
  same(a.db.sessions, V2.sessions);
  same(a.db.bodyweights, V2.bodyweights);
  same(a.db.foodLog, V2.foodLog);
  assert.deepStrictEqual(a.local.keys(), ['gymlog.v1'], 'no safety copy for a clean file');
  assert.strictEqual(a.run('recovery'), null);
});

test('migrate: a newer version and a foreign file are refused, never downgraded', () => {
  const a = boot();
  assert.strictEqual(a.migrate({ ...V4, version: 5 }).error, 'newer');
  assert.strictEqual(a.migrate({ hello: 'world' }).error, 'not-ours');
});

test('migrate: damaged cardio and mobility records are counted, never turned into 0', () => {
  const a = boot();
  const bad = plain(V4);
  bad.runs[0].dist = 'x';            // unreadable distance: the run is left out and counted
  bad.runs[1].kcal = '';             // unreadable calories: left out and counted
  bad.runs.push({ id: 'q' });        // not a run
  bad.moveLog[0].secs = 'soon';      // unreadable duration
  bad.activeRun = { type: 'run' };   // not a session in progress
  const { out, dropped } = a.migrate(bad);
  assert.strictEqual(dropped, 5);
  assert.strictEqual(out.runs.length, 0);
  assert.strictEqual(out.moveLog.length, 0);
  assert.strictEqual(out.activeRun, null);
  same(out.sessions, V4.sessions, 'undamaged records are untouched');
});

test('migrate: a list the version must have counts as damage when it is missing', () => {
  const a = boot();
  const noRuns = plain(V4); delete noRuns.runs;
  assert.strictEqual(a.migrate(noRuns).dropped, 1);
  const noLog = plain(V3); delete noLog.moveLog;
  assert.strictEqual(a.migrate(noLog).dropped, 1);
  assert.strictEqual(a.migrate(V2).dropped, 0, 'version 2 never had them');
});

test('migrate: a damaged stretch of route is left out and counted; the run and its numbers stay', () => {
  const a = boot();
  const bad = plain(V4);
  bad.runs[0].route[0][1] = ['a', 2];
  const { out, dropped } = a.migrate(bad);
  assert.strictEqual(dropped, 1);
  assert.strictEqual(out.runs.length, 2);
  assert.strictEqual(out.runs[0].route.length, 1);
  assert.strictEqual(out.runs[0].dist, 5000);
});

test('migrate: a GPS run saved mid-run (with a pause in it) reloads with 0 problems, exactly as saved', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 40);
  a.tap('run-pause');
  a.tap('run-resume');
  a.fix({ north: 3 });
  runNorth(a, 20);
  for (let i = 0; i < 25; i++) a.footfall();
  assert.ok(a.run('save()'));
  const saved = a.saved();
  assert.ok(saved.activeRun.pts.some((p) => p[3] === 1), 'the pause left a route break');
  const { out, dropped } = a.migrate(saved);
  assert.strictEqual(dropped, 0);
  same(out.activeRun, saved.activeRun);
});

test('migrate: a treadmill timer in progress reloads with 0 problems and keeps counting', () => {
  const a = boot({ stored: V2 });
  a.tap('run-start-timer');
  a.advance(60000);
  const { out, dropped } = a.migrate(a.saved());
  assert.strictEqual(dropped, 0);
  same(out.activeRun, a.saved().activeRun);
  const b = boot({ local: a.local, now: a.clock.now + 120000 });
  assert.strictEqual(b.db.activeRun.paused, false);
  near(b.run('runMovingMs(db.activeRun)') / 1000, 180, 1, 'timer after a reload');
});

/* ---------- GPS distance, time and filtering ---------- */

test('gps: distance, moving time, pace and speed', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 300);
  const r = a.db.activeRun;
  near(r.dist, 900, 9, 'distance in metres');
  near(a.run('runMovingMs(db.activeRun)') / 1000, 300, 1, 'moving seconds');
  const n = a.run('runNumbers(db.activeRun)');
  assert.strictEqual(n.dist, '0.90');
  assert.ok(['5:32', '5:33', '5:34'].includes(n.pace), `average pace ${n.pace}`);
  near(Number(n.speed), 10.8, 0.2, 'speed now, km/h');
  near(Number(n.avg), 10.8, 0.2, 'average speed, km/h');
});

test('gps: standing still with jitter adds no distance and no moving time', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 60);
  const before = plain({ d: a.db.activeRun.dist, t: a.run('runMovingMs(db.activeRun)') });
  for (let i = 0; i < 60; i++) a.fix({ north: i % 2 ? 2 : -2 });
  near(a.db.activeRun.dist, before.d, 0.01, 'distance while standing');
  near(a.run('runMovingMs(db.activeRun)'), before.t, 16000, 'moving time while standing');
  assert.strictEqual(a.run('runNumbers(db.activeRun)').now, '–', 'pace now falls away');
  runNorth(a, 30);
  near(a.run('runMovingMs(db.activeRun)') / 1000, before.t / 1000 + 30, 4, 'the stop is left out for good');
  near(a.db.activeRun.stoppedMs / 1000, 60, 4, 'time standing');
});

test('gps: weak fixes, jumps, and wobble inside a poor fix are not recorded', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 30);
  const d = a.db.activeRun.dist;
  const n = a.db.activeRun.pts.length;
  for (let i = 0; i < 10; i++) a.fix({ north: 3, acc: 80 });       // worse than 35 m
  assert.strictEqual(a.db.activeRun.pts.length, n, 'weak fixes add no points');
  a.fix({ north: -30 });                                           // back where the good fixes stopped
  const d2 = a.db.activeRun.dist;
  a.fix({ north: 500 });                                           // 500 m in a second
  assert.strictEqual(a.db.activeRun.dist, d2, 'a jump adds nothing');
  a.fix({ north: -500, secs: 1 });
  for (let i = 0; i < 20; i++) a.fix({ north: i % 2 ? 10 : -10, acc: 30 }); // 10 m wobble, 30 m accuracy
  near(a.db.activeRun.dist, d2, 0.01, 'wobble inside a poor fix');
  assert.ok(d2 - d < 1, 'nothing was added across the weak period by returning to the same spot');
});

test('gps: a signal gap is counted once, with only the straight line added', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 60);
  const d = a.db.activeRun.dist;
  a.drift({ north: 150, secs: 60 });
  a.fix();
  near(a.db.activeRun.gapMs / 1000, 61, 2, 'gap seconds');
  near(a.db.activeRun.dist - d, 150, 3, 'straight line across the gap');
  runNorth(a, 10);
  near(a.db.activeRun.gapMs / 1000, 61, 2, 'not counted twice');
});

test('gps: an outage followed directly by Finish is in gapSecs, with no distance invented', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 60);
  const d = a.db.activeRun.dist;
  a.drift({ north: 270, secs: 90 });                               // 90 s with no fix, then straight to Finish
  a.tap('run-finish');
  assert.strictEqual(a.db.activeRun, null);
  const x = a.db.runs[a.db.runs.length - 1];
  near(x.gapSecs, 90, 1, 'gapSecs');
  near(x.dist, d, 1, 'distance');
  near(x.secs, 60, 1, 'moving time leaves the outage out');
  near(x.elapsedSecs, 150, 1, 'elapsed time includes it');
  assert.strictEqual(a.geo.watching, false);
});

test('gps: an outage, then Pause, Resume and Finish counts that gap exactly once', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 60);
  a.drift({ north: 90, secs: 45 });
  a.tap('run-pause');
  near(a.db.activeRun.gapMs / 1000, 45, 1, 'counted at Pause');
  a.drift({ north: 50, secs: 300 });
  a.tap('run-resume');
  a.fix();
  runNorth(a, 30);
  a.tap('run-finish');
  near(a.db.runs[a.db.runs.length - 1].gapSecs, 45, 1, 'still once at Finish');
});

test('gps: if the save at Finish fails, a trailing gap is not lost or doubled when it later succeeds', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 60);
  a.drift({ secs: 40 });
  a.local.failWrites = true;
  a.tap('run-finish');
  assert.ok(a.db.activeRun && !a.db.activeRun.paused, 'still in progress');
  assert.strictEqual(a.db.activeRun.gapMs, 0, 'the failed attempt left nothing behind');
  a.local.failWrites = false;
  a.drift({ secs: 20 });
  a.tap('run-finish');
  near(a.db.runs[a.db.runs.length - 1].gapSecs, 60, 1);
});

/* ---------- pause, resume, leaving the app ---------- */

test('pause: GPS, the motion sensor and the wake lock stop; movement while paused is never added', async () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  await tick();
  assert.ok(a.geo.watching && a.wake.held && a.run('stepState') !== null, 'tracking is on');
  runNorth(a, 60);
  a.tap('run-pause');
  assert.ok(a.db.activeRun.paused && a.saved().activeRun.paused, 'paused and saved');
  assert.strictEqual(a.geo.watching, false, 'GPS off');
  assert.strictEqual(a.run('stepState'), null, 'motion sensor off');
  assert.strictEqual(a.wake.held, false, 'wake lock released');
  const before = plain({ d: a.db.activeRun.dist, t: a.run('runMovingMs(db.activeRun)'), n: a.db.activeRun.pts.length, s: a.db.activeRun.steps });
  for (let i = 0; i < 60; i++) a.fix({ east: 3 });                 // walking about while paused: no fixes arrive
  for (let i = 0; i < 20; i++) a.footfall();
  same({ d: a.db.activeRun.dist, t: a.run('runMovingMs(db.activeRun)'), n: a.db.activeRun.pts.length, s: a.db.activeRun.steps }, before);

  a.tap('run-resume');
  await tick();
  assert.ok(a.geo.watching && a.wake.held && a.run('stepState') !== null, 'tracking is back on');
  assert.strictEqual(a.geo.starts, 2, 'GPS was asked for again only on Resume');
  assert.strictEqual(a.db.activeRun.lastResumeAt, null, 'the clock waits for the next fix');
  a.advance(20000);                                                // 20 s to find the signal again
  assert.strictEqual(a.run('runMovingMs(db.activeRun)'), before.t, 'waiting for the signal costs no time');
  a.fix();
  assert.strictEqual(a.db.activeRun.dist, before.d, 'the first fix after a pause starts a new stretch');
  assert.strictEqual(a.run('liveSegs(db.activeRun).length'), 2);
  runNorth(a, 10);
  near(a.db.activeRun.dist - before.d, 30, 1, 'distance after resuming');
});

test('leaving the app: a GPS run is paused and saved at once, and waits for Resume', async () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  await tick();
  runNorth(a, 63);                                                 // the last few fixes are not yet in storage
  const d = a.db.activeRun.dist;
  assert.ok(a.saved().activeRun.pts.length < a.db.activeRun.pts.length, 'some points were only in memory');
  a.hide();
  const s = a.saved().activeRun;
  assert.ok(s.paused && s.recovered, 'saved as paused by the app');
  assert.strictEqual(s.pts.length, a.db.activeRun.pts.length, 'every point is saved');
  assert.strictEqual(a.geo.watching, false);
  assert.strictEqual(a.wake.held, false);
  a.drift({ north: 400, secs: 120 });                              // two minutes away, still running
  a.show();
  assert.ok(a.db.activeRun.paused, 'still paused after coming back');
  assert.strictEqual(a.geo.starts, 1, 'nothing restarts without Resume');
  a.tap('run-resume');
  a.fix();
  runNorth(a, 30);
  a.tap('run-finish');
  const x = a.db.runs[a.db.runs.length - 1];
  near(x.dist, d + 90, 2, 'no distance for the time away');
  near(x.secs, 93, 2, 'no moving time for the time away');
  assert.strictEqual(x.gapSecs, 0, 'time away is a pause, not a signal gap');
  assert.strictEqual(x.route.length, 2, 'two stretches');
});

test('leaving the app when storage is full: the run is not lost and carries on in memory', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 30);
  a.local.failWrites = true;
  a.hide();
  assert.ok(a.db.activeRun && !a.db.activeRun.paused, 'still running in memory');
  near(a.db.activeRun.dist, 90, 1);
});

test('closing the app mid-run: it comes back paused at its last point, with GPS off until Resume', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 45);
  a.run('save()');
  const moving = a.run('runMovingMs(db.activeRun)');
  const b = boot({ local: a.local, now: a.clock.now + 3600000 });  // reopened an hour later
  assert.ok(b.db.activeRun.paused && b.db.activeRun.recovered);
  assert.strictEqual(b.geo.starts, 0, 'no location request at startup');
  near(b.run('runMovingMs(db.activeRun)'), moving, 1000, 'the hour is not counted');
  assert.strictEqual(b.db.activeRun.dist, a.db.activeRun.dist);
});

/* ---------- steps ---------- */

test('steps: counted from the motion sensor without a new GPS fix, and marked unsaved', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  a.run('save()');
  assert.strictEqual(a.run('unsaved'), false);
  for (let i = 0; i < 30; i++) a.footfall();                       // 30 steps, no fix in between
  assert.strictEqual(a.db.activeRun.steps, 30);
  assert.strictEqual(a.run('unsaved'), true);
  assert.strictEqual(a.saved().activeRun.steps, 0, 'not in storage yet');
  // Another window saves now: this window's steps go into a safety copy before it reloads.
  const b = boot({ local: a.local });
  b.run("commit(() => { db.bodyweights.push({ id: 'bw2', date: '2026-11-15', w: 50.2 }); })");
  a.otherWindowSaved();
  const copies = a.copies('other-window');
  assert.strictEqual(copies.length, 1);
  assert.strictEqual(JSON.parse(a.local.getItem(copies[0])).activeRun.steps, 30);
  assert.strictEqual(a.page.reloads, 1);
  assert.strictEqual(a.saved().bodyweights.length, 2, "the other window's save is intact");
});

test('steps: saved only when the rhythm is believable; never made up from pace', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  for (let i = 0; i < 100; i++) { a.footfall(333); a.footfall(333); a.footfall(334); a.fix({ north: 3, secs: 0 }); }
  a.tap('run-finish');
  near(a.db.runs[a.db.runs.length - 1].steps, 300, 2, 'three steps a second for 100 s');

  startGpsRun(a);
  for (let i = 0; i < 25; i++) a.footfall();                       // a few knocks, then nothing
  runNorth(a, 200);
  assert.ok(a.db.activeRun.steps >= 25);
  assert.strictEqual(a.run('runNumbers(db.activeRun)').steps, '–');
  a.tap('run-finish');
  assert.strictEqual(a.db.runs[a.db.runs.length - 1].steps, null);
});

/* ---------- failed saves ---------- */

test('failed save: Finish on a GPS run keeps it in progress, then works', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 60);
  a.local.failWrites = true;
  a.tap('run-finish');
  assert.ok(a.db.activeRun && !a.db.activeRun.paused && a.db.runs.length === 0);
  assert.ok(a.geo.watching, 'still tracking');
  a.local.failWrites = false;
  runNorth(a, 10);
  a.tap('run-finish');
  assert.strictEqual(a.db.runs.length, 1);
  near(a.db.runs[0].dist, 210, 3);
  same(a.saved().runs, a.db.runs);
});

test('failed save: the 10-second save during a run leaves the run on screen and saves later', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 20);
  const stored = a.saved().activeRun.dist;
  a.local.failWrites = true;
  runNorth(a, 25);
  assert.strictEqual(a.saved().activeRun.dist, stored, 'storage refused');
  near(a.db.activeRun.dist, 135, 4, 'the run kept going in memory');
  a.local.failWrites = false;
  runNorth(a, 12);
  assert.ok(a.saved().activeRun.dist > 140, 'saved once storage accepted');
});

test('failed save: the treadmill form stays open with its timer paused, then saves', () => {
  const a = boot({ stored: V2 });
  a.tap('run-where', { mode: 'timer' });
  a.tap('run-start-timer');
  a.advance(600000);
  a.tap('run-finish');
  assert.strictEqual(a.sheet.kind, 'cardio');
  assert.strictEqual(a.el('cd-min').value, '10', 'the form is filled from the timer');
  a.el('cd-km').value = '2';
  a.el('cd-incline').value = '1';
  a.local.failWrites = true;
  a.tap('cardio-save');
  assert.ok(a.db.activeRun && a.db.activeRun.paused && a.db.runs.length === 0);
  assert.ok(a.sheet && a.sheet.kind === 'cardio', 'the form is still open');
  a.local.failWrites = false;
  a.tap('cardio-save');
  assert.strictEqual(a.db.activeRun, null);
  const x = a.db.runs[0];
  same({ dist: x.dist, secs: x.secs, treadmill: x.treadmill, incline: x.incline, steps: x.steps, route: x.route },
    { dist: 2000, secs: 600, treadmill: true, incline: 1, steps: null, route: [] });
  assert.strictEqual(x.kcal, a.run("cardioKcal('run', 2000, 600, 50, 1)"));
});

test('failed save: a routine keeps its sheet, ticks and notes, then saves', () => {
  const a = boot({ stored: V2 });
  a.tap('routine-open', { id: 'posture' });
  a.tap('routine-start');
  a.tap('step-tick', { id: 'chin-tuck' });
  a.tap('step-tick', { id: 'wall-angel' });
  a.el('rt-notes').value = 'stiff neck';
  a.advance(480000);
  a.local.failWrites = true;
  a.tap('routine-finish');
  assert.strictEqual(a.db.moveLog.length, 0);
  assert.ok(a.sheet && a.sheet.kind === 'routine' && a.sheet.done['chin-tuck'] === true, 'sheet and ticks kept');
  assert.strictEqual(a.el('rt-notes').value, 'stiff neck', 'notes kept');
  a.local.failWrites = false;
  a.tap('routine-finish');
  same(plain(a.db.moveLog).map(({ id, at, ...rest }) => rest),
    [{ name: 'Posture routine', kind: 'Posture', secs: 480, done: ['Chin Tuck', 'Wall Angel'], total: 8, notes: 'stiff neck' }]);
  assert.strictEqual(a.sheet, null);
  assert.strictEqual(a.migrate(a.saved()).dropped, 0);
});

/* ---------- another window ---------- */

test('another window saves during a routine: the routine comes back after the reload, nothing is lost', () => {
  const a = boot({ stored: V2 });
  a.tap('routine-open', { id: 'warmup-lower' });
  a.tap('routine-start');
  const startedAt = a.sheet.startedAt;
  a.tap('step-tick', { id: 'leg-swings' });
  a.el('rt-notes').value = 'left hip tight';
  a.advance(120000);

  const b = boot({ local: a.local });                              // a second window of the app
  b.run("commit(() => { db.bodyweights.push({ id: 'bw2', date: '2026-11-15', w: 50.2 }); })");
  a.otherWindowSaved();
  assert.strictEqual(a.page.reloads, 1, 'this window reloads');
  assert.ok(a.session.getItem('gymlog.routine'), 'after putting the routine aside');

  const a2 = boot({ local: a.local, session: a.session, now: a.clock.now + 1000 }); // the reloaded window
  assert.ok(a2.sheet && a2.sheet.kind === 'routine' && a2.sheet.id === 'warmup-lower', 'the routine is open again');
  assert.strictEqual(a2.sheet.startedAt, startedAt, 'with its clock');
  assert.strictEqual(a2.sheet.done['leg-swings'], true, 'its ticks');
  assert.strictEqual(a2.el('rt-notes').value, 'left hip tight', 'and its notes');
  assert.strictEqual(a2.session.getItem('gymlog.routine'), null, 'the draft is used once');
  assert.strictEqual(a2.db.bodyweights.length, 2, "the other window's weigh-in is there");
  a2.tap('routine-finish');
  assert.strictEqual(a2.db.moveLog.length, 1);
  near(a2.db.moveLog[0].secs, 121, 1);
  assert.strictEqual(a2.saved().bodyweights.length, 2);
  assert.strictEqual(a2.saved().moveLog.length, 1);
});

test('another window saves during a routine and the routine cannot be put aside: the reload waits', () => {
  const a = boot({ stored: V2 });
  a.tap('routine-open', { id: 'posture' });
  a.tap('routine-start');
  a.tap('step-tick', { id: 'chin-tuck' });
  a.session.failWrites = true;
  const b = boot({ local: a.local });
  b.run("commit(() => { db.bodyweights.push({ id: 'bw2', date: '2026-11-15', w: 50.2 }); })");
  a.otherWindowSaved();
  assert.strictEqual(a.page.reloads, 0, 'no reload while the routine is open');
  assert.ok(a.sheet && a.sheet.done['chin-tuck'] === true, 'the routine is untouched');
  a.tap('sheet-close');                                            // the owner closes it (and confirms)
  assert.strictEqual(a.page.reloads, 1, 'then it reloads');
  assert.strictEqual(a.saved().bodyweights.length, 2, "the other window's save was never overwritten");
});

test('another window saves during a GPS run: unsaved points go to a safety copy, the run returns paused', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 47);                                                 // the last save was a few seconds ago
  const mine = a.db.activeRun.pts.length;
  assert.ok(a.saved().activeRun.pts.length < mine && a.run('unsaved') === true);
  const b = boot({ local: a.local });
  b.run("commit(() => { db.bodyweights.push({ id: 'bw2', date: '2026-11-15', w: 50.2 }); })");
  a.otherWindowSaved();
  const copies = a.copies('other-window');
  assert.strictEqual(copies.length, 1);
  assert.strictEqual(JSON.parse(a.local.getItem(copies[0])).activeRun.pts.length, mine);
  // Browsers report "hidden" as the page reloads. That must not save again or add a second copy.
  const stored = a.local.getItem('gymlog.v1');
  a.advance(5);
  a.hide();
  assert.strictEqual(a.copies('other-window').length, 1);
  assert.strictEqual(a.local.getItem('gymlog.v1'), stored);
  const a2 = boot({ local: a.local, session: a.session });
  assert.ok(a2.db.activeRun.paused && a2.db.bodyweights.length === 2);
});

/* ---------- backup, restore, delete ---------- */

test('backup and restore: everything comes back identical, routes included, and the old data is kept as a safety copy', () => {
  const a = boot({ stored: V4 });
  const file = a.run('backupFile()');
  const backup = JSON.parse(file.body);
  same(backup.runs, V4.runs, 'the backup file holds the routes');

  const b = boot({ stored: V2 });                                  // a phone with other data on it
  b.run('importBackup')(file);
  assert.ok(b.page.confirms.some((m) => m.includes('2 cardio sessions') && m.includes('1 mobility entry')), 'the restore says what it holds');
  ['sessions', 'program', 'bodyweights', 'foods', 'foodLog', 'moveLog', 'runs'].forEach((k) => same(b.db[k], V4[k], k));
  same(b.saved().runs, V4.runs, 'routes reached storage');
  const copies = b.copies('before-import');
  assert.strictEqual(copies.length, 1);
  same(JSON.parse(b.local.getItem(copies[0])).sessions, V2.sessions, 'what was replaced is kept');
});

test('restore: a version 1 backup still imports; a newer one is refused and changes nothing', () => {
  const a = boot({ stored: V4 });
  a.run('importBackup')({ body: JSON.stringify({ app: 'gym-log', ...V1 }) });
  same(a.db.sessions, V1.sessions);
  assert.strictEqual(a.db.version, 4);
  assert.strictEqual(a.db.runs.length, 0);
  const before = a.local.getItem('gymlog.v1');
  a.run('importBackup')({ body: JSON.stringify({ app: 'gym-log', ...V4, version: 9 }) });
  assert.strictEqual(a.local.getItem('gymlog.v1'), before);
});

test('restore: a backup taken mid-run brings the run back paused', () => {
  const a = boot({ stored: V2 });
  startGpsRun(a);
  runNorth(a, 30);
  const file = a.run('backupFile()');
  const b = boot({ stored: V2, now: a.clock.now + 86400000 });
  b.run('importBackup')(file);
  assert.ok(b.db.activeRun && b.db.activeRun.paused && b.db.activeRun.recovered);
  assert.strictEqual(b.geo.starts, 0);
});

test('delete: removing a route, a run or a mobility entry changes that record only', () => {
  const a = boot({ stored: V4 });
  const others = () => JSON.stringify([a.db.sessions, a.db.program, a.db.bodyweights, a.db.foods, a.db.foodLog, a.db.settings, a.db.runs.find((r) => r.id === 'r2')]);
  const before = others();
  a.tap('route-delete', { id: 'r1' });
  const r1 = a.db.runs.find((r) => r.id === 'r1');
  same({ ...plain(r1), route: RUN.route }, RUN, 'only the route changed');
  assert.deepStrictEqual(plain(r1.route), []);
  assert.strictEqual(others(), before);
  a.tap('run-delete', { id: 'r1' });
  assert.strictEqual(a.db.runs.length, 1);
  assert.strictEqual(others(), before);
  same(a.db.moveLog, V4.moveLog);
  a.tap('movelog-delete', { id: 'm1' });
  assert.strictEqual(a.db.moveLog.length, 0);
  assert.strictEqual(others(), before);
  same(a.saved().sessions, V4.sessions);
});

/* ---------- protections from fix/v2-review still hold ---------- */

test('recovery mode: data from a newer app is never written over, and nothing can be started', () => {
  const raw = JSON.stringify({ ...V4, version: 9 });
  const a = boot({ stored: raw });
  assert.strictEqual(a.run('recovery').reason, 'newer');
  a.tap('run-start-gps');
  a.tap('run-start-timer');
  assert.strictEqual(a.db.activeRun, null);
  assert.strictEqual(a.geo.starts, 0);
  a.tap('routine-open', { id: 'posture' });
  a.tap('routine-start');
  a.tap('step-tick', { id: 'chin-tuck' });
  a.tap('routine-finish');
  assert.ok(a.sheet && a.sheet.kind === 'routine', 'the routine stays open, unsaved');
  assert.strictEqual(a.local.getItem('gymlog.v1'), raw, 'storage is untouched');
});

test('a workout and a cardio session cannot run at the same time', () => {
  const a = boot({ stored: V2 });
  a.run('startWorkout(0)');
  assert.ok(a.db.active);
  a.tap('run-start-gps');
  a.tap('run-start-timer');
  assert.strictEqual(a.db.activeRun, null);
  const b = boot({ stored: V2 });
  b.tap('run-start-timer');
  b.run('startWorkout(0)');
  assert.strictEqual(b.db.active, null);
});

/* ---------- estimates and permissions ---------- */

test('calories: ACSM equations match hand calculation; no weigh-in means no number', () => {
  const a = boot({ stored: V2 });
  // run 4.5 km in 30 min at 1 %: (0.2 + 0.9 × 0.01) × 150 + 3.5 = 34.85 ml/kg/min; × 50 kg × 30 min × 5 / 1000
  assert.strictEqual(a.run("cardioKcal('run', 4500, 1800, 50, 1)"), 261);
  // walk 3 km in 40 min, flat: 0.1 × 75 + 3.5 = 11; × 50 × 40 × 5 / 1000
  assert.strictEqual(a.run("cardioKcal('walk', 3000, 2400, 50, null)"), 110);
  // same walk at 5 %: (0.1 + 1.8 × 0.05) × 75 + 3.5 = 17.75
  assert.strictEqual(a.run("cardioKcal('walk', 3000, 2400, 50, 5)"), 178);
  assert.strictEqual(a.run("cardioKcal('run', 4500, 1800, null, 0)"), null);
});

test('permissions: location and motion are not touched until a GPS run starts', () => {
  const a = boot({ stored: V4 });
  a.tap('today-mode', { mode: 'cardio' });
  a.tap('history-mode', { mode: 'cardio' });
  assert.strictEqual(a.geo.starts, 0);
  assert.strictEqual(a.run('stepState'), null);
  a.tap('run-start-timer');
  assert.strictEqual(a.geo.starts, 0, 'a treadmill timer needs neither');
  assert.strictEqual(a.run('stepState'), null);
});

test('wake lock: a refused request is noticed even though the API exists', async () => {
  const a = boot({ stored: V2 });
  a.wake.refuse = true;
  startGpsRun(a);
  await tick();
  assert.strictEqual(a.run('wakeRefused'), true);
  assert.ok(a.el('view').innerHTML.includes("isn't keeping the screen on"));
});

test('labels: calories and steps always say est., and the route is never called a map', () => {
  const a = boot({ stored: V4 });
  startGpsRun(a);
  runNorth(a, 30);
  a.run('render()');
  const live = a.el('view').innerHTML;
  assert.ok(live.includes('kcal (est.)') && live.includes('steps (est.)'));
  assert.ok(live.includes('no street map') && live.includes('not a route'));
  a.tap('run-finish');
  assert.ok(a.el('view').innerHTML.includes('kcal (est.)'));
  const code = require('fs').readFileSync(require('path').join(__dirname, '..', 'cardio.js'), 'utf8');
  assert.ok(!/https?:\/\//.test(code), 'cardio.js contains no web address at all');
  assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|<img|<image|<iframe/.test(code), 'and nothing that could send a request');
});

/* ---------- run ---------- */

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`ok    ${name}`);
    } catch (e) {
      failed += 1;
      console.log(`FAIL  ${name}\n      ${String(e && e.message).split('\n').join('\n      ')}`);
    }
  }
  console.log(`\n${tests.length - failed} of ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
})();
