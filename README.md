# PinRide

**Share your taxi destination with a QR code. Built in Cebu City.**

PinRide is a tiny, install-free Progressive Web App that lets a walk-in taxi passenger hand their exact destination to a driver — no typing addresses, no spelling out landmarks, no "do you know where X is?" back-and-forth.

The passenger pins a spot on a map, the app turns it into a QR code, the driver scans it with their phone, and it opens the location in Google Maps or Waze. That's the whole product.

## The problem it addresses

Explaining a destination to a taxi driver is error-prone: place names are ambiguous, spelling is hard across languages, and verbal directions get lost. PinRide removes the **typing and communication step** — the passenger picks the exact coordinate and the driver gets it on their map in one scan.

## What it does *not* do

- It is **not** a ride-hailing service. It doesn't book cars, set fares, or track trips.
- It does **not** provide navigation itself. Turn-by-turn routing happens in the driver's own map app (Google Maps / Waze).
- It does **not** guarantee offline navigation. Offline routing only works if the driver has already downloaded offline maps in their map app.

## Core flow

1. **Passenger** opens the app, searches or taps the map to drop a destination pin (or picks a Cebu landmark chip).
2. App generates a **QR code** encoding `PINRIDE1|LAT|LNG|LOCATION_NAME`.
3. **Driver** opens the Driver page and scans the QR with their phone camera.
4. Driver taps **Open in Google Maps** or **Open in Waze** → exact location opens.

No accounts. No app install. No backend.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| UI | HTML + CSS + Vanilla JS | No framework = no bundle, instant load |
| Map | Leaflet.js + OpenStreetMap | Free, no API key |
| Geocoding | Nominatim | Free, no API key |
| QR generation | qrcode.js | CDN, no key |
| QR scanning | html5-qrcode | Camera access, CDN |
| Coordinates fallback | Custom geohash-9 | Pure JS, no deps |
| Hosting | Vercel | Zero config, zero cost |
| Offline | Service Worker | App-shell cache |

## Design system (v2)

The UI uses a two-tone role differentiation approach:

- **Passenger page** — light (`#F8FAFC` background), white surfaces, orange accent
- **Driver page** — deep dark (`#0C1220` background), layered dark surfaces

All icons are inline SVG (Lucide-style) — no emoji used as structural icons. Design tokens are CSS custom properties defined in `:root`.

Key tokens:
```css
--orange: #F97316        /* brand accent */
--shadow-btn: 0 4px 14px rgba(249,115,22,.4)
--d-bg: #0C1220          /* driver dark background */
--radius: 14px
--tap: 48px              /* minimum touch target height */
```

## File structure

```
pinride/
├── index.html          # Passenger page
├── driver.html         # Driver page
├── offline.html        # Offline fallback
├── manifest.json
├── service-worker.js
├── vercel.json
├── css/style.css       # Design system + all styles
├── js/
│   ├── geohash.js      # Pure encode/decode/validate
│   ├── passenger.js    # Map, search, QR generation, voice
│   └── driver.js       # QR scanning, typed-code, deep links
├── tests/
│   └── index.html      # In-browser test runner
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Run locally

The app uses a service worker and camera, both of which require a secure context. `localhost` counts as secure:

```bash
# Python 3
python -m http.server 8080

# or Node
npx serve .
```

Open <http://localhost:8080>. The driver scanner needs camera permission, which browsers only grant over `https://` or `localhost`.

> **Testing the full flow on one device:** generate a QR on the passenger page, then point a second device's camera (on the Driver page) at the screen.

## Running tests

Open `http://localhost:8080/tests/` after starting the local server. The page runs geohash round-trip tests and payload parse/validate tests in-browser. All 19 rows should be green before deploying.

## Deploy to Vercel

This is a static site — no build step.

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

Or connect the repo in the Vercel dashboard for auto-deploy on push. The included `vercel.json` rewrites `/driver` → `/driver.html` for clean URLs.

## Manual device checklist

- [ ] Android low-end device: scan works in under 3 seconds
- [ ] Scan in direct sunlight with torch toggle (Android)
- [ ] Deny camera permission: correct error shown + typed-code link visible
- [ ] Airplane mode: offline banner, landmark chips, map overlay all correct
- [ ] Typed-code: copy from passenger modal → type on driver page → pin appears
- [ ] Download QR: saves to downloads / camera roll
- [ ] Add to Home Screen (Android Chrome + iOS Safari): standalone mode

## Roadmap

- **Multilingual** — Cebuano / Tagalog UI
- **Auto-location** — center map on passenger's GPS position
- **More map apps** — Grab, Apple Maps, regional navigation options
- **Shareable link** — encode destination in URL so driver can open without scanning

---

*PinRide — Share your taxi destination with a QR code. Built in Cebu City.*
