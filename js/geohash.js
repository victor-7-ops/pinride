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
  return typeof hash === 'string' && /^[0-9bcdefghjkmnpqrstuvwxyz]{9}$/.test(hash);
}
