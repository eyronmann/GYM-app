# Gym Log

My own workout logger. It runs on my phone, works with no signal, and keeps
everything on the phone.

## What it does

- Rotates through my workouts (A, then B, then C) and shows which one is next.
- While I log a set, shows what I did last time for that exercise.
- Tells me when I hit every rep last time, so I know to add weight.
- Fills in the weight and reps from my previous set or last session. One tap on
  ✓ logs it, and the rest timer starts.
- Keeps a history by workout and by exercise, with my best set.
- Lets me edit my program in the Program tab.
- Exports a backup file and restores from one.

## Install it on my phone

Open the GitHub Pages link on the phone, then:

- **Android (Chrome):** menu ⋮ → **Add to Home screen** or **Install app**.
- **iPhone (Safari):** Share → **Add to Home Screen**. Install before logging.
  The installed app keeps its data separate from Safari.

After the first open it works offline.

## Back up

Everything lives on the phone only. Clearing browser data, uninstalling the
app or losing the phone erases it. Go to **Backup → Send backup to Drive** at
least every two weeks. The app reminds me when a backup is overdue.

To restore, use **Backup → Restore from a backup file** and pick the `.json` file.

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
