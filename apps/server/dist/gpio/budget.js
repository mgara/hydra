import { AVAILABLE_GPIO_POOL, MAX_ZONES, MAX_ZONES_WITH_PER_ZONE_FLOW } from '../config.js';
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
export function calculateGpioBudget(input) {
    const pool = [...AVAILABLE_GPIO_POOL];
    const assignments = [];
    let idx = 0;
    const maxZones = input.perZoneFlow ? MAX_ZONES_WITH_PER_ZONE_FLOW : MAX_ZONES;
    if (input.zoneCount < 1 || input.zoneCount > maxZones) {
        return {
            valid: false,
            totalRequired: 0,
            totalAvailable: pool.length,
            remaining: 0,
            assignments: [],
        };
    }
    // 1. Master valve (always)
    assignments.push({ role: 'master_valve', pin: pool[idx++], zone: null, label: 'Master Valve' });
    // 2. Master flow sensor (always)
    assignments.push({ role: 'master_flow', pin: pool[idx++], zone: null, label: 'Master Flow Sensor' });
    // 3. Rain sensor (if enabled)
    if (input.hasRainSensor) {
        assignments.push({ role: 'rain_sensor', pin: pool[idx++], zone: null, label: 'Rain Sensor' });
    }
    // 4. Zone valves + optional per-zone flow sensors
    for (let z = 1; z <= input.zoneCount; z++) {
        if (idx >= pool.length) {
            return {
                valid: false,
                totalRequired: idx + (input.zoneCount - z + 1) * (input.perZoneFlow ? 2 : 1),
                totalAvailable: pool.length,
                remaining: 0,
                assignments: [],
            };
        }
        assignments.push({ role: 'zone_valve', pin: pool[idx++], zone: z, label: `Zone ${z} Valve` });
        if (input.perZoneFlow) {
            if (idx >= pool.length) {
                return {
                    valid: false,
                    totalRequired: idx + 1,
                    totalAvailable: pool.length,
                    remaining: 0,
                    assignments: [],
                };
            }
            assignments.push({ role: 'zone_flow', pin: pool[idx++], zone: z, label: `Zone ${z} Flow Sensor` });
        }
    }
    return {
        valid: true,
        totalRequired: idx,
        totalAvailable: pool.length,
        remaining: pool.length - idx,
        assignments,
    };
}
//# sourceMappingURL=budget.js.map