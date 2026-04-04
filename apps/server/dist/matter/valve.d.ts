import { Endpoint } from '@matter/main';
import type { ZoneManager } from '../zones/manager.js';
/**
 * Create a Matter WaterValve endpoint for a HYDRA zone.
 * Uses closure to capture zoneManager/zoneNumber — each zone gets its own behavior class.
 */
export declare function createValveEndpoint(zoneManager: ZoneManager, zoneNumber: number, zoneName: string, isOpen: boolean): Endpoint;
/**
 * Create a read-only WaterValve endpoint for the master valve.
 * State is synced from ZoneManager events; Matter commands are ignored.
 */
export declare function createMasterValveEndpoint(isOpen: boolean): Endpoint;
//# sourceMappingURL=valve.d.ts.map