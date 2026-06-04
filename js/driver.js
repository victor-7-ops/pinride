// PinRide — Driver page logic
'use strict';

let html5Qr = null;
let previewMap = null;
let torchOn = false;

function showError(msg) {
  const el = document.getElementById('scan-error');
  el.textContent = msg;
  el.hidden = false;
}

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

async function stopScan() {
  const torchBtn = document.getElementById('torch-btn');
  if (torchBtn) { torchBtn.hidden = true; torchOn = false; torchBtn.textContent = '🔦 Torch'; }
  if (html5Qr) {
    try { await html5Qr.stop(); html5Qr.clear(); } catch (_) {}
    html5Qr = null;
  }
}

function resetScanUI() {
  document.getElementById('scan-btn').hidden = false;
  document.getElementById('reader').hidden = true;
  document.getElementById('cancel-scan').hidden = true;
}

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

async function onScanSuccess(decodedText) {
  const dest = parsePayload(decodedText);
  if (!dest) {
    showError("That QR code isn't a PinRide destination.");
    return;
  }
  await stopScan();
  resetScanUI();
  showResult(dest);
}

function showResult(dest) {
  document.getElementById('scan-stage').hidden = true;
  document.getElementById('result-stage').hidden = false;

  document.getElementById('dest-name').textContent = dest.name;
  document.getElementById('dest-coords').textContent = `${dest.lat.toFixed(6)}, ${dest.lng.toFixed(6)}`;

  document.getElementById('gmaps-btn').href = `https://maps.google.com/?q=${dest.lat},${dest.lng}`;
  document.getElementById('waze-btn').href = `https://waze.com/ul?ll=${dest.lat},${dest.lng}&navigate=yes`;

  // Small preview map
  if (!previewMap) {
    previewMap = L.map('preview-map', { zoomControl: false, attributionControl: false }).setView([dest.lat, dest.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(previewMap);
  } else {
    previewMap.setView([dest.lat, dest.lng], 16);
  }
  L.marker([dest.lat, dest.lng]).addTo(previewMap);
  setTimeout(() => previewMap.invalidateSize(), 100);
}

function scanAgain() {
  document.getElementById('result-stage').hidden = true;
  document.getElementById('scan-stage').hidden = false;
  resetScanUI();
  startScan();
}

function initOffline() {
  const banner = document.getElementById('offline-banner');
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

document.addEventListener('DOMContentLoaded', () => {
  initOffline();
  document.getElementById('scan-btn').addEventListener('click', startScan);
  document.getElementById('cancel-scan').addEventListener('click', async () => {
    await stopScan();
    resetScanUI();
  });
  document.getElementById('scan-again').addEventListener('click', scanAgain);
  document.getElementById('show-typed-btn').addEventListener('click', showTypedCodeInput);
  document.getElementById('typed-code-go').addEventListener('click', submitTypedCode);
  document.getElementById('typed-code-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitTypedCode();
  });
});
