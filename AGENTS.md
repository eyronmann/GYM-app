# AGENTS.md: rules for anyone (AI or human) changing this app

Read this whole file before writing code or a review. The owner, Eyron, decides
what gets built. When two suggestions conflict, the one that makes logging at
the gym faster, or keeps the user's data safer, wins.

## What this is

A workout, body-weight and food logger for **one person**, used on a phone,
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
| `data/exercises.js` | Built-in exercise library (`window.EXERCISES`): name, muscle group, equipment, form cues, alternatives |
| `data/foods.js` | Built-in food list (`window.FOODS`): per-serving calories, protein, carbs, fat |
| `sw.js` | Offline cache (cache first, refresh in background) |
| `manifest.webmanifest`, `icons/` | Home-screen install |

Tabs: Today (workout), Exercises (library), Body (weight and food), History,
More (program, backup and settings).

## Data model (`localStorage["gymlog.v1"]`, version 2)

```js
{
  version: 2,
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
  lastBackupAt: null | ISO date,
  installTipDismissed: false
}
```

- Exercise history is matched by `key` (lower-cased name), so the same exercise in
  two workouts shares one history. The library is linked the same way: an
  exercise gets cues and alternatives when its name matches a library name.
- Food log entries copy the food's numbers so editing or deleting a food never
  changes past days.

## Built-in data accuracy

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
form cues, alternatives and video link, body-weight log with 7-day average and
chart, food log with built-in foods, own foods, daily totals and targets,
history by workout and by exercise, program editor, JSON backup and restore.

Not planned unless the owner asks: accounts or sync, social features, AI
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
