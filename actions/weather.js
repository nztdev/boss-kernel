/**
 * B.O.S.S. Weather — actions/weather.js
 * =======================================
 * github.com/nztdev/boss-kernel
 *
 * Owned by CHRONOS (a forecast is a time-indexed question, like "time in
 * Tokyo"). Read-only: weather queries never trigger Grief/clarification.
 *
 * Data: Open-Meteo (https://open-meteo.com) — free, no API key, CORS-enabled.
 * Open-Meteo data is CC BY 4.0, so every result prints an attribution line.
 *
 * Works two ways:
 *   "weather in tokyo"      → geocode the name, no location permission needed
 *   "weather" / "will it rain" → uses device location (CORE's helper)
 *
 * Requires network. Offline → says so (no stale guess).
 */

import { getLocation, reverseGeocode, LocationError } from './location.js';

const IMPERIAL = typeof navigator !== 'undefined' && /^en-US/i.test(navigator.language || '');

const WMO = {
  0: ['Clear sky', '☀️'], 1: ['Mostly clear', '🌤'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Fog', '🌫'], 48: ['Freezing fog', '🌫'],
  51: ['Light drizzle', '🌦'], 53: ['Drizzle', '🌦'], 55: ['Heavy drizzle', '🌧'],
  56: ['Freezing drizzle', '🌧'], 57: ['Freezing drizzle', '🌧'],
  61: ['Light rain', '🌦'], 63: ['Rain', '🌧'], 65: ['Heavy rain', '🌧'],
  66: ['Freezing rain', '🌧'], 67: ['Freezing rain', '🌧'],
  71: ['Light snow', '🌨'], 73: ['Snow', '🌨'], 75: ['Heavy snow', '❄️'], 77: ['Snow grains', '🌨'],
  80: ['Light showers', '🌦'], 81: ['Showers', '🌧'], 82: ['Violent showers', '⛈'],
  85: ['Snow showers', '🌨'], 86: ['Heavy snow showers', '❄️'],
  95: ['Thunderstorm', '⛈'], 96: ['Thunderstorm, hail', '⛈'], 99: ['Thunderstorm, heavy hail', '⛈'],
};
const _desc = code => WMO[code] || ['Unknown', '❔'];

// ── Intent parsing ────────────────────────────────────────────────────────────
const WEATHER_RX = /\b(weather|forecast|rain(?:ing)?|raining|snow(?:ing)?|umbrella|temperature|how (?:hot|cold|warm)|sunny|windy)\b/;

export function isWeatherIntent(intent) {
  return WEATHER_RX.test(intent.toLowerCase());
}

function _parse(intent) {
  const s = intent.toLowerCase().trim().replace(/[?!.]+$/, '');
  let place = null;
  const m = s.match(/\b(?:in|for|at|near)\s+(?!my\b|the\s+(?:morning|evening|afternoon)\b)(.+)$/);
  if (m) {
    place = m[1]
      .replace(/\b(today|tonight|tomorrow|now|right now|this week|this weekend|please)\b/g, '')
      .replace(/\s+/g, ' ').trim();
    if (!place || /^(here|my location|my area)$/.test(place)) place = null;
  }
  const multi = /\b(forecast|tomorrow|week|weekend|next|days?)\b/.test(s);
  return { place, multi };
}

// ── Network ───────────────────────────────────────────────────────────────────
async function _geocode(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error(`geocoding ${r.status}`);
  const d = await r.json();
  const hit = d.results && d.results[0];
  if (!hit) return null;
  return { lat: hit.latitude, lon: hit.longitude,
           label: [hit.name, hit.admin1, hit.country].filter(Boolean).filter((p, i, a) => p !== a[i - 1]).join(', ') };
}

async function _forecast(lat, lon) {
  const q = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '3',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    temperature_unit: IMPERIAL ? 'fahrenheit' : 'celsius',
    wind_speed_unit:  IMPERIAL ? 'mph' : 'kmh',
    precipitation_unit: IMPERIAL ? 'inch' : 'mm',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`forecast ${r.status}`);
  return r.json();
}

// ── Public interface ──────────────────────────────────────────────────────────
export const Weather = {
  isWeatherIntent,

  /** Returns true when answered (including honest failures); never a "gap". */
  async handle(intent, clog) {
    const { place, multi } = _parse(intent);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      clog('🌤 CHRONOS: weather needs a connection — you appear to be offline', 'log-action');
      return true;
    }

    // Resolve coordinates
    let lat, lon, label;
    try {
      if (place) {
        const g = await _geocode(place);
        if (!g) { clog(`🌤 CHRONOS: couldn't find a place called "${place}"`, 'log-action'); return true; }
        ({ lat, lon, label } = g);
      } else {
        const loc = await getLocation();
        lat = loc.lat; lon = loc.lon;
        label = (await reverseGeocode(lat, lon)) || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      }
    } catch (e) {
      if (e instanceof LocationError) {
        clog(`🌤 CHRONOS: ${e.message}`, 'log-action');
        clog('   Ask for a place instead — e.g. "weather in madrid"', 'log-action');
      } else {
        clog(`🌤 CHRONOS: lookup failed — ${e.message}`, 'log-err');
      }
      return true;
    }

    // Fetch + render
    try {
      const w = await _forecast(lat, lon);
      const tU = IMPERIAL ? '°F' : '°C';
      const wU = IMPERIAL ? 'mph' : 'km/h';
      const pU = IMPERIAL ? 'in' : 'mm';
      const c  = w.current;
      const [cd, ce] = _desc(c.weather_code);
      clog(`${ce} CHRONOS: Weather — ${label}`, 'log-action');
      clog(`   now: ${Math.round(c.temperature_2m)}${tU} (feels ${Math.round(c.apparent_temperature)}${tU}) · ${cd}`, 'log-action');
      clog(`   humidity ${c.relative_humidity_2m}% · wind ${Math.round(c.wind_speed_10m)} ${wU} · precip ${c.precipitation} ${pU}`, 'log-action');

      const d = w.daily;
      const dayName = i => i === 0 ? 'today' : i === 1 ? 'tomorrow'
        : new Date(d.time[i] + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' });
      const days = multi ? d.time.length : 1;
      for (let i = 0; i < days; i++) {
        const [dd, de] = _desc(d.weather_code[i]);
        clog(`   ${dayName(i)}: ${de} ${dd} · ${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}${tU} · rain ${d.precipitation_probability_max[i] ?? 0}%`, 'log-action');
      }
      clog('   data: Open-Meteo.com', 'log-action');
    } catch (e) {
      clog(`🌤 CHRONOS: couldn't fetch the forecast — ${e.message}`, 'log-err');
    }
    return true;
  },
};
