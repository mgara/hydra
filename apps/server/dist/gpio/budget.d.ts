import type { SetupInput, GpioBudget } from '../types.js';
/**
 * Calculate GPIO pin assignments based on setup input.
 * Pure function — no side effects, deterministic output.
 *
 * Assignment order (sequential from pool):
 * 1. Master valve (always)
 * 2. Master flow sensor (always)
 * 3. Rain sensor (if enabled)
 * 4. For each zone: valve pin + optional flow pin
 */
export declare function calculateGpioBudget(input: SetupInput): GpioBudget;
//# sourceMappingURL=budget.d.ts.map