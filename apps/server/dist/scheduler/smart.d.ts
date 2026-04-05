import type { ScheduleInput } from '../types.js';
export interface SmartDuration {
    minutes: number;
    method: 'smart' | 'fixed';
    waterNeededIn: number;
    intakeRate: number;
    rootDepth: number;
    et0In: number | null;
    heatWaveBoost: number;
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
export declare function calculateSmartDuration(zone: number, fallbackMinutes: number): Promise<SmartDuration>;
export interface SmartScheduleRecommendation {
    schedule: ScheduleInput;
    frequencyLabel: string;
    reason: string;
}
/**
 * Generate a smart schedule for a zone based on its soil/plant profile.
 * Staggers start time so zones don't overlap (low pressure protection).
 * Returns null if the zone doesn't have a complete profile.
 */
export declare function generateSmartSchedule(zone: number): Promise<SmartScheduleRecommendation | null>;
/**
 * Create or update the smart schedule for a zone.
 * Removes any existing smart schedules for the zone first,
 * then re-staggers all other smart schedules to avoid overlap.
 */
export declare function applySmartSchedule(zone: number): Promise<{
    created: boolean;
    schedule?: SmartScheduleRecommendation;
}>;
/**
 * Remove all smart schedules for a zone.
 * Re-staggers remaining smart schedules after removal.
 */
export declare function removeSmartSchedules(zone: number): Promise<number>;
//# sourceMappingURL=smart.d.ts.map