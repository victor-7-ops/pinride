# PinRide MVP Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the PinRide MVP for real-user deployment — robust QR payload format, manual-code fallback, scanner resilience, edge-case data guards, and honest offline states.

**Architecture:** All changes are pure client-side vanilla JS/HTML/CSS. A new shared `js/geohash.js` module provides encode/decode used by both pages. The QR payload gains a `PINRIDE1|` prefix and stricter parse/validate. The driver page gains a typed-code input path when scanning fails. An in-browser test runner at `tests/index.html` covers the pure-logic pieces.

**Tech Stack:** Vanilla JS (ES2017, `'use strict'`), Leaflet 1.9, html5-qrcode 2.3, qrcode.js 1.0, OpenStreetMap tiles, Nominatim geocoding. No build step — edit files and reload.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `js/geohash.js` | **Create** | Pure geohash encode/decode — no DOM, no dependencies |
| `js/passenger.js` | **Modify** | QR payload prefix; code row in modal; out-of-Cebu guard; offline search guard; map tile overlay |
| `js/driver.js` | **Modify** | New `parsePayload`; typed-code input; specific camera errors; torch toggle |
| `css/style.css` | **Modify** | Styles: geohash code row, typed-code input, map offline overlay, out-of-Cebu note |
| `index.html` | **Modify** | Add `<script src="js/geohash.js">` before `passenger.js`; add geohash code row to QR modal |
| `driver.html` | **Modify** | Add `<script src="js/geohash.js">` before `driver.js`; add typed-code DOM; add torch button |
| `tests/index.html` | **Create** | In-browser test runner for geohash and payload logic |
| `README.md` | **Modify** | Add manual device checklist; add link to tests page |

---

## Task 1: Create `js/geohash.js` — pure encode/decode

**Files:**
- Create: `js/geohash.js`
- Test: `tests/index.html` (written in Task 7, but this module is what gets tested)

- [ ] **Step 1: Create `js/geohash.js`** with the following complete content:

```js
// PinRide — geohash encode/decode (base-32, no dependencies)
'use strict';

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

function encode(lat, lng, precision = 9) {
  let idx = 0, bit = 0, evenBit = true, hash = '';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { idx = (idx << 1) | 1; minLng = mid; }
      else             { idx = (idx << 1) | 0; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { idx = (idx << 1) | 1; minLat = mid; }
      else            { idx = (idx << 1) | 0; maxLat = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) { hash += BASE32[idx]; bit = 0; idx = 0; }
  }
  return hash;
}

function decode(hash) {
  let evenBit = true;
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;

  for (let i = 0; i < hash.length; i++) {
    const chr = hash[i].toLowerCase();
    const idx = BASE32.indexOf(chr);
    if (idx === -1) throw new Error('Invalid geohash character: ' + chr);
    for (let bits = 4; bits >= 0; bits--) {
      const bitN = (idx >> bits) & 1;
      if (evenBit) {
        const mid = (minLng + maxLng) / 2;
        if (bitN === 1) minLng = mid; else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bitN === 1) minLat = mid; else maxLat = mid;
      }
      evenBit = !evenBit;
    }
  }
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    error: { lat: (maxLat - minLat) / 2, lng: (maxLng - minLng) / 2 },
  };
}

// Validate: 9-char geohash using only BASE32 characters
function isValidGeohash9(hash) {
  return typeof hash === 'string' && hash.length === 9 && /^[0-9bcdefghjkmnpqrstuvwxyz]+$/i.test(hash);
}
```

- [ ] **Step 2: Verify the file saved correctly**

Open `js/geohash.js` and confirm the three exported names are present: `encode`, `decode`, `isValidGeohash9`.

---

## Task 2: In-browser test runner — `tests/index.html`

Build the test page before touching production code so the geohash logic is verified first.

**Files:**
- Create: `tests/index.html`

- [ ] **Step 1: Create `tests/index.html`** with the following complete content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PinRide Tests</title>
  <style>
    body { font-family: monospace; padding: 24px; background: #0f172a; color: #e2e8f0; }
    h1 { color: #f97316; }
    table { border-collapse: collapse; width: 100%; margin-top: 16px; }
    th { text-align: left; padding: 8px 12px; background: #1e293b; }
    td { padding: 8px 12px; border-top: 1px solid #334155; }
    .pass { color: #4ade80; }
    .fail { color: #f87171; font-weight: bold; }
    #summary { margin-top: 16px; font-size: 1.1rem; }
  </style>
</head>
<body>
  <h1>PinRide — Tests</h1>
  <table>
    <thead><tr><th>Test</th><th>Result</th><th>Detail</th></tr></thead>
    <tbody id="results"></tbody>
  </table>
  <p id="summary"></p>

  <script src="../js/geohash.js"></script>
  <script>
    'use strict';

    const tbody = document.getElementById('results');
    let passed = 0, failed = 0;

    function assert(name, condition, detail = '') {
      const tr = document.createElement('tr');
      const ok = !!condition;
      if (ok) passed++; else failed++;
      tr.innerHTML = `<td>${name}</td><td class="${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</td><td>${detail}</td>`;
      tbody.appendChild(tr);
    }

    // ---- geohash round-trip tests ----
    (() => {
      const cases = [
        { name: 'SM City Cebu', lat: 10.311, lng: 123.918 },
        { name: 'Mactan Airport', lat: 10.3075, lng: 123.9794 },
        { name: 'Colon Street', lat: 10.2966, lng: 123.9000 },
      ];
      cases.forEach(({ name, lat, lng }) => {
        const hash = encode(lat, lng, 9);
        const { lat: dLat, lng: dLng, error } = decode(hash);
        const latOk = Math.abs(dLat - lat) <= error.lat + 1e-9;
        const lngOk = Math.abs(dLng - lng) <= error.lng + 1e-9;
        assert(
          `geohash round-trip: ${name}`,
          latOk && lngOk,
          `hash=${hash} dLat=${dLat.toFixed(7)} dLng=${dLng.toFixed(7)}`
        );
        assert(
          `geohash length=9: ${name}`,
          hash.length === 9,
          `got length ${hash.length}`
        );
      });
    })();

    (() => {
      // isValidGeohash9
      assert('isValidGeohash9: valid hash', isValidGeohash9('w3gv2xm9q'), '');
      assert('isValidGeohash9: too short', !isValidGeohash9('w3gv2xm'), '');
      assert('isValidGeohash9: invalid char (a)', !isValidGeohash9('w3gv2xmaa'), '');
      assert('isValidGeohash9: empty string', !isValidGeohash9(''), '');
      assert('isValidGeohash9: non-string', !isValidGeohash9(null), '');
    })();

    // ---- parsePayload tests (inline — matches driver.js logic after Task 3) ----
    function parsePayload(raw) {
      const parts = raw.split('|');
      if (parts.length < 4) return null;
      if (parts[0] !== 'PINRIDE1') return null;
      const lat = parseFloat(parts[1]);
      const lng = parseFloat(parts[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (lat < 4 || lat > 21 || lng < 116 || lng > 127) return null;
      const name = parts.slice(3).join('|').trim().slice(0, 80) || 'Scanned destination';
      return { lat, lng, name };
    }

    (() => {
      const valid = parsePayload('PINRIDE1|10.311|123.918|SM City Cebu');
      assert('parsePayload: valid', valid !== null && valid.lat === 10.311 && valid.name === 'SM City Cebu', JSON.stringify(valid));

      const pipeInName = parsePayload('PINRIDE1|10.311|123.918|Foo|Bar Baz');
      assert('parsePayload: pipe in name', pipeInName !== null && pipeInName.name === 'Foo|Bar Baz', JSON.stringify(pipeInName));

      assert('parsePayload: missing prefix', parsePayload('10.311|123.918|SM City Cebu') === null, '');
      assert('parsePayload: wrong prefix', parsePayload('PINRIDE2|10.311|123.918|SM') === null, '');
      assert('parsePayload: bad lat (NaN)', parsePayload('PINRIDE1|abc|123.918|SM') === null, '');
      assert('parsePayload: out of PH bbox', parsePayload('PINRIDE1|51.5|0.1|London') === null, '');
      assert('parsePayload: too few parts', parsePayload('PINRIDE1|10.311') === null, '');

      const longName = parsePayload('PINRIDE1|10.311|123.918|' + 'x'.repeat(100));
      assert('parsePayload: name capped at 80', longName !== null && longName.name.length === 80, `len=${longName?.name.length}`);
    })();

    document.getElementById('summary').textContent =
      `${passed + failed} tests — ${passed} passed, ${failed} failed.`;
    document.getElementById('summary').style.color = failed === 0 ? '#4ade80' : '#f87171';
  </script>
</body>
</html>
```

- [ ] **Step 2: Open `tests/index.html` in a browser and verify all tests pass**

Navigate to `http://localhost:8080/tests/` (or open the file directly). All rows should show green PASS. The geohash round-trip tests confirm the encoder is correct before any production code uses it.

Expected output: `N tests — N passed, 0 failed.` in green (where N ≥ 15).

- [ ] **Step 3: Commit**

```bash
git add js/geohash.js tests/index.html
git commit -m "feat: add geohash module and in-browser test runner"
```

---

## Task 3: Update `parsePayload` in `driver.js` — new format + validation

**Files:**
- Modify: `js/driver.js` — replace `parsePayload` function (lines 13–22)

- [ ] **Step 1: Replace the existing `parsePayload` function** (lines 13–22 of `js/driver.js`):

```js
function parsePayload(raw) {
  // Format: PINRIDE1|LAT|LNG|NAME  (split into max 4 to allow | in name)
  const parts = raw.split('|');
  if (parts.length < 4) return null;
  if (parts[0] !== 'PINRIDE1') return null;
  const lat = parseFloat(parts[1]);
  const lng = parseFloat(parts[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Philippines-wide bounding box
  if (lat < 4 || lat > 21 || lng < 116 || lng > 127) return null;
  const name = parts.slice(3).join('|').trim().slice(0, 80) || 'Scanned destination';
  return { lat, lng, name };
}
```

- [ ] **Step 2: Update `generateQR` in `passenger.js`** — prepend `PINRIDE1|` to the payload. Replace lines 141–156 of `js/passenger.js`:

```js
function generateQR() {
  if (!selected) return;
  const payload = `PINRIDE1|${selected.lat}|${selected.lng}|${selected.name}`;
  const canvas = document.getElementById('qr-canvas');
  canvas.innerHTML = '';
  new QRCode(canvas, {
    text: payload,
    width: 240,
    height: 240,
    colorDark: '#1E293B',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.M,
  });
  document.getElementById('qr-dest').textContent = selected.name;
  document.getElementById('qr-modal').hidden = false;
  // Show geohash code row
  const code = encode(selected.lat, selected.lng, 9);
  document.getElementById('qr-code-value').textContent = code;
  document.getElementById('qr-code-row').hidden = false;
}
```

- [ ] **Step 3: Verify end-to-end in browser**

1. Open `http://localhost:8080/index.html`, tap SM City Cebu chip, click Generate QR.
2. Open browser devtools → Application → QR canvas. The encoded text should start with `PINRIDE1|`.
3. Simulate a scan by running in console: `parsePayload('PINRIDE1|10.311|123.918|SM City Cebu')` on `driver.html` — should return `{ lat: 10.311, lng: 123.918, name: 'SM City Cebu' }`.
4. Run `parsePayload('10.311|123.918|SM City Cebu')` → should return `null`.

- [ ] **Step 4: Commit**

```bash
git add js/driver.js js/passenger.js
git commit -m "feat: PINRIDE1 payload prefix, strict parse/validate"
```

---

## Task 4: Add geohash code row to passenger QR modal

**Files:**
- Modify: `index.html` — add `geohash.js` script tag and code-row HTML
- Modify: `css/style.css` — add `.qr-code-row` styles
- Modify: `js/passenger.js` — `generateQR` already updated in Task 3; add `copyCode` handler

- [ ] **Step 1: Add `geohash.js` script tag to `index.html`**

In `index.html`, before the `<script src="js/passenger.js">` line, add:
```html
  <script src="js/geohash.js"></script>
```

- [ ] **Step 2: Add the code row HTML inside the QR modal** in `index.html`

After the `<div id="qr-canvas" class="qr-canvas"></div>` line, insert:
```html
      <p class="brightness-hint">Tip: turn your screen brightness up for easier scanning.</p>
      <div id="qr-code-row" class="qr-code-row" hidden>
        <span class="qr-code-label">Code:</span>
        <span id="qr-code-value" class="qr-code-value"></span>
        <button id="copy-code-btn" class="copy-code-btn" type="button">Copy</button>
      </div>
      <p class="qr-code-hint">No scanner? Read out this code to your driver.</p>
```

- [ ] **Step 3: Add styles to `css/style.css`**

Append at the end of the file:
```css
/* Geohash code row in QR modal */
.brightness-hint { color: var(--muted); font-size: 0.8rem; margin: 8px 0 4px; }
.qr-code-row { display: flex; align-items: center; gap: 8px; justify-content: center; margin: 8px 0; }
.qr-code-label { color: var(--muted); font-size: 0.82rem; }
.qr-code-value { font-family: 'Courier New', Courier, monospace; font-size: 1.3rem; font-weight: 700; letter-spacing: 0.1em; color: var(--navy); }
.copy-code-btn { border: 1px solid var(--border); background: var(--bg); font-family: inherit; font-size: 0.8rem; padding: 5px 10px; border-radius: 8px; cursor: pointer; }
.copy-code-btn.copied { background: #dcfce7; border-color: #4ade80; }
.qr-code-hint { color: var(--muted); font-size: 0.78rem; margin: 0 0 8px; }
```

- [ ] **Step 4: Add `copyCode` function and wire up button in `passenger.js`**

Add this function before the `// ---- Wire up ----` comment:
```js
function copyCode() {
  const val = document.getElementById('qr-code-value').textContent;
  const btn = document.getElementById('copy-code-btn');
  const finish = () => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 1500);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(val).then(finish).catch(() => fallbackCopy(val, finish));
  } else {
    fallbackCopy(val, finish);
  }
}

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); cb(); } catch (_) {}
  ta.remove();
}
```

In the `DOMContentLoaded` listener, add:
```js
  document.getElementById('copy-code-btn').addEventListener('click', copyCode);
```

- [ ] **Step 5: Verify in browser**

1. Generate a QR for any destination.
2. Confirm the modal now shows a 9-character monospace code below the QR.
3. Tap "Copy" — button should briefly show "Copied!" and the clipboard should contain the 9-char code.
4. Confirm the brightness hint line appears above the QR.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/passenger.js js/geohash.js
git commit -m "feat: show geohash code in QR modal with copy button"
```

---

## Task 5: Typed-code fallback on the driver page

**Files:**
- Modify: `driver.html` — add typed-code DOM and `geohash.js` script tag
- Modify: `js/driver.js` — add `submitTypedCode` and `showTypedCodeInput` functions
- Modify: `css/style.css` — add typed-code input styles

- [ ] **Step 1: Add DOM to `driver.html`**

After the `<button id="cancel-scan" ...>` line, add:
```html
      <div id="typed-code-row" class="typed-code-row">
        <button id="show-typed-btn" class="text-btn" type="button">Can't scan? Type the code instead →</button>
        <div id="typed-code-input-wrap" class="typed-code-input-wrap" hidden>
          <input id="typed-code-input" class="typed-code-input" type="text"
            inputmode="text" maxlength="9" autocorrect="off" autocapitalize="none"
            spellcheck="false" placeholder="e.g. w3gv2xm9q" aria-label="9-character destination code" />
          <button id="typed-code-go" class="primary-btn" type="button">Go</button>
        </div>
        <p id="typed-code-error" class="typed-code-error" hidden></p>
      </div>
```

Add `<script src="js/geohash.js"></script>` before `<script src="js/driver.js"></script>`.

- [ ] **Step 2: Add CSS to `css/style.css`**

Append at the end:
```css
/* Typed-code fallback (driver) */
.typed-code-row { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.typed-code-input-wrap { display: flex; gap: 8px; width: 100%; }
.typed-code-input {
  flex: 1;
  height: var(--tap);
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-family: 'Courier New', Courier, monospace;
  font-size: 1.2rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  background: var(--white);
  color: var(--navy);
}
.typed-code-input:focus { outline: 2px solid var(--orange); border-color: var(--orange); }
.typed-code-input-wrap .primary-btn { width: 72px; flex-shrink: 0; }
.typed-code-error { color: #FCA5A5; font-size: 0.88rem; text-align: center; }
```

- [ ] **Step 3: Add `showTypedCodeInput` and `submitTypedCode` to `driver.js`**

Add these functions after `resetScanUI`:
```js
function showTypedCodeInput() {
  document.getElementById('typed-code-input-wrap').hidden = false;
  document.getElementById('typed-code-input').focus();
}

function submitTypedCode() {
  const raw = document.getElementById('typed-code-input').value.trim().toLowerCase();
  const errEl = document.getElementById('typed-code-error');
  errEl.hidden = true;

  if (!isValidGeohash9(raw)) {
    errEl.textContent = "That doesn't look right — codes are 9 letters and numbers.";
    errEl.hidden = false;
    return;
  }
  try {
    const { lat, lng } = decode(raw);
    showResult({ lat, lng, name: 'Typed location' });
  } catch (_) {
    errEl.textContent = "Couldn't read that code. Please check and try again.";
    errEl.hidden = false;
  }
}
```

In the `DOMContentLoaded` listener, add:
```js
  document.getElementById('show-typed-btn').addEventListener('click', showTypedCodeInput);
  document.getElementById('typed-code-go').addEventListener('click', submitTypedCode);
  document.getElementById('typed-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTypedCode();
  });
```

- [ ] **Step 4: Verify in browser**

1. Open `driver.html`.
2. Tap "Can't scan? Type the code instead →" — input should appear.
3. Type a 9-char geohash from the passenger modal (e.g. `w3gv2xm9q`) and tap Go — result screen should show pin on map with name "Typed location".
4. Type `abc` (too short) → error message appears.
5. Type `aaaaaaaaa` (invalid chars like `a`) → error message appears (recall BASE32 excludes `a`).

- [ ] **Step 5: Commit**

```bash
git add driver.html js/driver.js css/style.css
git commit -m "feat: typed geohash code fallback on driver page"
```

---

## Task 6: Camera-specific error messages + torch toggle

**Files:**
- Modify: `js/driver.js` — replace `startScan` error handling; add `initTorch`

- [ ] **Step 1: Replace `startScan` in `driver.js`** (lines 24–39) with:

```js
let torchOn = false;

async function startScan() {
  document.getElementById('scan-error').hidden = true;
  document.getElementById('scan-btn').hidden = true;
  document.getElementById('reader').hidden = false;
  document.getElementById('cancel-scan').hidden = false;

  html5Qr = new Html5Qrcode('reader');
  const config = { fps: 10, qrbox: { width: 240, height: 240 } };

  try {
    await html5Qr.start({ facingMode: 'environment' }, config, onScanSuccess, () => {});
    initTorch();
  } catch (err) {
    const msg = err && err.name ? err.name : String(err);
    let text;
    if (msg.includes('NotAllowedError') || msg.includes('PermissionDenied') || msg.toLowerCase().includes('permission')) {
      text = 'Allow camera access in your browser settings, then tap Scan again.';
    } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFound')) {
      text = "No camera found. Use 'Type the code' below instead.";
    } else if (location.protocol === 'http:' && location.hostname !== 'localhost') {
      text = 'Camera requires a secure connection (https). Try the typed code.';
    } else {
      text = "Couldn't open the camera. Try the typed code below.";
    }
    showError(text);
    // Scroll typed-code row into view
    document.getElementById('typed-code-row').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    resetScanUI();
  }
}

function initTorch() {
  const torchBtn = document.getElementById('torch-btn');
  if (!torchBtn) return;
  try {
    const track = html5Qr && html5Qr.getRunningTrackCameraCapabilities &&
      html5Qr.getRunningTrackCameraCapabilities();
    if (!track || !track.torchFeature || !track.torchFeature().isSupported()) return;
    torchBtn.hidden = false;
    torchBtn.addEventListener('click', async () => {
      torchOn = !torchOn;
      await track.torchFeature().apply(torchOn);
      torchBtn.textContent = torchOn ? '🔦 Torch On' : '🔦 Torch';
    });
  } catch (_) { /* torch not available on this device */ }
}
```

- [ ] **Step 2: Add torch button DOM to `driver.html`**

Inside `<div id="scan-stage" ...>`, after the `<div id="reader"...>` line, add:
```html
      <button id="torch-btn" class="secondary-btn" type="button" hidden>🔦 Torch</button>
```

- [ ] **Step 3: Update `stopScan` to hide the torch button when scanning stops**

Replace the `stopScan` function in `driver.js`:
```js
async function stopScan() {
  const torchBtn = document.getElementById('torch-btn');
  if (torchBtn) { torchBtn.hidden = true; torchOn = false; torchBtn.textContent = '🔦 Torch'; }
  if (html5Qr) {
    try { await html5Qr.stop(); html5Qr.clear(); } catch (_) {}
    html5Qr = null;
  }
}
```

- [ ] **Step 4: Verify in browser**

1. Open `driver.html` on a device with a camera → tap Scan. No errors should appear.
2. If on a device supporting torch (most Android phones): torch button should appear after scan starts.
3. To test permission-denied: open browser settings, revoke camera permission, tap Scan → confirm the permission-denied message appears and typed-code row scrolls into view.

*(Testing all error branches requires device/browser manipulation. At minimum verify the happy path and one error path.)*

- [ ] **Step 5: Commit**

```bash
git add driver.html js/driver.js
git commit -m "feat: specific camera errors and torch toggle on driver page"
```

---

## Task 7: Out-of-metro-Cebu guard in `passenger.js`

**Files:**
- Modify: `js/passenger.js` — add `checkCebuBounds` and call it from `setDestination`
- Modify: `index.html` — add the out-of-Cebu note element
- Modify: `css/style.css` — add `.out-of-cebu-note` style

- [ ] **Step 1: Add the DOM element to `index.html`**

After `<div id="selected-card" ...>`, add:
```html
    <div id="out-of-cebu-note" class="out-of-cebu-note" hidden>
      That looks outside Cebu City — still okay to use.
      <button class="dismiss-note" type="button" aria-label="Dismiss">✕</button>
    </div>
```

- [ ] **Step 2: Add CSS to `css/style.css`**

Append:
```css
/* Out-of-Cebu note */
.out-of-cebu-note {
  background: #fef9c3;
  color: #854d0e;
  border: 1px solid #fde047;
  border-radius: var(--radius);
  padding: 10px 14px;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dismiss-note { background: none; border: none; cursor: pointer; font-size: 1rem; padding: 0 4px; color: #854d0e; }
```

- [ ] **Step 3: Add `checkCebuBounds` to `passenger.js`**

Add this function after `setMarker`:
```js
const CEBU_BOUNDS = { minLat: 9.9, maxLat: 10.6, minLng: 123.6, maxLng: 124.1 };

function checkCebuBounds(lat, lng) {
  const note = document.getElementById('out-of-cebu-note');
  const outside = lat < CEBU_BOUNDS.minLat || lat > CEBU_BOUNDS.maxLat ||
                  lng < CEBU_BOUNDS.minLng || lng > CEBU_BOUNDS.maxLng;
  note.hidden = !outside;
}
```

Wire up the dismiss button by adding to the `DOMContentLoaded` listener:
```js
  document.querySelector('.dismiss-note').addEventListener('click', () => {
    document.getElementById('out-of-cebu-note').hidden = true;
  });
```

- [ ] **Step 4: Call `checkCebuBounds` from `setDestination`**

In `setDestination`, after the `document.getElementById('generate-btn').disabled = false;` line, add:
```js
  checkCebuBounds(lat, lng);
```

- [ ] **Step 5: Verify in browser**

1. Tap somewhere in Cebu City → no note should appear.
2. Zoom way out and tap somewhere far outside the Philippines → the yellow note should appear.
3. Tap the ✕ → note dismisses.
4. Tap SM City Cebu chip → note should not appear.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/passenger.js
git commit -m "feat: non-blocking out-of-Cebu warning on passenger page"
```

---

## Task 8: Explicit search states + offline search guard

**Files:**
- Modify: `js/passenger.js` — update `search` function

- [ ] **Step 1: Replace the `search` function** (lines 81–100 of `js/passenger.js`) with:

```js
let lastSearch = 0;
async function search(query) {
  if (!query.trim()) return;

  const results = document.getElementById('search-results');

  // Offline guard
  if (!navigator.onLine) {
    results.innerHTML = '<li>Search needs internet. Tap the map to drop a pin, or pick a landmark below.</li>';
    results.hidden = false;
    return;
  }

  // Respect Nominatim's max 1 req/sec.
  const now = Date.now();
  if (now - lastSearch < 1100) await new Promise((r) => setTimeout(r, 1100 - (now - lastSearch)));
  lastSearch = Date.now();

  results.innerHTML = '<li>Searching…</li>';
  results.hidden = false;

  try {
    const url = `${NOMINATIM}?format=jsonv2&limit=6&countrycodes=ph&q=${encodeURIComponent(query + ', Cebu')}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) throw new Error('non-200');
    const data = await res.json();
    renderResults(data);
  } catch (_) {
    results.innerHTML = '<li>Search unavailable — tap the map to drop a pin instead.</li>';
  }
}
```

Note: the `finally` to clear loading state is not needed separately because every branch (offline guard, error, success) assigns to `results.innerHTML` or calls `renderResults`, which always sets content. There is no path that leaves `Searching…` stuck.

- [ ] **Step 2: Update `renderResults` empty-state copy** (line 104 in original):

Change:
```js
    results.innerHTML = '<li>No results found.</li>';
```
To:
```js
    results.innerHTML = '<li>No places found.</li>';
```

- [ ] **Step 3: Verify in browser**

1. With network on: search "SM City" → results appear.
2. With network on: search a nonsense string → "No places found." appears.
3. Throttle network to offline in devtools: search anything → "Search needs internet…" message appears immediately.

- [ ] **Step 4: Commit**

```bash
git add js/passenger.js
git commit -m "feat: explicit search states and offline search guard"
```

---

## Task 9: Map tile offline overlay

**Files:**
- Modify: `js/passenger.js` — add `initTileOverlay`
- Modify: `index.html` — add overlay element inside `#map`
- Modify: `css/style.css` — add overlay styles

- [ ] **Step 1: Add overlay DOM inside `#map` in `index.html`**

Change:
```html
    <div id="map" role="application" aria-label="Map of Cebu City. Tap to drop a destination pin."></div>
```
To:
```html
    <div id="map" role="application" aria-label="Map of Cebu City. Tap to drop a destination pin.">
      <div id="map-offline-overlay" class="map-offline-overlay" hidden>
        Map tiles need internet to load. You can still drop a pin at the last known location.
      </div>
    </div>
```

- [ ] **Step 2: Add CSS to `css/style.css`**

Append:
```css
/* Map offline overlay */
.map-offline-overlay {
  position: absolute;
  inset: 0;
  background: rgba(30, 41, 59, 0.82);
  color: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px;
  font-size: 0.9rem;
  line-height: 1.5;
  z-index: 400;
  pointer-events: none;
  border-radius: var(--radius);
}
```

Note: `#map` in Leaflet is `position: relative` by default, so the overlay positions correctly inside it.

- [ ] **Step 3: Add `initTileOverlay` to `passenger.js`**

Add this function after `initOffline`:
```js
function initTileOverlay() {
  const overlay = document.getElementById('map-offline-overlay');
  const updateOverlay = () => { overlay.hidden = navigator.onLine; };
  window.addEventListener('online', updateOverlay);
  window.addEventListener('offline', updateOverlay);
  updateOverlay();
}
```

In `DOMContentLoaded`, add a call to `initTileOverlay()` after `initOffline()`.

- [ ] **Step 4: Verify in browser**

1. Online: `#map-offline-overlay` should be hidden.
2. Throttle to offline in devtools → reload page → overlay should appear over the map.
3. Restore network → overlay disappears.

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/passenger.js
git commit -m "feat: offline overlay on map when tiles unavailable"
```

---

## Task 10: Update `README.md`

**Files:**
- Modify: `README.md` — add tests section link and manual device checklist

- [ ] **Step 1: Add a "Running tests" section to `README.md`**

After the "Run it locally" section, add:

```markdown
## Running tests

Open `http://localhost:8080/tests/` after starting the local server. The page runs
geohash round-trip tests and payload parse/validate tests in-browser with a green/red
pass-fail table. All rows should be green before deploying.
```

- [ ] **Step 2: Add a "Manual device checklist" section**

Add before the "Roadmap / Future ideas" section:

```markdown
## Manual device checklist

Run these on a real device before deploying to real users:

- [ ] Android low-end device: scan works in under 3 seconds
- [ ] Scan in direct sunlight with torch toggle (Android)
- [ ] Deny camera permission: correct error shown + typed-code link visible
- [ ] Airplane mode: offline banner visible, landmark chips work, search shows offline message, map overlay appears
- [ ] Typed-code: copy code from passenger modal, type on driver page, pin appears correctly with "Typed location"
- [ ] Download QR: image saves to camera roll / downloads folder
- [ ] Add to Home Screen (Android Chrome + iOS Safari): app launches in standalone mode
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add tests link and manual device checklist to README"
```

---

## Task 11: Smoke-test the full hardened flow

- [ ] **Step 1: Run the in-browser tests**

Open `http://localhost:8080/tests/` — confirm all rows are green.

- [ ] **Step 2: Full passenger → driver flow with new payload**

1. Open `http://localhost:8080/index.html`, tap "IT Park" chip.
2. Confirm selected card shows "IT Park" and coordinates.
3. Tap Generate QR.
4. Confirm the 9-char code appears and Copy works.
5. Open `http://localhost:8080/driver.html` in a second tab.
6. In the console, call `parsePayload('PINRIDE1|10.3296|123.906|IT Park')` → confirm `{ lat: 10.3296, lng: 123.906, name: 'IT Park' }`.
7. In the console, call `showResult({ lat: 10.3296, lng: 123.906, name: 'IT Park' })` → confirm result screen shows name, map, and correct Google Maps / Waze URLs.

- [ ] **Step 3: Typed-code round-trip**

1. On passenger page: generate QR for "Carbon Market", note the 9-char code shown in modal.
2. On driver page: tap "Can't scan? Type the code instead →", enter the code, tap Go.
3. Confirm the result screen shows a pin at Carbon Market's location (labelled "Typed location").

- [ ] **Step 4: Offline behaviour**

1. Throttle devtools to offline.
2. Reload `index.html` → offline banner appears, map overlay appears.
3. Tap Search → offline search message appears immediately.
4. Tap a landmark chip → pin drops correctly (chips are hardcoded, no network needed).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: MVP hardening complete"
```

---

## Self-Review

**Spec coverage:**
1. ✅ QR payload PINRIDE1 prefix + validation → Tasks 3, and test coverage in Task 2
2. ✅ Geohash encode/decode module → Task 1
3. ✅ Passenger modal code row + copy → Task 4
4. ✅ Driver typed-code input → Task 5
5. ✅ Specific camera errors → Task 6
6. ✅ Torch toggle → Task 6
7. ✅ Passenger brightness nudge → Task 4 (HTML in modal)
8. ✅ Out-of-Cebu guard → Task 7
9. ✅ Explicit search states → Task 8
10. ✅ Offline search guard → Task 8
11. ✅ Map tile overlay → Task 9
12. ✅ In-browser test runner → Task 2
13. ✅ README manual checklist + tests link → Task 10

**Placeholder scan:** None found.

**Type consistency:**
- `encode`/`decode`/`isValidGeohash9` defined in Task 1, used in Tasks 4, 5, 2 (tests). ✅
- `parsePayload` signature `(raw) → {lat, lng, name} | null` — used identically in Tasks 3 and 2 (test). ✅
- `showResult` signature `(dest: {lat, lng, name})` — used in Tasks 5 and 6 unchanged. ✅
- `showTypedCodeInput` called only from `show-typed-btn` listener in Task 5. ✅
- `checkCebuBounds(lat, lng)` called from `setDestination` in Task 7. ✅
- `initTileOverlay()` called from `DOMContentLoaded` in Task 9. ✅
