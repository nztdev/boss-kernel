/**
 * B.O.S.S. Location helper — actions/location.js
 * ================================================
 * github.com/nztdev/boss-kernel
 *
 * Device location for CORE ("where am I") and anything that needs "here"
 * (weather, later: nearby, maps). One place owns the permission prompt,
 * the error vocabulary and the cache.
 *
 * PRIVACY: location is held IN MEMORY ONLY — never written to localStorage,
 * never included in backups, never sent anywhere except (a) the weather
 * request, which needs coordinates, and (b) the optional place-name lookup.
 * Both are plain HTTPS calls made from this device.
 *
 * Errors thrown by getLocation() carry .code:
 *   'unsupported' | 'denied' | 'unavailable' | 'timeout'
 */

let _cached = null;   // { lat, lon, accuracy, ts, place? }

export class LocationError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function getLocation({ maxAgeMs = 10 * 60 * 1000, force = false } = {}) {
  if (!force && _cached && Date.now() - _cached.ts < maxAgeMs) return Promise.resolve(_cached);
  if (!navigator.geolocation)
    return Promise.reject(new LocationError('unsupported', 'Location is not supported on this browser'));

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        _cached = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          ts: Date.now(),
        };
        resolve(_cached);
      },
      err => {
        const map = { 1: 'denied', 2: 'unavailable', 3: 'timeout' };
        const code = map[err.code] || 'unavailable';
        const msg = {
          denied:      'Location permission was denied',
          unavailable: 'Location is unavailable right now',
          timeout:     'Location request timed out',
        }[code];
        reject(new LocationError(code, msg));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/** Best-effort "City, Region, Country" for coordinates. Returns null on any failure. */
export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const d = await r.json();
    const parts = [d.city || d.locality, d.principalSubdivision, d.countryName].filter(Boolean);
    // De-duplicate adjacent repeats (e.g. "Madrid, Madrid")
    const uniq = parts.filter((p, i) => p !== parts[i - 1]);
    return uniq.length ? uniq.join(', ') : null;
  } catch (_) { return null; }
}

export function clearLocation() { _cached = null; }
export function cachedLocation() { return _cached; }

if (typeof window !== 'undefined') {
  window.BOSS_getLocation = getLocation;
}
