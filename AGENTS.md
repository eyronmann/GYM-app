# AGENTS.md: rules for anyone (AI or human) changing this app

Read this whole file before writing code or a review. The owner, Eyron, decides
what gets built. When two suggestions conflict, the one that makes logging at
the gym faster, or keeps the user's data safer, wins.

## What this is

A workout, cardio, mobility, body-weight and food logger for **one person**, used on a phone,
often **at the gym** with poor signal. It is an installable web app (PWA)
hosted as static files on GitHub Pages.

## Hard rules

1. **No backend.** No server, no database server, no Firebase, no API, no login.
   Data lives in the phone's `localStorage`. The only off-phone copy is the JSON
   backup file the user exports.
2. **No framework, no build step, no package.json.** Plain HTML, CSS and
   JavaScript that run as-is. The owner must be able to read and edit them.
3. **Works offline.** No CDN links, web fonts, remote scripts or online food or
   exercise APIs. Everything the app needs is in this repo and listed in `sw.js`.
   (The "Watch form videos" link opens YouTube; that is the one online extra.)
   This covers maps too: no map tiles, no map or routing service, no links that
   carry the user's position. **Location never leaves the phone.**
4. **Never lose data.** This outranks every other rule:
   - Do not rename `STORAGE_KEY` or rename/remove fields in saved data.
   - Any change to the data shape goes through `migrate()` in `app.js`, and
     `DATA_VERSION` goes up by one. Old backups (version 1 and up) must still import.
   - Never write over saved data the app failed to read.
   - Never rename an exercise in `data/exercises.js` or change a food `id` in
     `data/foods.js` once it may have been logged.
5. **Offline cache:** when you add, rename or remove a file the app loads,
   update `APP_FILES` and bump `CACHE_NAME` in `sw.js`.
6. **Phone first.** Test at 390 px wide. Tap targets at least 44 px. Inputs use
   16 px text or iPhones zoom in.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell: top bar, main view, rest-timer bar, bottom sheet, tab bar |
| `styles.css` | All styling. Colours are CSS variables at the top |
| `app.js` | All logic: data, rotation, logging, swap, rest timer, workout clock, weight, food, history, program editor, backup |
| `cardio.js` | Runs and walks: GPS tracking and its filters, timer, by-hand entry (treadmill), pace, speed, calorie estimate, the route drawing, the cardio screens. Loaded before `app.js` and uses its helpers inside functions |
| `data/routines.js` | Warm-up, mobility, posture and cooldown moves (`window.MOVES`: steps, what to avoid, equipment, alternatives) and the routines built from them (`window.ROUTINES`) |
| `data/exercises.js` | Built-in exercise library (`window.EXERCISES`): name, muscle group, equipment, form cues, alternatives |
| `data/foods.js` | Built-in food list (`window.FOODS`): per-serving calories, protein, carbs, fat |
| `sw.js` | Offline cache (cache first, refresh in background) |
| `manifest.webmanifest`, `icons/` | Home-screen install |

Tabs: Today (Lift or Cardio), Exercises (lifts, or mobility and posture), Body
(weight and food), History (workouts, exercises, mobility, cardio), More
(program, backup and settings).

## Data model (`localStorage["gymlog.v1"]`, version 4)

```js
{
  version: 4,
  settings: { unit: 'kg', restSeconds: 90, restSound: true, keepAwake: true,
              calorieTarget: null | number, proteinTarget: null | number },
  program: [                       // order = rotation order (A, B, C, ...)
    { id, name, exercises: [ { id, name, sets: 3, reps: '8-12' } ] }
  ],
  sessions: [                      // finished workouts, oldest first
    { id, workoutId, label: 'A', name, startedAt, finishedAt,
      entries: [ { key, name, targetSets, targetReps,
                   sets: [ { w: 100, r: 6 } ] } ] }   // w is null for bodyweight
  ],
  active: null | { ...in-progress workout; set values are strings while typing },
  bodyweights: [ { id, date: 'YYYY-MM-DD', w: 50.2 } ],          // one per day, sorted
  foods: [ { id: 'c-...', name, serving, kcal, p, c, f, custom: true } ],  // user's own foods
  foodLog: [ { id, date: 'YYYY-MM-DD', foodId, name, serving, qty,
               kcal, p, c, f } ],  // per-serving numbers copied at log time; total = value × qty
  moveLog: [                       // finished routines and single moves, oldest first (added in version 3)
    { id, at: ISO date, name, kind: 'Warm-up' | 'Mobility' | 'Posture' | 'Cooldown',
      secs: null | number,         // null when no duration was given, never 0
      done: [ 'Leg Swings' ],      // names of the moves ticked, copied at save time
      total: 7,                    // moves in the routine; 1 for a single move
      notes: '' } ],
  runs: [                          // finished runs and walks, oldest first (added in version 4)
    { id, type: 'run' | 'walk', treadmill: true | false, startedAt, finishedAt,
      secs,                        // moving time: pace, speed and calories use this
      elapsedSecs,                 // start to finish on the wall clock, pauses and stops included
      dist,                        // metres
      incline: null | number,      // percent, treadmill only
      kcal: null | number,         // estimate, copied at save time; null if there was no weigh-in
      kg: null | number,           // the body weight the estimate used
      steps: null | number,        // null when steps were not counted
      gapSecs,                     // time with no GPS signal; 0 for by-hand and timed sessions
      route: [ [ [lat, lng], ... ] ] }   // GPS track, one array per stretch; [] without GPS
  ],
  activeRun: null | { id, type, gps: true | false, startedAt,
                      firstAt, lastResumeAt,     // ms; null until the clock starts / while paused
                      activeMs, stoppedMs, paused, breakNext, recovered,
                      dist, gapMs, steps, kg, pts: [ [lat, lng, timeMs] ] },
  lastBackupAt: null | ISO date,
  installTipDismissed: false
}
```

Data versions, and what each added. A file of any older version loads into the
current one through `migrate()` with its existing records unchanged; lists a
version didn't have yet start empty and are not counted as damage.

| Version | Added |
|---|---|
| 1 | `settings`, `program`, `sessions`, `active` |
| 2 | `bodyweights`, `foods`, `foodLog`, calorie and protein targets |
| 3 | `moveLog` |
| 4 | `runs`, `activeRun` |

- Exercise history is matched by `key` (lower-cased name), so the same exercise in
  two workouts shares one history. The library is linked the same way: an
  exercise gets cues and alternatives when its name matches a library name.
- Food log entries copy the food's numbers so editing or deleting a food never
  changes past days.
- Mobility log entries copy the routine's and moves' names for the same reason,
  so names and ids in `data/routines.js` can change without touching history.
- A lifting workout and a cardio session can't be in progress at the same time.
- A GPS run's `pts` grow by about one point every few metres. They are saved
  every 10 seconds while tracking (a direct `save()`, like typing: if it fails
  the run stays on screen and the toast says so). On Finish the route is thinned
  to about 200 points, because `localStorage` holds roughly 5 MB in total.
  Never store full-resolution tracks in `runs`.
- A GPS run found unpaused at startup (the app was closed mid-run) is paused at
  its last recorded point and marked `recovered`. GPS is not switched back on
  until Resume is tapped.
- A timed cardio session (`gps: false`) runs on the wall clock, so it keeps
  counting through a locked phone or a reload. Finish pauses it and opens the
  by-hand form; the session is cleared only when that form saves.
- A routine in progress (its ticks, clock and notes) lives only in the open
  sheet, not in saved data. Closing it asks first. If the save on Finish fails,
  the sheet stays open with everything in it.

## Protecting saved data (how the code does rule 4)

- `save()` returns `true` only when storage accepted the write. Every tap that
  changes data goes through `commit(change)`: snapshot, change, save, and undo
  the change if the save fails. Success messages only appear after it returns
  `true`. The one exception is typing into a box: the text stays on screen if a
  save fails (the failure toast says so), because undoing keystrokes would fight
  the user.
- Safety copies are kept as `gymlog.v1.<reason>.<timestamp>` with reason
  `unreadable`, `skipped` (some records couldn't be read) or `before-import`.
  The app never deletes them; the owner downloads or deletes them in
  More > Backup and settings.
- Recovery mode: if saved data can't be used (unreadable, or written by a newer
  app version) and no safety copy fits, `save()` refuses to write until the
  owner downloads the data and chooses what to do. Newer-version data always
  pauses saving; the fix is reloading to get the newer app.
- `migrate()` rejects data with an unknown or newer `version`, and counts every
  record it can't read in `report.dropped`; callers keep a copy or ask first.
  A list that is missing or isn't a list counts too (program and sessions always;
  bodyweights, foods and foodLog from version 2, moveLog from version 3, runs
  from version 4), and so does a damaged number:
  it is never turned into 0. Repaired fields (a missing id, a bad set count,
  a missing version) are counted as well. A set's weight must be a number or
  `null` (bodyweight); a missing weight is damage, not bodyweight. Data the app
  wrote itself always counts 0; keep it that way when adding fields.
- Recovery mode also covers storage that can't be read at all (`'read-failed'`):
  nothing is saved or restored until a reload can read it.
- When another window of the app saves (the `storage` event), this window keeps
  anything that exists only in its memory as a safety copy (`other-window`),
  then reloads so every startup check runs on what was saved. It never writes
  its own older copy over the other window's data. If there's no room for the
  copy it doesn't reload: saving pauses (`'conflict'`) and the data is offered
  as a download.
- Stale-write check: `save()` remembers the exact text it last read or wrote
  (`lastSeenRaw`). Before writing it reads storage again; if the text differs,
  another window saved first, so it doesn't write and handles it as above.
  Limit: the read and the write are two steps and browsers give pages no lock
  on localStorage, so a write from another window in the instant between them
  is not prevented. The check covers the realistic case: a window acting on an
  old copy before the other window's storage event reaches it.
- Restoring a backup aborts if the current data can't be read; a failed read is
  never treated as an empty phone.

The mobility log and cardio follow the same rules. In particular:

- Backup files and safety copies are the whole saved object, so they include
  `moveLog`, every run with its route, and any session in progress. Nothing
  about them is stored anywhere else.
- A failed save never drops work in progress: a routine's sheet stays open with
  its ticks and notes, the cardio form stays open with its timer still paused,
  and a GPS run stays in progress. None of them shows a success message.
- GPS points recorded since the last 10-second save exist only in memory. While
  that is so, `unsaved` is true, which makes the other-window check keep this
  window's copy (reason `other-window`) before it reloads. The run then comes
  back paused from what was saved; the copy is not merged in automatically.
- Leaving the app (`visibilitychange` to hidden) saves a GPS run at once.
- Restoring a backup that holds an unpaused GPS run brings it back paused.
- In recovery mode nothing can be started or saved, including runs, timers and
  routines, because `commit()` fails. That is intended.
- Deleting a run, only its route, or a mobility entry goes through `commit()`
  and changes that one record only.

## Cardio: limits of a web app

Don't promise or "fix" these. They are limits of a web page with no backend.

Location privacy: GPS positions are rounded to 5 decimal places (about 1 m),
kept in `localStorage`, and leave the phone only inside a backup file or safety
copy the owner exports. The backup screen says the file shows where he runs.
`cardio.js` makes no network requests and builds no links from coordinates.

- GPS stops when the phone is locked or another app is in front, on Android
  Chrome and iPhone Safari alike. A GPS run keeps the screen awake with the
  Screen Wake Lock API, and the in-app "Lock screen" stops pocket touches.
  Background tracking needs a native app.
- The wake lock can be refused even where the API exists: iPhone Safari has it
  from iOS 16.4, but apps added to the Home Screen only got a working one in
  iOS 18.4. So the run screen shows a warning whenever the API is missing *or* a
  request was refused (`wakeRefused`), telling the owner to lengthen the phone's
  screen timeout. Keep that check on the request's result, not on the API existing.
- A run is not paused automatically when the app goes to the background. The
  clock keeps running, the missing time is recorded in `gapSecs` and shown, and
  the distance across the gap is the straight line between the fixes on either
  side (the least that was covered). If the position didn't change, the gap
  counts as standing still. If the browser closes the app instead, the run comes
  back paused at its last recorded point.
- No street map and no directions. The route is drawn as an SVG from the
  recorded points on a plain background, with a scale bar and north up. A real
  map needs online tiles (which would be sent the user's position) or a map
  database far too large for this app; routing needs a road graph on top.
- Location and motion permission are requested only when a GPS run is started
  or resumed, never at startup. Where the browser has
  `DeviceMotionEvent.requestPermission` (iPhone Safari does) it is called from
  that tap; if it is refused the run works without steps.
- There is no step-counter API. During a GPS run, steps are counted from the
  motion sensor (`devicemotion`) and saved only when the count works out to
  60 to 210 steps a minute over the moving time; otherwise `steps` is `null`
  and the screen shows a dash. Never fill a missing count with a number derived
  from pace. Steps are labelled "est.".
- "Back to start" is the straight-line distance and compass direction to the
  first recorded point, with a dashed line on the route drawing. It is not
  navigation and the screen says so.
- GPS filtering (constants at the top of `cardio.js`): fixes worse than 35 m
  are not recorded; movement smaller than 5 m, or half the fix's accuracy if
  that is larger, is treated as jitter; anything faster than 8 m/s is a jump and
  is dropped; no progress for 15 s followed by less than 0.5 m/s counts as
  standing still and is left out of moving time.
- Tested only in desktop Chrome at 390 px with simulated GPS and simulated
  motion events. Nothing here has run on a physical phone. Time to first fix,
  drift between buildings, battery use, the wake lock on iPhone, and whether the
  step thresholds suit a phone in a pocket or armband are all unverified until
  the owner tries them. The step thresholds in `onMotion` are a first guess.

## Built-in data accuracy

- `data/routines.js` moves need a wall, a bench, the floor or nothing. Every
  move has step-by-step instructions (`how`), mistakes and safety (`avoid`),
  what it works, equipment and a dose. Warm-up routines contain no held
  stretches; those belong in Cooldown. It is general exercise guidance: it must
  never claim to fix posture, cure pain or treat an injury.
- Cardio calories use the ACSM walking and running equations (with treadmill
  incline as grade, 0 outdoors) and the latest weigh-in. They are labelled
  "est." everywhere and must stay that way. No weigh-in means no number, not a guess.
- `data/exercises.js` is limited to the owner's gym equipment: dumbbells, cable
  machine, bench press, lat pulldown, leg press, hack squat machine, leg
  extension, barbells, T-bar row.
- `data/foods.js` uses typical USDA FoodData Central values for generic foods.
  Entries marked `est: true` (Filipino dishes, branded items) are estimates and
  the app says so. A review should flag any value that is clearly wrong.

## Scope

In the app now: A/B/C rotation, logging weight × reps per set, last session's
numbers and an "add weight" hint, swap to an alternative mid-workout, rest
timer, running workout clock, exercise library with search by muscle group,
form cues, alternatives and video link, warm-up, mobility, posture and cooldown
moves, ten routines to start, tick off and save, a mobility log with duration
and notes, cardio (outdoor GPS runs and walks with distance, moving and elapsed time,
current and average pace and speed, the route drawn on the phone, a straight-line
back-to-start guide, an estimated step count, pause, resume and a touch lock; a timer and by-hand entry for the treadmill with distance,
time, speed and incline; estimated calories), body-weight log with 7-day average and
chart, food log with built-in foods, own foods, daily totals and targets,
history by workout, by exercise, for mobility and for cardio, program editor, JSON backup and restore.

Not planned unless the owner asks: background GPS, heart rate, a street map or
turn-by-turn directions (see the cardio limits above), accounts or sync, social features, AI
coaching, notifications, micronutrients, barcode scanning.

## How the AIs work together

- One AI changes code at a time, in small commits.
- Once the owner has real data in the app, any change to saved data (data
  model, `migrate()`, `STORAGE_KEY`, ids or names in `data/`) goes on its own
  branch and is reviewed before it is merged to main. Main is what the phone runs.
- The other AI reviews against this file. Each review point names the file, the
  problem, why it matters, and the fix. Data-loss risks go first.
- Style preferences aren't review points unless they break a rule above.
- Before merging, the owner checks the change on his phone.
