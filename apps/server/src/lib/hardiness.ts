import { getSetting } from '../db/queries.js';
import { WEATHER_LAT, WEATHER_LON } from '../config.js';

// USDA Plant Hardiness Zones — defined by average annual extreme minimum temperature (°F)
// Source: USDA Agricultural Research Service, 2023 revision
export interface HardinessZone {
  code: string;      // e.g. "5a"
  number: number;    // e.g. 5
  sub: 'a' | 'b';
  minTempF: number;  // lower bound
  maxTempF: number;  // upper bound
  label: string;     // e.g. "-20°F to -15°F"
  // Approximate frost dates (MM-DD) for continental locations
  lastFrostMmDd: string;   // last spring frost
  firstFrostMmDd: string;  // first fall frost
}

export const HARDINESS_ZONES: HardinessZone[] = [
  { code: '1a', number: 1, sub: 'a', minTempF: -60, maxTempF: -55, label: '-60°F to -55°F', lastFrostMmDd: '06-15', firstFrostMmDd: '08-15' },
  { code: '1b', number: 1, sub: 'b', minTempF: -55, maxTempF: -50, label: '-55°F to -50°F', lastFrostMmDd: '06-10', firstFrostMmDd: '08-20' },
  { code: '2a', number: 2, sub: 'a', minTempF: -50, maxTempF: -45, label: '-50°F to -45°F', lastFrostMmDd: '06-01', firstFrostMmDd: '08-25' },
  { code: '2b', number: 2, sub: 'b', minTempF: -45, maxTempF: -40, label: '-45°F to -40°F', lastFrostMmDd: '05-25', firstFrostMmDd: '09-01' },
  { code: '3a', number: 3, sub: 'a', minTempF: -40, maxTempF: -35, label: '-40°F to -35°F', lastFrostMmDd: '05-15', firstFrostMmDd: '09-10' },
  { code: '3b', number: 3, sub: 'b', minTempF: -35, maxTempF: -30, label: '-35°F to -30°F', lastFrostMmDd: '05-10', firstFrostMmDd: '09-15' },
  { code: '4a', number: 4, sub: 'a', minTempF: -30, maxTempF: -25, label: '-30°F to -25°F', lastFrostMmDd: '05-05', firstFrostMmDd: '09-20' },
  { code: '4b', number: 4, sub: 'b', minTempF: -25, maxTempF: -20, label: '-25°F to -20°F', lastFrostMmDd: '04-30', firstFrostMmDd: '09-25' },
  { code: '5a', number: 5, sub: 'a', minTempF: -20, maxTempF: -15, label: '-20°F to -15°F', lastFrostMmDd: '04-25', firstFrostMmDd: '10-01' },
  { code: '5b', number: 5, sub: 'b', minTempF: -15, maxTempF: -10, label: '-15°F to -10°F', lastFrostMmDd: '04-20', firstFrostMmDd: '10-05' },
  { code: '6a', number: 6, sub: 'a', minTempF: -10, maxTempF: -5,  label: '-10°F to -5°F',  lastFrostMmDd: '04-15', firstFrostMmDd: '10-10' },
  { code: '6b', number: 6, sub: 'b', minTempF: -5,  maxTempF: 0,   label: '-5°F to 0°F',    lastFrostMmDd: '04-10', firstFrostMmDd: '10-15' },
  { code: '7a', number: 7, sub: 'a', minTempF: 0,   maxTempF: 5,   label: '0°F to 5°F',     lastFrostMmDd: '04-05', firstFrostMmDd: '10-20' },
  { code: '7b', number: 7, sub: 'b', minTempF: 5,   maxTempF: 10,  label: '5°F to 10°F',    lastFrostMmDd: '03-30', firstFrostMmDd: '10-25' },
  { code: '8a', number: 8, sub: 'a', minTempF: 10,  maxTempF: 15,  label: '10°F to 15°F',   lastFrostMmDd: '03-20', firstFrostMmDd: '11-01' },
  { code: '8b', number: 8, sub: 'b', minTempF: 15,  maxTempF: 20,  label: '15°F to 20°F',   lastFrostMmDd: '03-10', firstFrostMmDd: '11-10' },
  { code: '9a', number: 9, sub: 'a', minTempF: 20,  maxTempF: 25,  label: '20°F to 25°F',   lastFrostMmDd: '02-28', firstFrostMmDd: '11-20' },
  { code: '9b', number: 9, sub: 'b', minTempF: 25,  maxTempF: 30,  label: '25°F to 30°F',   lastFrostMmDd: '02-15', firstFrostMmDd: '12-01' },
  { code: '10a', number: 10, sub: 'a', minTempF: 30, maxTempF: 35,  label: '30°F to 35°F',  lastFrostMmDd: '01-31', firstFrostMmDd: '12-15' },
  { code: '10b', number: 10, sub: 'b', minTempF: 35, maxTempF: 40,  label: '35°F to 40°F',  lastFrostMmDd: '01-15', firstFrostMmDd: '12-31' },
  { code: '11a', number: 11, sub: 'a', minTempF: 40, maxTempF: 45,  label: '40°F to 45°F',  lastFrostMmDd: '01-01', firstFrostMmDd: '12-31' },
  { code: '11b', number: 11, sub: 'b', minTempF: 45, maxTempF: 50,  label: '45°F to 50°F',  lastFrostMmDd: '01-01', firstFrostMmDd: '12-31' },
  { code: '12a', number: 12, sub: 'a', minTempF: 50, maxTempF: 55,  label: '50°F to 55°F',  lastFrostMmDd: '01-01', firstFrostMmDd: '12-31' },
  { code: '12b', number: 12, sub: 'b', minTempF: 55, maxTempF: 60,  label: '55°F to 60°F',  lastFrostMmDd: '01-01', firstFrostMmDd: '12-31' },
  { code: '13a', number: 13, sub: 'a', minTempF: 60, maxTempF: 65,  label: '60°F to 65°F',  lastFrostMmDd: '01-01', firstFrostMmDd: '12-31' },
  { code: '13b', number: 13, sub: 'b', minTempF: 65, maxTempF: 70,  label: '65°F to 70°F',  lastFrostMmDd: '01-01', firstFrostMmDd: '12-31' },
];

/** Map an extreme minimum temperature (°F) to a USDA zone code */
export function tempToZone(minTempF: number): string {
  for (const z of HARDINESS_ZONES) {
    if (minTempF >= z.minTempF && minTempF < z.maxTempF) return z.code;
  }
  if (minTempF < -60) return '1a';
  return '13b';
}

/** Parse zone code to numeric value (e.g. "5a" → 5.0, "5b" → 5.5) for comparisons */
export function zoneToNumber(code: string): number {
  const match = code.match(/^(\d+)(a|b)?$/);
  if (!match) return 5; // default
  const num = parseInt(match[1], 10);
  return match[2] === 'b' ? num + 0.5 : num;
}

/** Get the zone data for a code */
export function getZone(code: string): HardinessZone | undefined {
  return HARDINESS_ZONES.find(z => z.code === code.toLowerCase());
}

/** Recommend lawn/turf type based on hardiness zone */
export function getRecommendedTurfType(zoneCode: string): 'cool_turf' | 'warm_turf' {
  const num = zoneToNumber(zoneCode);
  // Zones 1-6: cool season, Zone 7+: warm season
  // Zone 7 is technically transition but warm-season grasses survive there
  if (num <= 6.5) return 'cool_turf';
  return 'warm_turf';
}

/** Get all recommended plant types for a zone, ordered by best fit */
export function getRecommendedPlantTypes(zoneCode: string): string[] {
  const num = zoneToNumber(zoneCode);
  const recommended: string[] = [];

  // Turf recommendation
  if (num <= 6.5) {
    recommended.push('cool_turf');
  } else if (num <= 8) {
    // Transition zone — both work
    recommended.push('cool_turf', 'warm_turf');
  } else {
    recommended.push('warm_turf');
  }

  // Trees — evergreens good in zones 2-8, shade trees 3-9
  if (num >= 2 && num <= 8) recommended.push('evergreen_trees');
  if (num >= 3 && num <= 9.5) recommended.push('shade_trees');
  if (num >= 4 && num <= 9.5) recommended.push('fruit_trees');

  // Universal
  recommended.push('perennials', 'annuals', 'vegetable', 'native_plants');
  if (num >= 7) recommended.push('xeriscape');

  return recommended;
}

/** Check if a date is within the growing season for a zone */
export function isInGrowingSeason(zoneCode: string, date: Date = new Date()): boolean {
  const zone = getZone(zoneCode);
  if (!zone) return true; // assume growing season if unknown

  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  const mmDd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return mmDd >= zone.lastFrostMmDd && mmDd <= zone.firstFrostMmDd;
}

/**
 * Detect hardiness zone from lat/lon using Open-Meteo historical weather data.
 * Fetches 5 years of daily minimum temperatures and finds the extreme minimum.
 */
export async function detectHardinessZone(lat?: number, lon?: number): Promise<{
  zone: string;
  minTempF: number;
  growingSeasonStart: string;
  growingSeasonEnd: string;
}> {
  // Use provided coords or read from settings
  if (lat === undefined || lon === undefined) {
    lat = parseFloat(await getSetting('weather_lat') ?? String(WEATHER_LAT));
    lon = parseFloat(await getSetting('weather_lon') ?? String(WEATHER_LON));
  }

  // Fetch 5 years of historical daily minimums
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1); // yesterday
  const startDate = new Date(endDate);
  startDate.setFullYear(startDate.getFullYear() - 5);

  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('start_date', startDate.toISOString().slice(0, 10));
  url.searchParams.set('end_date', endDate.toISOString().slice(0, 10));
  url.searchParams.set('daily', 'temperature_2m_min');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('timezone', 'auto');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo Archive API error: ${response.status}`);
  }

  const data = await response.json() as {
    daily: { temperature_2m_min: number[] };
  };

  const temps = data.daily.temperature_2m_min.filter(t => t != null);
  if (temps.length === 0) throw new Error('No historical temperature data available');

  const minTempF = Math.min(...temps);
  const zoneCode = tempToZone(minTempF);
  const zone = getZone(zoneCode)!;

  console.log(`[HARDINESS] Detected zone ${zoneCode} (min temp: ${minTempF.toFixed(1)}°F) for ${lat}, ${lon}`);

  return {
    zone: zoneCode,
    minTempF,
    growingSeasonStart: zone.lastFrostMmDd,
    growingSeasonEnd: zone.firstFrostMmDd,
  };
}
