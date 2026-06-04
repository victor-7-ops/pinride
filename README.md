# PinRide 📍

**Share your taxi destination with a QR code. Built in Cebu City.**

PinRide is a tiny, install-free Progressive Web App that lets a walk-in taxi
passenger hand their *exact* destination to a driver — no typing addresses,
no spelling out landmarks, no "do you know where X is?" back-and-forth.

The passenger pins a spot on a map, the app turns it into a QR code, the
driver scans it with their phone, and it opens the location in Google Maps
or Waze. That's the whole product.

## The problem it addresses

Explaining a destination to a taxi driver is error-prone: place names are
ambiguous, spelling is hard across languages, and verbal directions get lost.
PinRide removes the **typing and communication step** — the passenger picks
the exact coordinate and the driver gets it on their map in one scan.

## What it does *not* do (honest scope)

- It is **not** a ride-hailing service. It doesn't book cars, set fares, or track trips.
- It does **not** provide navigation itself. Turn-by-turn routing happens in the
  driver's own map app (Google Maps / Waze).
- It does **not** guarantee offline navigation. Offline routing only works if the
  driver has already downloaded offline maps in their map app. PinRide's offline
  support is limited to opening the app shell — loading map tiles and searching
  places still need a connection.

## Core flow

1. **Passenger** opens the app, searches or taps the map to drop a destination pin
   (or picks a Cebu landmark chip).
2. App generates a **QR code** encoding `LAT|LNG|LOCATION_NAME`.
3. **Driver** opens the Driver page and scans the QR with their phone camera.
4. Driver taps **Open in Google Maps** or **Open in Waze** → exact location opens.

No accounts. No app install. No backend.

## Tech stack

- **HTML, CSS, Vanilla JavaScript** — no frameworks
- **Leaflet.js + OpenStreetMap** tiles (free, no API key)
- **qrcode.js** for QR generation
- **html5-qrcode** for camera-based QR scanning
- **Nominatim** for place search (geocoding)
- **PWA**: manifest + service worker (app-shell caching, best-effort tile caching)
- **Vercel** static hosting (zero config, zero cost)

There is no backend, database, or API key. The only network calls are to
OpenStreetMap (tiles) and Nominatim (search) — and QR codes decode entirely
on the driver's device.

## File structure

```
pinride/
├── index.html          # Passenger page
├── driver.html         # Driver page
├── offline.html        # Offline fallback
├── manifest.json
├── service-worker.js
├── vercel.json
├── css/style.css
├── js/
│   ├── passenger.js     # map, search, QR generation, voice
│   └── driver.js        # QR scanning, deep links
└── icons/               # icon-192.png, icon-512.png
```

## Run it locally

The app uses a service worker and the camera, both of which require a secure
context. `localhost` counts as secure, so any static server works:

```bash
# Python 3
python -m http.server 8080

# or Node
npx serve .
```

Then open <http://localhost:8080>. The driver scanner needs camera permission,
which browsers only grant over `https://` or `localhost`.

> Tip: to test the full passenger → driver flow on one machine, generate a QR
> on the passenger page, then point a second device's camera (on the Driver
> page) at the screen.

## Running tests

Open `http://localhost:8080/tests/` after starting the local server. The page runs
geohash round-trip tests and payload parse/validate tests in-browser with a green/red
pass-fail table. All rows should be green before deploying.

## Deploy to Vercel

This is a static site — no build step.

1. Install the CLI: `npm i -g vercel`
2. From the `pinride/` directory, run `vercel` and follow the prompts.
3. For production: `vercel --prod`.

Or connect the repo in the Vercel dashboard and deploy on push. The included
`vercel.json` rewrites `/driver` → `/driver.html` for a clean URL.

## Manual device checklist

Run these on a real device before deploying to real users:

- [ ] Android low-end device: scan works in under 3 seconds
- [ ] Scan in direct sunlight with torch toggle (Android)
- [ ] Deny camera permission: correct error shown + typed-code link visible
- [ ] Airplane mode: offline banner visible, landmark chips work, search shows offline message, map overlay appears
- [ ] Typed-code: copy code from passenger modal, type on driver page, pin appears correctly with "Typed location"
- [ ] Download QR: image saves to camera roll / downloads folder
- [ ] Add to Home Screen (Android Chrome + iOS Safari): app launches in standalone mode

## Roadmap / Future ideas

These are **later phases**, not current features:

- **Multilingual support** — Cebuano/Tagalog UI alongside English.
- **Auto-location detection** — center the map on the passenger's GPS position.
- **Country-specific map apps** — offer Grab, Apple Maps, or other regional
  navigation apps in the driver deep-link list.

---

*PinRide — Share your taxi destination with a QR code. Built in Cebu City.*
