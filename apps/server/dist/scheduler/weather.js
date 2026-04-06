import { WEATHER_LAT, WEATHER_LON, RAIN_SKIP_THRESHOLD } from '../config.js';
import { getSetting } from '../db/queries.js';
let cachedWeather = null;
let lastFetchTime = 0;
let cachedLatLon = '';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
// Solar times cache (separate from weather, refreshed daily)
let cachedSolarTimes = null;
let solarCacheDate = '';
let solarCacheLatLon = '';
export async function fetchWeather() {
    // Read lat/lon from DB settings (user-configurable), fall back to config constants
    const lat = parseFloat(await getSetting('weather_lat') ?? String(WEATHER_LAT));
    const lon = parseFloat(await getSetting('weather_lon') ?? String(WEATHER_LON));
    const latLon = `${lat},${lon}`;
    // Invalidate cache if location changed
    const now = Date.now();
    if (cachedWeather && now - lastFetchTime < CACHE_TTL_MS && cachedLatLon === latLon) {
        return cachedWeather;
    }
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation_probability,weather_code');
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,et0_fao_evapotranspiration');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('forecast_days', '5');
    url.searchParams.set('timezone', 'auto');
    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Open-Meteo API error: ${response.status}`);
        }
        const data = await response.json();
        const forecastDays = data.daily.time.map((date, i) => {
            const precipProb = data.daily.precipitation_probability_max[i];
            return {
                date,
                precipitationProbability: precipProb,
                temperatureHighF: data.daily.temperature_2m_max[i],
                temperatureLowF: data.daily.temperature_2m_min[i],
                description: weatherCodeToDescription(data.daily.weather_code[i]),
                weatherCode: data.daily.weather_code[i],
                shouldSkip: precipProb >= RAIN_SKIP_THRESHOLD,
                et0Mm: data.daily.et0_fao_evapotranspiration?.[i] ?? null,
            };
        });
        cachedWeather = {
            temperatureF: data.current.temperature_2m,
            humidity: data.current.relative_humidity_2m,
            precipitationProbability: data.current.precipitation_probability ?? forecastDays[0]?.precipitationProbability ?? 0,
            description: forecastDays[0]?.description ?? 'Unknown',
            weatherCode: data.current.weather_code ?? 0,
            forecastDays,
            heatWave: { active: false, severity: 'none', consecutiveDays: 0, peakTempF: null, boostMultiplier: 1.0 },
        };
        lastFetchTime = now;
        cachedLatLon = latLon;
        console.log(`[WEATHER] Fetched (${latLon}): ${cachedWeather.temperatureF}°F, ${cachedWeather.precipitationProbability}% precip`);
        return cachedWeather;
    }
    catch (err) {
        console.error('[WEATHER] Fetch failed:', err);
        // Return stale cache or default
        if (cachedWeather)
            return cachedWeather;
        return {
            temperatureF: 72,
            humidity: 50,
            precipitationProbability: 0,
            description: 'Unknown (offline)',
            weatherCode: 0,
            forecastDays: [],
            heatWave: { active: false, severity: 'none', consecutiveDays: 0, peakTempF: null, boostMultiplier: 1.0 },
        };
    }
}
export async function shouldSkipForRain() {
    const weather = await fetchWeather();
    return {
        skip: weather.precipitationProbability >= RAIN_SKIP_THRESHOLD,
        probability: weather.precipitationProbability,
    };
}
/**
 * Get today's sunrise and sunset times as HH:MM strings (local time).
 * Uses Open-Meteo daily forecast which includes sunrise/sunset.
 * Cached per day + location.
 */
export async function getSolarTimes() {
    const lat = parseFloat(await getSetting('weather_lat') ?? String(WEATHER_LAT));
    const lon = parseFloat(await getSetting('weather_lon') ?? String(WEATHER_LON));
    const latLon = `${lat},${lon}`;
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (cachedSolarTimes && solarCacheDate === today && solarCacheLatLon === latLon) {
        return cachedSolarTimes;
    }
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('daily', 'sunrise,sunset');
    url.searchParams.set('forecast_days', '1');
    url.searchParams.set('timezone', 'auto');
    try {
        const response = await fetch(url.toString());
        if (!response.ok)
            throw new Error(`Open-Meteo API error: ${response.status}`);
        const data = await response.json();
        // Open-Meteo returns ISO datetime like "2026-03-26T06:45"
        const sunriseTime = data.daily.sunrise[0].split('T')[1]; // "06:45"
        const sunsetTime = data.daily.sunset[0].split('T')[1]; // "18:30"
        cachedSolarTimes = { sunrise: sunriseTime, sunset: sunsetTime };
        solarCacheDate = today;
        solarCacheLatLon = latLon;
        console.log(`[WEATHER] Solar times: sunrise ${sunriseTime}, sunset ${sunsetTime}`);
        return cachedSolarTimes;
    }
    catch (err) {
        console.error('[WEATHER] Failed to fetch solar times:', err);
        return cachedSolarTimes; // return stale cache if available
    }
}
/**
 * Compute the effective HH:MM trigger time for a solar schedule.
 * Returns null if solar times are unavailable.
 */
export function computeSolarTime(baseTime, // "HH:MM" from sunrise or sunset
offsetMinutes) {
    const [h, m] = baseTime.split(':').map(Number);
    if (h === undefined || m === undefined)
        return null;
    let totalMinutes = h * 60 + m + offsetMinutes;
    // Clamp to valid day range (00:00 - 23:59)
    if (totalMinutes < 0)
        totalMinutes = 0;
    if (totalMinutes > 23 * 60 + 59)
        totalMinutes = 23 * 60 + 59;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}
/** Get current heat wave status — always reads the latest threshold from settings */
export async function getHeatWaveStatus() {
    // Dev override: simulate heat wave via setting
    const simulate = await getSetting('heat_wave_simulate');
    if (simulate === 'warning') {
        return { active: true, severity: 'warning', consecutiveDays: 2, peakTempF: 98, boostMultiplier: 1.25 };
    }
    if (simulate === 'extreme') {
        return { active: true, severity: 'extreme', consecutiveDays: 4, peakTempF: 108, boostMultiplier: 1.5 };
    }
    const weather = await fetchWeather();
    const thresholdStr = await getSetting('heat_wave_threshold_f');
    const thresholdF = thresholdStr ? parseFloat(thresholdStr) : 95;
    return detectHeatWave(weather.forecastDays, thresholdF);
}
// ── Heat Wave Detection ─────────────────────────────────
/**
 * Detect heat wave from forecast data.
 *
 * - **Warning**: 2+ consecutive days above threshold (default 95°F / 35°C)
 * - **Extreme**: 3+ days above threshold OR any day above threshold + 10°F
 *
 * Boost multiplier:
 * - Warning: 1.25 (25% more water)
 * - Extreme: 1.5 (50% more water)
 */
function detectHeatWave(forecast, thresholdF) {
    if (forecast.length === 0) {
        return { active: false, severity: 'none', consecutiveDays: 0, peakTempF: null, boostMultiplier: 1.0 };
    }
    let consecutiveDays = 0;
    let peakTempF = -Infinity;
    for (const day of forecast) {
        if (day.temperatureHighF >= thresholdF) {
            consecutiveDays++;
            if (day.temperatureHighF > peakTempF)
                peakTempF = day.temperatureHighF;
        }
        else {
            break; // consecutive from today
        }
    }
    if (consecutiveDays === 0) {
        return { active: false, severity: 'none', consecutiveDays: 0, peakTempF: null, boostMultiplier: 1.0 };
    }
    const extremeTemp = thresholdF + 10; // e.g. 105°F
    const isExtreme = consecutiveDays >= 3 || peakTempF >= extremeTemp;
    const severity = isExtreme ? 'extreme' : consecutiveDays >= 2 ? 'warning' : 'none';
    const active = severity !== 'none';
    const boostMultiplier = isExtreme ? 1.5 : consecutiveDays >= 2 ? 1.25 : 1.0;
    return { active, severity, consecutiveDays, peakTempF, boostMultiplier };
}
function weatherCodeToDescription(code) {
    const codes = {
        0: 'Clear sky',
        1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Rime fog',
        51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
        61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
        71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
        80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
        95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail',
    };
    return codes[code] ?? 'Unknown';
}
//# sourceMappingURL=weather.js.map