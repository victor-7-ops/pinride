# PinRide MVP Hardening — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Harden the existing PinRide MVP for real-user deployment in Cebu City.

---

## Background

PinRide's happy path (pin → QR → scan → navigate) is verified working. This spec covers everything around it: payload robustness, a manual-code fallback when scanning fails, scanner resilience, edge-case data, offline honesty, and a lightweight test harness.

Out of scope for this pass: shareable links, accounts, analytics, multilingual support, ride-hailing features.

---

## 1. QR Payload Robustness

### Problem
The current payload format `LAT|LNG|NAME` has no version marker, no validation on decode, and a `|` in the location name would break parsing.

### Design

**New format:** `PINRIDE1|LAT|LNG|NAME`

- `PINRIDE1` is a magic prefix that identifies valid PinRide QR codes and encodes format version 1.
- Parse by splitting on `|` into **at most 4 parts**: `[prefix, lat, lng, name]`. Anything after the third `|` is part of the name — pipes in place names survive.
- Driver page rejects any payload where `parts[0] !== 'PINRIDE1'` with the message: *"That QR code isn't from PinRide."*
- Lat/lng are validated as finite numbers inside a permissive bounding box (Philippines-wide: lat 4–21, lng 116–127). Out-of-range values show an error rather than silently pinning the wrong hemisphere.
- Name is trimmed and capped at 80 characters for display safety.

**Passenger `js/passenger.js`:** update `generateQR()` to prepend `PINRIDE1|` to the payload.
**Driver `js/driver.js`:** update `parsePayload()` with the new split logic and validation.

---

## 2. Manual Code Fallback

### Problem
When scanning fails (camera permission denied, glare, no camera, low-end hardware), there is currently no alternative path. The driver is stuck.

### Design

A **geohash-9 code** (base-32, 9 characters, ~5 m precision) self-encodes the coordinate offline without a backend. The tradeoff: geohash carries coordinates only, not the location name. When a driver uses the typed path, the result screen shows the pin correctly but labels it *"Typed location"* rather than the friendly name. This is acceptable degradation — the navigation destination is correct.

**New file: `js/geohash.js`**
- `encode(lat, lng, precision=9) → string`
- `decode(hash) → { lat, lng, error: { lat, lng } }`
- Pure JS, no dependencies, ~50 lines. Shared by both pages via `<script>` tag.

**Passenger page changes:**
- QR modal gains a second row below the QR image: `Code: [XXXXXXXXX]` in large monospace, plus a "Copy code" button (uses `navigator.clipboard.writeText`, falls back to a `<textarea>` select-and-copy).
- Hint text: *"No scanner? Read out this code to your driver."*

**Driver page changes:**
- Below the scanner and the cancel button, a small text link: **"Can't scan? Type the code instead →"**
- Clicking reveals: a single input (monospace, maxlength=9, autocorrect/autocapitalize off) and a "Go" button.
- On submit: validate it's a valid geohash-9, decode, call `showResult()` with the decoded lat/lng and name `'Typed location'`.
- Invalid code shows: *"That doesn't look right — codes are 9 letters and numbers."*

---

## 3. Scanner & Camera Resilience

### Problem
Camera failures produce a generic error; there is no flashlight for dim conditions; passengers don't know to raise screen brightness.

### Design

**Specific error messages on the driver page:**

| Condition | Message shown |
|---|---|
| Permission denied | "Allow camera access in your browser settings, then tap Scan again." |
| No camera / hardware error | "No camera found. Use 'Type the code' below instead." |
| Not-secure-context (`http://` non-localhost) | "Camera requires a secure connection (https). Try the typed code." |
| Generic / unknown | "Couldn't open the camera. Try the typed code below." |

Each message is followed by a visible link to the typed-code input (scrolls into view).

**Torch/flashlight toggle:**
- After the scanner starts, check `track.getCapabilities().torch`. If supported, show a 🔦 toggle button above the scanner viewfinder.
- On toggle: `track.applyConstraints({ advanced: [{ torch: true/false }] })`.
- If `getCapabilities` is absent (unsupported), the button stays hidden.

**Passenger brightness nudge:**
- One-line hint above the QR image in the modal: *"Tip: turn your screen brightness up for easier scanning."*

---

## 4. Edge-Case Data & Geocoding

### Problem
Several silent failure modes exist: stuck search spinners, coordinates pinned outside Cebu, Nominatim down.

### Design

**Out-of-metro-Cebu guard (non-blocking):**
- Define a soft bounding box for metro Cebu: lat 9.9–10.6, lng 123.6–124.1.
- After a pin is set (click, chip, or search result), if the coordinate is outside this box, show a dismissible inline note below the selected card: *"That looks outside Cebu City — still okay to use."*
- No blocking. The user can proceed. This guards against accidental map taps in distant areas.

**Search states (explicit):**
- `Searching…` — existing spinner text, unchanged.
- `No places found` — shown when Nominatim returns an empty array.
- `Search unavailable — tap the map to drop a pin instead` — shown on network error or non-200 response.
- After any failure, the spinner/results area never stays in a frozen state. A `finally` block always clears the loading state.

**Rate-limit guard:**
- Existing 1-req/sec debounce is kept. No change needed.

---

## 5. Offline Honesty

### Problem
When offline, tiles and search fail silently — the map is blank and the search input does nothing.

### Design

The existing offline banner is kept. Two additions:

**Map tile overlay:**
- When the page loads offline (or `offline` event fires), and if the tile layer reports errors, show a centred overlay inside the `#map` div: *"Map tiles need internet to load. You can still drop a pin at the last known location."*
- The overlay dismisses when the `online` event fires.

**Search input guard:**
- When offline, tapping the search button shows inline text: *"Search needs internet. Tap the map to drop a pin, or pick a landmark below."*
- The landmark chips still work offline (coordinates are hardcoded).

---

## 6. Testing

### Design

**`tests/index.html` — in-browser test runner:**

A single self-contained HTML page (no framework) with inline JS that:
1. Runs geohash round-trip tests: encode → decode → verify lat/lng are within the precision error.
2. Runs payload parse/validate tests: valid payloads, pipe-in-name, missing prefix, bad coordinates, empty name.
3. Prints a pass/fail table in the browser. Green = pass, red = fail.

The page is linked from the README under "Running tests".

**Manual device checklist (added to README):**

```
[ ] Android low-end device: scan works in <3 sec
[ ] Scan in direct sunlight with torch toggle
[ ] Deny camera permission: correct error + typed-code link visible
[ ] Airplane mode: offline banner visible, landmark chips work, search shows error
[ ] Typed-code: encode from passenger, type on driver, pin appears correctly
[ ] Download QR: image saves to camera roll
[ ] Add to Home Screen (Android Chrome + iOS Safari): launches standalone
```

---

## File Changes Summary

| File | Change |
|---|---|
| `js/geohash.js` | New — pure geohash encode/decode |
| `js/passenger.js` | QR payload prefix; code display in modal; out-of-Cebu guard; offline search guard |
| `js/driver.js` | Payload parse with new format; typed-code input; specific camera errors; torch toggle |
| `css/style.css` | Styles for code display, typed-code input, map offline overlay, out-of-Cebu note |
| `index.html` | Add `geohash.js` script tag |
| `driver.html` | Add `geohash.js` script tag; typed-code DOM |
| `tests/index.html` | New — in-browser test runner |
| `README.md` | Manual device checklist; link to tests page |

No new external dependencies. The geohash encoder is hand-rolled.

---

## Open Questions / Non-Decisions

None. All ambiguous points have been resolved:
- Fallback mechanism: typed geohash code (not shareable link).
- Name in typed path: `'Typed location'` (geohash carries no name).
- Out-of-Cebu guard: non-blocking note, not a hard block.
- Torch: feature-detected and hidden if unsupported.
