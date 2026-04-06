import { ZoneManager } from '../zones/manager.js';
import type { MqttClient } from '../mqtt/client.js';
export declare class Scheduler {
    private zoneManager;
    private mqttClient;
    private tasks;
    private weatherCheckTask;
    private syncTask;
    /** Track which schedules we've already executed this minute to avoid double-runs */
    private recentlyExecuted;
    /** Track last heat wave severity to avoid duplicate alerts */
    private lastHeatWaveSeverity;
    constructor(zoneManager: ZoneManager, mqttClient?: MqttClient | null);
    start(): Promise<void>;
    stop(): void;
    private checkWeather;
    syncSchedules(): Promise<void>;
    /**
     * After syncing, check if any schedule's time window includes "right now".
     * This catches schedules that were created/synced after the cron minute passed.
     */
    private checkDueSchedules;
    private executeSchedule;
    /** Disable schedules that have passed their expiry date */
    private disableExpiredSchedules;
}
//# sourceMappingURL=cron.d.ts.map