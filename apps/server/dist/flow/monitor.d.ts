import { EventEmitter } from 'node:events';
import type { GpioController } from '../gpio/controller.js';
import type { ZoneManager } from '../zones/manager.js';
import type { FlowSettings } from '../db/queries.js';
export declare class FlowMonitor extends EventEmitter {
    private gpio;
    private zoneManager;
    private samplingInterval;
    private pruneInterval;
    private noFlowTimers;
    private lastZoneStopTime;
    private settings;
    private lastAlarmTime;
    private readonly ALARM_COOLDOWN_MS;
    constructor(gpio: GpioController, zoneManager: ZoneManager);
    init(): Promise<void>;
    reloadSettings(): Promise<void>;
    shutdown(): void;
    getSettings(): FlowSettings;
    private startSampling;
    private stopSampling;
    private sample;
    private checkExcessiveFlow;
    private onZoneStart;
    private onZoneStop;
    private checkNoFlow;
    private checkLeakDetection;
    private isAlarmCoolingDown;
}
//# sourceMappingURL=monitor.d.ts.map