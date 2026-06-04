// PinRide — Passenger page logic
'use strict';

const CEBU = [10.3157, 123.8854];
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Common Cebu landmarks: [name, lat, lng]
const LANDMARKS = [
  ['SM City Cebu', 10.3110, 123.9180],
  ['Ayala Center Cebu', 10.3181, 123.9057],
  ['Mactan-Cebu Airport', 10.3075, 123.9794],
  ['IT Park', 10.3296, 123.9060],
  ['Basilica del Santo Niño', 10.2945, 123.9019],
  ['Carbon Market', 10.2939, 123.8975],
  ['Colon Street', 10.2966, 123.9000],
  ['Chong Hua Hospital', 10.3009, 123.8945],
  ["Robinson's Galleria Cebu", 10.3110, 123.9170],
  ['University of San Carlos', 10.2996, 123.8917],
];

let map, marker;
let selected = null; // { lat, lng, name }

// ---- Map setup ----
function initMap() {
  map = L.map('map', { zoomControl: true }).setView(CEBU, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
  }).addTo(map);

  map.on('click', (e) => {
    setDestination(e.latlng.lat, e.latlng.lng, null, true);
  });
}

function setMarker(lat, lng) {
  if (marker) {
    marker.setLatLng([lat, lng]);
  } else {
    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      setDestination(p.lat, p.lng, null, false);
    });
  }
}

const CEBU_BOUNDS = { minLat: 9.9, maxLat: 10.6, minLng: 123.6, maxLng: 124.1 };

function checkCebuBounds(lat, lng) {
  const note = document.getElementById('out-of-cebu-note');
  const outside = lat < CEBU_BOUNDS.minLat || lat > CEBU_BOUNDS.maxLat ||
                  lng < CEBU_BOUNDS.minLng || lng > CEBU_BOUNDS.maxLng;
  note.hidden = !outside;
}

function setDestination(lat, lng, name, recenter) {
  lat = +lat.toFixed(6);
  lng = +lng.toFixed(6);
  selected = { lat, lng, name: name || 'Dropped pin' };
  setMarker(lat, lng);
  if (recenter) map.panTo([lat, lng]);

  document.getElementById('selected-card').hidden = false;
  document.getElementById('selected-name').textContent = selected.name;
  document.getElementById('selected-coords').textContent = `${lat}, ${lng}`;
  document.getElementById('generate-btn').disabled = false;
  checkCebuBounds(lat, lng);

  // If no name yet, reverse-geocode in the background for a friendlier label.
  if (!name) reverseGeocode(lat, lng);
}

// ---- Geocoding ----
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.display_name && selected && selected.lat === lat && selected.lng === lng) {
      const short = data.display_name.split(',').slice(0, 2).join(',').trim();
      selected.name = short;
      document.getElementById('selected-name').textContent = short;
    }
  } catch (_) { /* offline or blocked — keep "Dropped pin" */ }
}

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

function renderResults(items) {
  const results = document.getElementById('search-results');
  if (!items || !items.length) {
    results.innerHTML = '<li>No places found.</li>';
    return;
  }
  results.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item.display_name;
    li.addEventListener('click', () => {
      const name = item.display_name.split(',').slice(0, 2).join(',').trim();
      setDestination(parseFloat(item.lat), parseFloat(item.lon), name, true);
      map.setView([parseFloat(item.lat), parseFloat(item.lon)], 16);
      results.hidden = true;
      document.getElementById('search-input').value = name;
    });
    results.appendChild(li);
  });
}

// ---- Landmark chips ----
function initChips() {
  const wrap = document.getElementById('landmark-chips');
  LANDMARKS.forEach(([name, lat, lng]) => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = name;
    btn.addEventListener('click', () => {
      setDestination(lat, lng, name, true);
      map.setView([lat, lng], 16);
      document.getElementById('search-results').hidden = true;
    });
    wrap.appendChild(btn);
  });
}

// ---- QR generation ----
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

function downloadQR() {
  const img = document.querySelector('#qr-canvas img') || document.querySelector('#qr-canvas canvas');
  if (!img) return;
  const dataUrl = img.tagName === 'IMG' ? img.src : img.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `pinride-${(selected.name || 'destination').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---- Voice input (Web Speech API) ----
function initVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const btn = document.getElementById('voice-btn');
  if (!SR) return; // stays hidden
  btn.hidden = false;

  const recog = new SR();
  recog.lang = 'en-US';
  recog.interimResults = false;
  recog.maxAlternatives = 1;

  btn.addEventListener('click', () => {
    try { recog.start(); btn.classList.add('listening'); } catch (_) {}
  });
  recog.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const input = document.getElementById('search-input');
    input.value = text;
    search(text);
  };
  recog.onend = () => btn.classList.remove('listening');
  recog.onerror = () => btn.classList.remove('listening');
}

// ---- Offline indicator ----
function initOffline() {
  const banner = document.getElementById('offline-banner');
  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

function initTileOverlay() {
  const overlay = document.getElementById('map-offline-overlay');
  const updateOverlay = () => { overlay.hidden = navigator.onLine; };
  window.addEventListener('online', updateOverlay);
  window.addEventListener('offline', updateOverlay);
  updateOverlay();
}

// ---- Copy geohash code ----
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

// ---- Wire up ----
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initChips();
  initVoice();
  initOffline();
  initTileOverlay();

  const input = document.getElementById('search-input');
  document.getElementById('search-btn').addEventListener('click', () => search(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(input.value); });

  document.getElementById('generate-btn').addEventListener('click', generateQR);
  document.getElementById('download-btn').addEventListener('click', downloadQR);
  document.getElementById('qr-close').addEventListener('click', () => {
    document.getElementById('qr-modal').hidden = true;
  });
  document.getElementById('qr-modal').addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal') document.getElementById('qr-modal').hidden = true;
  });
  document.getElementById('copy-code-btn').addEventListener('click', copyCode);
  document.querySelector('.dismiss-note').addEventListener('click', () => {
    document.getElementById('out-of-cebu-note').hidden = true;
  });
});
