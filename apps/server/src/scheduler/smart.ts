import * as db from '../db/queries.js';
import { fetchWeather, getHeatWaveStatus } from './weather.js';

// Soil profiles — intake rate (in/hr) and available water capacity (in/ft)
// Sources: USDA NRCS, FAO-56
const SOIL_DATA: Record<string, { intakeRate: number; awc: number }> = {
  sand:       { intakeRate: 2.0,  awc: 0.70 },
  sandy_loam: { intakeRate: 1.0,  awc: 1.10 },
  loam:       { intakeRate: 0.5,  awc: 1.70 },
  clay_loam:  { intakeRate: 0.3,  awc: 1.80 },
  silt_loam:  { intakeRate: 0.4,  awc: 2.00 },
  silty_clay: { intakeRate: 0.2,  awc: 1.60 },
  clay:       { intakeRate: 0.1,  awc: 1.50 },
};

// Plant profiles — root depth (in), crop coefficient, management allowed depletion
const PLANT_DATA: Record<string, { rootDepth: number; kc: number; mad: number }> = {
  cool_turf:   { rootDepth: 6,  kc: 0.80, mad: 0.50 },
  warm_turf:   { rootDepth: 8,  kc: 0.60, mad: 0.50 },
  annuals:     { rootDepth: 6,  kc: 0.80, mad: 0.50 },
  perennials:  { rootDepth: 18, kc: 0.50, mad: 0.50 },
  trees:       { rootDepth: 36, kc: 0.50, mad: 0.50 },
  xeriscape:   { rootDepth: 12, kc: 0.30, mad: 0.60 },
  vegetable:   { rootDepth: 12, kc: 0.75, mad: 0.40 },
};

export interface SmartDuration {
  minutes: number;
  method: 'smart' | 'fixed';
  waterNeededIn: number;     // inches of water to apply
  intakeRate: number;        // in/hr
  rootDepth: number;         // inches
  et0In: number | null;      // today's ET₀ in inches (null if unavailable)
  heatWaveBoost: number;     // multiplier applied (1.0 = none)
}

/**
 * Calculate the smart irrigation duration for a zone.
 *
 * Two approaches depending on ET₀ availability:
 *
 * 1. **ET₀-based** (preferred): water_need = ET₀ × Kc
 *    runtime = (water_need / intake_rate) × 60
 *
 * 2. **Soil-budget fallback**: water_budget = AWC × (rootDepth/12) × MAD
 *    runtime = (water_budget / intake_rate) × 60
 *
 * Returns the fixed schedule duration if smart isn't possible (no profile configured).
 */
export async function calculateSmartDuration(
  zone: number,
  fallbackMinutes: number,
): Promise<SmartDuration> {
  const zones = await db.getZones();
  const zoneRow = zones.find(z => z.zone === zone);

  if (!zoneRow || !zoneRow.smart_enabled || !zoneRow.soil_type || !zoneRow.plant_type) {
    return { minutes: fallbackMinutes, method: 'fixed', waterNeededIn: 0, intakeRate: 0, rootDepth: 0, et0In: null, heatWaveBoost: 1.0 };
  }

  const soil = SOIL_DATA[zoneRow.soil_type];
  const plant = PLANT_DATA[zoneRow.plant_type];
  if (!soil || !plant) {
    return { minutes: fallbackMinutes, method: 'fixed', waterNeededIn: 0, intakeRate: 0, rootDepth: 0, et0In: null, heatWaveBoost: 1.0 };
  }

  // Try to get today's ET₀ from weather
  let et0In: number | null = null;
  let heatWaveBoost = 1.0;
  try {
    const weather = await fetchWeather();
    const todayForecast = weather.forecastDays[0];
    if (todayForecast?.et0Mm != null) {
      et0In = todayForecast.et0Mm / 25.4; // mm → inches
    }
    // Check heat wave status (always reads latest threshold from settings)
    const boostEnabled = await db.getSetting('heat_wave_boost_enabled');
    if (boostEnabled !== 'false') {
      const heatWave = await getHeatWaveStatus();
      if (heatWave.active) {
        heatWaveBoost = heatWave.boostMultiplier;
      }
    }
  } catch { /* use fallback */ }

  let waterNeededIn: number;

  if (et0In != null && et0In > 0) {
    // ET₀-based: replace exactly what was lost today
    waterNeededIn = et0In * plant.kc;
  } else {
    // Soil-budget fallback: refill root zone from MAD to field capacity
    waterNeededIn = soil.awc * (plant.rootDepth / 12) * plant.mad;
  }

  // Apply heat wave boost
  waterNeededIn *= heatWaveBoost;

  // Runtime = water needed / soil intake rate
  const runtimeMinutes = Math.round((waterNeededIn / soil.intakeRate) * 60);

  // Clamp to reasonable range (1 min – 120 min)
  const clamped = Math.max(1, Math.min(120, runtimeMinutes));

  return {
    minutes: clamped,
    method: 'smart',
    waterNeededIn,
    intakeRate: soil.intakeRate,
    rootDepth: plant.rootDepth,
    et0In,
    heatWaveBoost,
  };
}
