# AGENTS.md: rules for anyone (AI or human) changing this app

Read this whole file before writing code or a review. The owner, Eyron, decides
what gets built. When two suggestions conflict, the one that makes logging at
the gym faster, or keeps workout data safer, wins.

## What this is

A workout logger for **one person**, used on a phone **at the gym**, often with
poor signal. It is an installable web app (PWA) hosted as static files on
GitHub Pages.

## Hard rules

1. **No backend.** No server, no database server, no Firebase, no API, no login.
   Data lives in the phone's `localStorage`. The only off-phone copy is the JSON
   backup file the user exports.
2. **No framework, no build step, no package.json.** Plain HTML, CSS and
   JavaScript that run as-is. The owner must be able to read and edit them.
3. **Works offline.** No CDN links, web fonts or remote scripts. Everything the
   app needs is in this repo and listed in `sw.js`.
4. **Never lose workout data.** This outranks every other rule:
   - Do not rename `STORAGE_KEY` or rename/remove fields in saved data.
   - Any change to the data shape goes through `migrate()` in `app.js`, and
     `DATA_VERSION` goes up by one. Old backups must still import.
   - Never write over saved data the app failed to read.
5. **Offline cache:** when you add, rename or remove a file the app loads,
   update `APP_FILES` and bump `CACHE_NAME` in `sw.js`.
6. **Phone first.** Test at 390 px wide. Tap targets at least 44 px. Inputs use
   16 px text or iPhones zoom in.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell: top bar, main view, rest-timer bar, tab bar |
| `styles.css` | All styling. Colours are CSS variables at the top |
| `app.js` | All logic: data, rotation, logging, rest timer, history, program editor, backup |
| `sw.js` | Offline cache (cache first, refresh in background) |
| `manifest.webmanifest`, `icons/` | Home-screen install |

## Data model (`localStorage["gymlog.v1"]`)

```js
{
  version: 1,
  settings: { unit: 'kg', restSeconds: 90, restSound: true, keepAwake: true },
  program: [                       // order = rotation order (A, B, C, ...)
    { id, name, exercises: [ { id, name, sets: 3, reps: '8-12' } ] }
  ],
  sessions: [                      // finished workouts, oldest first
    { id, workoutId, label: 'A', name, startedAt, finishedAt,
      entries: [ { key, name, targetSets, targetReps,
                   sets: [ { w: 100, r: 6 } ] } ] }   // w is null for bodyweight
  ],
  active: null | { ...in-progress workout; set values are strings while typing },
  lastBackupAt: null | ISO date,
  installTipDismissed: false
}
```

Exercise history is matched by `key` (lower-cased name), so the same exercise in
two workouts shares one history.

## Scope

In v1: A/B/C rotation, logging weight × reps per set, last session's numbers and
an "add weight" hint per exercise, rest timer, history (by workout and by
exercise), program editor, JSON backup and restore, settings.

Not in v1 unless the owner asks: nutrition or macros, charts, body-weight
tracking, accounts or sync, social features, AI coaching, notifications.

## How the AIs work together

- One AI changes code at a time, on its own branch, in small commits.
- The other reviews against this file. Each review point names the file, the
  problem, why it matters, and the fix. Data-loss risks go first.
- Style preferences aren't review points unless they break a rule above.
- Before merging, the owner checks the change on his phone.
