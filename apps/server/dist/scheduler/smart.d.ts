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
//# sourceMappingURL=smart.d.ts.map