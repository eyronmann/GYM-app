# Gym Log

My own workout, body-weight and food logger. It runs on my phone, works with
no signal, and keeps everything on the phone.

## What it does

**Today**
- Rotates through my workouts (A, then B, then C) and shows which one is next.
- While I log a set, shows what I did last time for that exercise.
- Tells me when I hit every rep last time, so I know to add weight.
- Fills in the weight and reps from my previous set or last session. One tap on
  ✓ logs it, and the rest timer starts. A clock shows how long I've been training.
- **Swap** replaces an exercise with an alternative when a machine is taken.

**Cardio** (Today → Cardio)
- **Outdoors, GPS:** tracks distance, moving and elapsed time, current and
  average pace and speed, and draws my route. Pause, resume, finish.
- **The screen must stay on with the app open.** A locked phone stops the
  tracking. Tap **Lock screen** before pocketing the phone. If the phone won't
  let the app keep the screen on (iPhones before iOS 18.4, in the Home Screen
  app), the run screen warns me to lengthen the screen timeout first.
- There is no street map and there are no directions: the route is drawn on a
  plain background, with the straight-line distance and direction back to where
  I started. My location is never sent anywhere.
- Steps are an estimate from the phone's movement and only show when the phone
  is on my body. If the count isn't believable, none is saved.
- **Treadmill:** start a timer and enter the distance at the end, or add a
  session by hand: distance or speed, time, and incline.
- Shows pace (min/km), speed (km/h) and estimated calories. Calories are an
  estimate (ACSM equations and my latest weigh-in), off by 10 to 20 percent.

**Exercises**
- About 50 exercises for my gym's equipment, searchable and filtered by muscle
  group (legs, chest, back, shoulders, arms, core).
- Each one has form cues, alternatives, a link to form videos, my last and best
  numbers, and buttons to add it to a workout.
- **Mobility & posture:** 46 warm-up, mobility, posture and cooldown moves, each
  with steps, what to avoid, what it needs and alternatives. Filter by type and
  by body area (neck and shoulders, upper back, hips, ankles, wrists, lower body).
- Ten routines I can start, tick off and save: warm-ups and cooldowns for
  full-body, upper-body, lower-body and running days, plus posture and mobility.
  Today offers the warm-up and cooldown that match the next workout.
- I can also log a single move with minutes and notes. This is general exercise
  guidance, not medical advice.

**Body**
- Weight: one weigh-in per day, the 7-day average, the change from the week
  before, and a 60-day chart.
- Food: search built-in foods (including Filipino dishes, and Tagalog names like
  *kanin* or *itlog*), pick how many servings, and see calories, protein, carbs
  and fat. Add my own foods from labels. Daily totals against my targets.

**History** keeps every workout, each exercise's best set, my mobility log and my cardio sessions.
**More** has my program editor, backup and settings.

## Install it on my phone

Open the GitHub Pages link on the phone, then:

- **Android (Chrome):** menu ⋮ → **Add to Home screen** or **Install app**.
- **iPhone (Safari):** Share → **Add to Home Screen**. Install before logging.
  The installed app keeps its data separate from Safari.

After the first open it works offline.

## Back up

Everything lives on the phone only. Clearing browser data, uninstalling the
app or losing the phone erases it. Go to **More → Backup and settings → Send backup to Drive** at
least every two weeks. The app reminds me when a backup is overdue.

To restore, use **More → Backup and settings → Restore from a backup file** and pick the `.json` file.

## Changing the app

The rules are in [AGENTS.md](AGENTS.md). Any AI working on this repo reads it first.

1. Ask one AI (Claude or ChatGPT) for a change.
2. Have the other one review it against AGENTS.md.
3. Try it on my phone before merging.

## Run it on my computer

The service worker needs a real web address, so opening `index.html` directly
won't fully work. From this folder:

```
python -m http.server 8000
```

Then open http://localhost:8000.
