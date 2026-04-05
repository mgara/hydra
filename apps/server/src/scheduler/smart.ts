import * as db from '../db/queries.js';
import { fetchWeather, getHeatWaveStatus } from './weather.js';
import type { ScheduleInput } from '../types.js';

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
  cool_turf:       { rootDepth: 6,  kc: 0.80, mad: 0.50 },
  warm_turf:       { rootDepth: 8,  kc: 0.60, mad: 0.50 },
  evergreen_trees: { rootDepth: 18, kc: 0.45, mad: 0.50 },
  shade_trees:     { rootDepth: 36, kc: 0.50, mad: 0.50 },
  fruit_trees:     { rootDepth: 24, kc: 0.65, mad: 0.45 },
  annuals:         { rootDepth: 6,  kc: 0.80, mad: 0.50 },
  perennials:      { rootDepth: 18, kc: 0.50, mad: 0.50 },
  vegetable:       { rootDepth: 12, kc: 0.75, mad: 0.40 },
  native_plants:   { rootDepth: 18, kc: 0.35, mad: 0.55 },
  xeriscape:       { rootDepth: 12, kc: 0.30, mad: 0.60 },
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

// ── Smart Schedule Recommendation ─────────────────────────

// Watering frequency per plant type (days per week)
// Based on university extension program recommendations
const WATERING_FREQUENCY: Record<string, { days: string[]; label: string }> = {
  cool_turf:       { days: ['mon', 'wed', 'fri'],               label: '3x/week' },
  warm_turf:       { days: ['tue', 'fri'],                      label: '2x/week' },
  evergreen_trees: { days: ['mon', 'wed', 'fri', 'sun'],       label: '4x/week (establishing)' },
  shade_trees:     { days: ['mon', 'thu'],                      label: '2x/week' },
  fruit_trees:     { days: ['mon', 'wed', 'fri'],               label: '3x/week' },
  annuals:         { days: ['mon', 'wed', 'fri', 'sun'],       label: '4x/week' },
  perennials:      { days: ['tue', 'fri'],                      label: '2x/week' },
  vegetable:       { days: ['mon', 'wed', 'fri', 'sun'],       label: '4x/week' },
  native_plants:   { days: ['wed'],                             label: '1x/week' },
  xeriscape:       { days: ['wed'],                             label: '1x/week' },
};

// Preferred start mode per plant type
const PREFERRED_START: Record<string, { mode: 'sunrise' | 'sunset' | 'fixed'; offset: number; fixedTime: string }> = {
  cool_turf:       { mode: 'sunrise', offset: -30, fixedTime: '06:00' },  // before sunrise to reduce evaporation
  warm_turf:       { mode: 'sunrise', offset: -30, fixedTime: '06:00' },
  evergreen_trees: { mode: 'sunrise', offset: 0,   fixedTime: '06:30' },
  shade_trees:     { mode: 'sunrise', offset: 0,   fixedTime: '06:30' },
  fruit_trees:     { mode: 'sunrise', offset: -15, fixedTime: '06:00' },
  annuals:         { mode: 'sunrise', offset: -15, fixedTime: '06:00' },
  perennials:      { mode: 'sunrise', offset: 0,   fixedTime: '06:30' },
  vegetable:       { mode: 'sunrise', offset: -15, fixedTime: '06:00' },  // early to keep leaves dry
  native_plants:   { mode: 'sunrise', offset: 30,  fixedTime: '07:00' },
  xeriscape:       { mode: 'sunrise', offset: 30,  fixedTime: '07:00' },
};

export interface SmartScheduleRecommendation {
  schedule: ScheduleInput;
  frequencyLabel: string;
  reason: string;
}

/**
 * Calculate how many minutes of existing smart schedules could overlap.
 * Returns the total offset needed so this zone starts after all others finish.
 * Uses a 2-minute buffer between zones for valve switching.
 */
async function calculateStaggerOffset(zone: number): Promise<number> {
  const allSchedules = await db.getSchedules();
  const smartSchedules = allSchedules.filter(s => s.smart && s.zone !== zone);
  if (smartSchedules.length === 0) return 0;

  // Sum up all existing smart schedule durations + 2 min buffer each
  const BUFFER_MINUTES = 2;
  let totalOffset = 0;
  for (const s of smartSchedules) {
    totalOffset += s.durationMinutes + BUFFER_MINUTES;
  }
  return totalOffset;
}

/**
 * Generate a smart schedule for a zone based on its soil/plant profile.
 * Staggers start time so zones don't overlap (low pressure protection).
 * Returns null if the zone doesn't have a complete profile.
 */
export async function generateSmartSchedule(zone: number): Promise<SmartScheduleRecommendation | null> {
  const zones = await db.getZones();
  const zoneRow = zones.find(z => z.zone === zone);
  if (!zoneRow?.soil_type || !zoneRow?.plant_type) return null;

  const plant = PLANT_DATA[zoneRow.plant_type];
  const soil = SOIL_DATA[zoneRow.soil_type];
  if (!plant || !soil) return null;

  const freq = WATERING_FREQUENCY[zoneRow.plant_type] ?? WATERING_FREQUENCY.cool_turf;
  const start = PREFERRED_START[zoneRow.plant_type] ?? PREFERRED_START.cool_turf;

  // Calculate a baseline duration using soil-budget method (ET₀ adjusts at runtime)
  const waterNeededIn = soil.awc * (plant.rootDepth / 12) * plant.mad;
  const baseMinutes = Math.max(1, Math.min(120, Math.round((waterNeededIn / soil.intakeRate) * 60)));

  // Stagger: offset this zone's start so it runs after all other smart schedules
  const staggerOffset = await calculateStaggerOffset(zone);
  const effectiveOffset = start.offset + staggerOffset;

  const schedule: ScheduleInput = {
    zone,
    name: `Smart — ${zoneRow.name}`,
    startTime: start.fixedTime,
    startMode: start.mode,
    startOffset: effectiveOffset,
    durationMinutes: baseMinutes,
    days: freq.days.join(','),
    enabled: true,
    rainSkip: true,
    priority: false,
    smart: true,
  };

  const plantLabel = zoneRow.plant_type.replace(/_/g, ' ');
  const staggerNote = staggerOffset > 0 ? `, staggered +${staggerOffset}min` : '';
  const reason = `${plantLabel} in ${zoneRow.soil_type.replace(/_/g, ' ')} soil — ${freq.label}, ${baseMinutes} min base duration (adjusted daily by ET₀)${staggerNote}`;

  return { schedule, frequencyLabel: freq.label, reason };
}

/**
 * Create or update the smart schedule for a zone.
 * Removes any existing smart schedules for the zone first,
 * then re-staggers all other smart schedules to avoid overlap.
 */
export async function applySmartSchedule(zone: number): Promise<{ created: boolean; schedule?: SmartScheduleRecommendation }> {
  // Remove existing smart schedules for this zone
  await removeSmartSchedules(zone);

  const recommendation = await generateSmartSchedule(zone);
  if (!recommendation) return { created: false };

  await db.createSchedule(recommendation.schedule);
  console.log(`[SMART] Created schedule for zone ${zone}: ${recommendation.reason}`);

  // Re-stagger all other smart schedules to account for the new one
  await restaggerAllSmartSchedules(zone);

  return { created: true, schedule: recommendation };
}

/**
 * Re-stagger all smart schedules so they run sequentially without overlap.
 * Called after adding/removing a smart schedule.
 * Optionally skip a zone that was just created (already has correct offset).
 */
async function restaggerAllSmartSchedules(skipZone?: number): Promise<void> {
  const allSchedules = await db.getSchedules();
  const smartSchedules = allSchedules
    .filter(s => s.smart)
    .sort((a, b) => a.zone - b.zone); // deterministic order by zone number

  const BUFFER_MINUTES = 2;
  let cumulativeOffset = 0;

  for (const s of smartSchedules) {
    const zones = await db.getZones();
    const zoneRow = zones.find(z => z.zone === s.zone);
    if (!zoneRow?.plant_type) continue;

    const start = PREFERRED_START[zoneRow.plant_type] ?? PREFERRED_START.cool_turf;
    const newOffset = start.offset + cumulativeOffset;

    if (s.zone !== skipZone && s.startOffset !== newOffset) {
      await db.updateSchedule(s.id, { startOffset: newOffset });
    }

    cumulativeOffset += s.durationMinutes + BUFFER_MINUTES;
  }
}

/**
 * Remove all smart schedules for a zone.
 * Re-staggers remaining smart schedules after removal.
 */
export async function removeSmartSchedules(zone: number): Promise<number> {
  const schedules = await db.getSchedules(zone);
  let removed = 0;
  for (const s of schedules) {
    if (s.smart) {
      await db.deleteSchedule(s.id);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[SMART] Removed ${removed} smart schedule(s) for zone ${zone}`);
    // Re-stagger remaining schedules to close the gap
    await restaggerAllSmartSchedules();
  }
  return removed;
}
