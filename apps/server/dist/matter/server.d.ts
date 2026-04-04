import './init.js';
import '@matter/nodejs';
import type { ZoneManager } from '../zones/manager.js';
export interface MatterBridge {
    stop(): Promise<void>;
}
export declare function startMatterServer(zoneManager: ZoneManager): Promise<MatterBridge>;
//# sourceMappingURL=server.d.ts.map