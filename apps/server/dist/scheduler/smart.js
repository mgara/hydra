import * as db from '../db/queries.js';
import { fetchWeather, getHeatWaveStatus } from './weather.js';
// Soil profiles — intake rate (in/hr) and available water capacity (in/ft)
// Sources: USDA NRCS, FAO-56
const SOIL_DATA = {
    sand: { intakeRate: 2.0, awc: 0.70 },
    sandy_loam: { intakeRate: 1.0, awc: 1.10 },
    loam: { intakeRate: 0.5, awc: 1.70 },
    clay_loam: { intakeRate: 0.3, awc: 1.80 },
    silt_loam: { intakeRate: 0.4, awc: 2.00 },
    silty_clay: { intakeRate: 0.2, awc: 1.60 },
    clay: { intakeRate: 0.1, awc: 1.50 },
};
// Plant profiles — root depth (in), crop coefficient, management allowed depletion
const PLANT_DATA = {
    cool_turf: { rootDepth: 6, kc: 0.80, mad: 0.50 },
    warm_turf: { rootDepth: 8, kc: 0.60, mad: 0.50 },
    evergreen_trees: { rootDepth: 18, kc: 0.45, mad: 0.50 },
    shade_trees: { rootDepth: 36, kc: 0.50, mad: 0.50 },
    fruit_trees: { rootDepth: 24, kc: 0.65, mad: 0.45 },
    annuals: { rootDepth: 6, kc: 0.80, mad: 0.50 },
    perennials: { rootDepth: 18, kc: 0.50, mad: 0.50 },
    vegetable: { rootDepth: 12, kc: 0.75, mad: 0.40 },
    native_plants: { rootDepth: 18, kc: 0.35, mad: 0.55 },
    xeriscape: { rootDepth: 12, kc: 0.30, mad: 0.60 },
};
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
export async function calculateSmartDuration(zone, fallbackMinutes) {
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
    let et0In = null;
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
    }
    catch { /* use fallback */ }
    let waterNeededIn;
    if (et0In != null && et0In > 0) {
        // ET₀-based: replace exactly what was lost today
        waterNeededIn = et0In * plant.kc;
    }
    else {
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
// KEY: turf on M/W/F, trees on T/Th/Sat — avoids overlap so zones don't compete for pressure
const WATERING_FREQUENCY = {
    cool_turf: { days: ['mon', 'wed', 'fri'], label: '3x/week' },
    warm_turf: { days: ['tue', 'fri'], label: '2x/week' },
    evergreen_trees: { days: ['tue', 'thu', 'sat', 'sun'], label: '4x/week (establishing)' },
    shade_trees: { days: ['tue', 'sat'], label: '2x/week' },
    fruit_trees: { days: ['tue', 'thu', 'sat'], label: '3x/week' },
    annuals: { days: ['mon', 'wed', 'fri'], label: '3x/week' },
    perennials: { days: ['tue', 'sat'], label: '2x/week' },
    vegetable: { days: ['mon', 'wed', 'fri', 'sun'], label: '4x/week' },
    native_plants: { days: ['wed'], label: '1x/week' },
    xeriscape: { days: ['sat'], label: '1x/week' },
};
// Preferred start mode per plant type
const PREFERRED_START = {
    cool_turf: { mode: 'sunrise', offset: -30, fixedTime: '06:00' }, // before sunrise to reduce evaporation
    warm_turf: { mode: 'sunrise', offset: -30, fixedTime: '06:00' },
    evergreen_trees: { mode: 'sunrise', offset: 0, fixedTime: '06:30' },
    shade_trees: { mode: 'sunrise', offset: 0, fixedTime: '06:30' },
    fruit_trees: { mode: 'sunrise', offset: -15, fixedTime: '06:00' },
    annuals: { mode: 'sunrise', offset: -15, fixedTime: '06:00' },
    perennials: { mode: 'sunrise', offset: 0, fixedTime: '06:30' },
    vegetable: { mode: 'sunrise', offset: -15, fixedTime: '06:00' }, // early to keep leaves dry
    native_plants: { mode: 'sunrise', offset: 30, fixedTime: '07:00' },
    xeriscape: { mode: 'sunrise', offset: 30, fixedTime: '07:00' },
};
/** Check if two schedules share any common days */
function hasOverlappingDays(daysA, daysB) {
    const setA = new Set(daysA.split(','));
    for (const d of daysB.split(',')) {
        if (setA.has(d))
            return true;
    }
    return false;
}
/**
 * Generate a smart schedule for a zone based on its soil/plant profile.
 * Staggers start time so zones don't overlap (low pressure protection).
 * Returns null if the zone doesn't have a complete profile.
 */
export async function generateSmartSchedule(zone) {
    const zones = await db.getZones();
    const zoneRow = zones.find(z => z.zone === zone);
    if (!zoneRow?.soil_type || !zoneRow?.plant_type)
        return null;
    const plant = PLANT_DATA[zoneRow.plant_type];
    const soil = SOIL_DATA[zoneRow.soil_type];
    if (!plant || !soil)
        return null;
    const freq = WATERING_FREQUENCY[zoneRow.plant_type] ?? WATERING_FREQUENCY.cool_turf;
    const start = PREFERRED_START[zoneRow.plant_type] ?? PREFERRED_START.cool_turf;
    // Calculate a baseline duration using soil-budget method (ET₀ adjusts at runtime)
    const waterNeededIn = soil.awc * (plant.rootDepth / 12) * plant.mad;
    const baseMinutes = Math.max(1, Math.min(120, Math.round((waterNeededIn / soil.intakeRate) * 60)));
    // Create with base offset — restagger will fix the final offset
    const schedule = {
        zone,
        name: `Smart — ${zoneRow.name}`,
        startTime: start.fixedTime,
        startMode: start.mode,
        startOffset: start.offset,
        durationMinutes: baseMinutes,
        days: freq.days.join(','),
        enabled: true,
        rainSkip: true,
        priority: false,
        smart: true,
    };
    const plantLabel = zoneRow.plant_type.replace(/_/g, ' ');
    const reason = `${plantLabel} in ${zoneRow.soil_type.replace(/_/g, ' ')} soil — ${freq.label}, ${baseMinutes} min base duration (adjusted daily by ET₀)`;
    return { schedule, frequencyLabel: freq.label, reason };
}
/**
 * Create or update the smart schedule for a zone.
 * Removes any existing smart schedules for the zone first,
 * then re-staggers all other smart schedules to avoid overlap.
 */
export async function applySmartSchedule(zone) {
    // Remove existing smart schedules for this zone
    await removeSmartSchedules(zone);
    const recommendation = await generateSmartSchedule(zone);
    if (!recommendation)
        return { created: false };
    await db.createSchedule(recommendation.schedule);
    console.log(`[SMART] Created schedule for zone ${zone}: ${recommendation.reason}`);
    // Re-stagger all smart schedules (including the new one) to avoid overlap
    await restaggerAllSmartSchedules();
    return { created: true, schedule: recommendation };
}
/**
 * Re-stagger all smart schedules so they run sequentially without overlap.
 * Groups by overlapping days — schedules on different days don't need staggering.
 */
async function restaggerAllSmartSchedules() {
    const allSchedules = await db.getSchedules();
    const smartSchedules = allSchedules
        .filter(s => s.smart)
        .sort((a, b) => a.zone - b.zone);
    const allZones = await db.getZones();
    const BUFFER_MINUTES = 2;
    // Group schedules by day overlap — build conflict groups
    const processed = new Set();
    for (const s of smartSchedules) {
        if (processed.has(s.id))
            continue;
        // Find all schedules that share days with this one (transitive)
        const group = [s];
        processed.add(s.id);
        for (const other of smartSchedules) {
            if (processed.has(other.id))
                continue;
            if (group.some(g => hasOverlappingDays(g.days, other.days))) {
                group.push(other);
                processed.add(other.id);
            }
        }
        // Stagger within this group
        let cumulativeOffset = 0;
        for (const gs of group) {
            const zoneRow = allZones.find(z => z.zone === gs.zone);
            if (!zoneRow?.plant_type)
                continue;
            const start = PREFERRED_START[zoneRow.plant_type] ?? PREFERRED_START.cool_turf;
            const newOffset = start.offset + cumulativeOffset;
            if (gs.startOffset !== newOffset) {
                await db.updateSchedule(gs.id, { startOffset: newOffset });
            }
            cumulativeOffset += gs.durationMinutes + BUFFER_MINUTES;
        }
    }
}
/**
 * Remove all smart schedules for a zone.
 * Re-staggers remaining smart schedules after removal.
 */
export async function removeSmartSchedules(zone) {
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
//# sourceMappingURL=smart.js.map