import { EventEmitter } from 'node:events';
import type { GpioController } from '../gpio/controller.js';
import type { GpioPinConfig, ZoneState } from '../types.js';
export declare class ZoneManager extends EventEmitter {
    private gpio;
    private running;
    private masterOpen;
    private rainDelayActive;
    private rainDelayUntil;
    private zoneNameCache;
    private zoneGpioMap;
    private zoneCount;
    constructor(gpio: GpioController);
    /** Load zone configuration from DB at startup */
    init(): Promise<void>;
    /** Initialize from a pin config (when loading from gpio_assignments) */
    initFromPinConfig(pinConfig: GpioPinConfig): void;
    getZoneCount(): number;
    isValidZone(zone: number): boolean;
    startZone(zone: number, durationMinutes?: number, trigger?: 'manual' | 'scheduled', scheduleId?: number | null): Promise<{
        success: boolean;
        error?: string;
    }>;
    stopZone(zone: number, status?: string): Promise<{
        success: boolean;
        error?: string;
    }>;
    stopAll(): void;
    setRainDelay(hours: number): Promise<void>;
    clearRainDelay(): void;
    isRainDelayed(): boolean;
    getZoneState(zone: number): ZoneState;
    getAllZoneStates(): ZoneState[];
    getRunningZones(): number[];
    isMasterValveOpen(): boolean;
    getRainDelayInfo(): {
        active: boolean;
        until: string | null;
    };
    /** Refresh zone name cache from DB */
    refreshNames(): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map