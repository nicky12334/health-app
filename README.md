# Nutrition Tracker

A personal food/nutrition tracker that runs as a **Progressive Web App (PWA)** — built
to install on an iPhone home screen, but it works in any modern browser. Developed
entirely on Linux; no Mac or App Store required.

## Features

- **Macros + micronutrients** — calories, protein, carbs, fat, plus sugars, fiber,
  saturated fat, sodium, salt, and vitamins/minerals when the product reports them.
- **Barcode scanning** — point the camera at a product; nutrition is pulled from the free
  [Open Food Facts](https://world.openfoodfacts.org) database.
- **Quick add** — type amounts fast: `+20 protein`, `+100 cal`, `30g carbs`, `10g fat`
  (combine several in one line). Calories are derived from macros when not given.
- **Additive + processing tracking** — counts additives (E-numbers) per day and flags
  the NOVA ultra-processing level.
- **Daily goal + progress bars** — a calorie/macro goal is calculated from your body
  stats (Mifflin–St Jeor → activity → weight goal), with live progress bars.
- **History** — every day is saved on-device and listed with its totals.

All data is stored locally on the device (`localStorage`). There is no server and nothing
leaves the phone except anonymous barcode lookups to Open Food Facts.

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 on the same computer. Quick-add, goals, history and
persistence all work here. **Barcode scanning needs the camera**, which browsers only
allow over HTTPS or on `localhost` — so to scan with your phone, use one of the options
below.

## Use it on your iPhone

The camera requires a secure (HTTPS) origin. Two easy ways:

### Option A — deploy (recommended, free, permanent)

```bash
npm run build      # outputs static files to dist/
```

Upload `dist/` to any free static host — **Netlify**, **Vercel**, or **GitHub Pages**.
They all serve HTTPS automatically. Then on the iPhone:

1. Open the site's URL in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Launch it from the new icon — it runs full-screen like a native app.

### Option B — quick test over a tunnel

```bash
npm run dev
npx ngrok http 5173     # gives you a temporary https URL
```

Open the `https://…ngrok…` URL in Safari on the phone and grant camera permission.

## How the goal is calculated

Mifflin–St Jeor BMR → multiplied by an activity factor (TDEE) → adjusted for your goal
(lose ≈ −500 kcal, maintain = 0, gain ≈ +400 kcal). Macro targets default to ~1.8 g/kg
protein, 25% of calories from fat, and the rest carbs. Set your stats on the **Profile**
screen.

## Project layout

```
index.html            app shell + bottom nav
vite.config.js        Vite + PWA (manifest, service worker)
src/
  main.js             navigation, scanner lifecycle, wiring
  profile.js          BMR/TDEE/goal + macro targets
  storage.js          per-day log in localStorage; totals & history
  nutrition.js        Open Food Facts lookup + scaling
  additives.js        E-number names + NOVA labels
  quickadd.js         "+20 protein" style parser
  scanner.js          ZXing camera barcode scanning
  ui.js               screen rendering (Today / Scan / History / Profile)
  style.css           mobile-first dark theme
```

## Notes

- Open Food Facts coverage is large but not total, and micronutrient/additive fields vary
  per product — the quick-add path covers anything missing.
- Additive flags are informational (presence + NOVA group from Open Food Facts), not
  medical or dietary advice.
- To later ship to the App Store, this can be wrapped with **Capacitor** or **Expo**
  without rewriting the core logic.
