import { EventEmitter } from 'node:events';
import { DEFAULT_RUN_MINUTES, MAX_RUN_MINUTES, FLOW_SENSOR_PULSES_PER_GALLON } from '../config.js';
import * as db from '../db/queries.js';
export class ZoneManager extends EventEmitter {
    gpio;
    running = new Map();
    masterOpen = false;
    rainDelayActive = false;
    rainDelayUntil = null;
    zoneNameCache = new Map();
    zoneGpioMap = new Map();
    zoneCount = 0;
    constructor(gpio) {
        super();
        this.gpio = gpio;
    }
    /** Load zone configuration from DB at startup */
    async init() {
        const zones = await db.getZones();
        for (const z of zones) {
            this.zoneNameCache.set(z.zone, z.name);
            if (z.gpio_pin != null) {
                this.zoneGpioMap.set(z.zone, z.gpio_pin);
            }
        }
        this.zoneCount = zones.length;
    }
    /** Initialize from a pin config (when loading from gpio_assignments) */
    initFromPinConfig(pinConfig) {
        for (const [zone, pin] of Object.entries(pinConfig.zoneValvePins)) {
            this.zoneGpioMap.set(Number(zone), pin);
        }
    }
    getZoneCount() {
        return this.zoneCount;
    }
    isValidZone(zone) {
        return zone >= 1 && zone <= this.zoneCount;
    }
    // ── Zone Start / Stop ───────────────────────────────
    async startZone(zone, durationMinutes, trigger = 'manual', scheduleId) {
        if (!this.isValidZone(zone))
            return { success: false, error: `Invalid zone (1-${this.zoneCount})` };
        if (this.running.has(zone))
            return { success: false, error: `Zone ${zone} already running` };
        const duration = Math.min(durationMinutes || DEFAULT_RUN_MINUTES, MAX_RUN_MINUTES);
        const pin = this.zoneGpioMap.get(zone);
        if (pin == null)
            return { success: false, error: `No GPIO pin configured for zone ${zone}` };
        // Ensure master valve is open
        if (!this.masterOpen) {
            this.gpio.openMaster();
            this.masterOpen = true;
            this.emit('master:open');
        }
        // Open zone valve
        this.gpio.openValve(pin);
        // Create execution log
        const logId = await db.createLog(zone, trigger, scheduleId);
        // Auto-stop timer
        const timer = setTimeout(() => {
            this.stopZone(zone, 'completed');
        }, duration * 60 * 1000);
        const runInfo = {
            zone,
            startedAt: new Date(),
            durationMinutes: duration,
            timer,
            logId,
            startPulseCount: this.gpio.getFlowPulseCount(),
            scheduleId: scheduleId ?? null,
        };
        this.running.set(zone, runInfo);
        const zoneName = this.zoneNameCache.get(zone) ?? `Zone ${zone}`;
        console.log(`[ZONE] Started zone ${zone} (${zoneName}) for ${duration} min`);
        this.emit('zone:start', this.getZoneState(zone));
        return { success: true };
    }
    async stopZone(zone, status = 'manual_stop') {
        const run = this.running.get(zone);
        if (!run)
            return { success: false, error: `Zone ${zone} not running` };
        const pin = this.zoneGpioMap.get(zone);
        clearTimeout(run.timer);
        // Close zone valve
        if (pin != null)
            this.gpio.closeValve(pin);
        // Calculate duration and volume
        const durationSeconds = Math.round((Date.now() - run.startedAt.getTime()) / 1000);
        const pulses = this.gpio.getFlowPulseCount() - run.startPulseCount;
        const volumeGallons = Math.round((pulses / FLOW_SENSOR_PULSES_PER_GALLON) * 10) / 10;
        // Update execution log
        await db.completeLog(run.logId, status, durationSeconds, volumeGallons || null);
        this.running.delete(zone);
        // Close master if no zones running
        if (this.running.size === 0 && this.masterOpen) {
            this.gpio.closeMaster();
            this.masterOpen = false;
            this.emit('master:close');
        }
        const zoneName = this.zoneNameCache.get(zone) ?? `Zone ${zone}`;
        console.log(`[ZONE] Stopped zone ${zone} (${zoneName}) — ${status}, ${durationSeconds}s, ${volumeGallons} gal`);
        this.emit('zone:stop', this.getZoneState(zone));
        return { success: true };
    }
    stopAll() {
        for (const zone of this.running.keys()) {
            this.stopZone(zone, 'manual_stop');
        }
    }
    // ── Rain Delay ──────────────────────────────────────
    async setRainDelay(hours) {
        this.rainDelayActive = true;
        this.rainDelayUntil = new Date(Date.now() + hours * 3600 * 1000);
        console.log(`[ZONE] Rain delay active for ${hours} hours`);
        this.emit('rain:delay', { active: true, until: this.rainDelayUntil.toISOString() });
        await db.createAlert('info', 'Rain Delay Active', `Smart delay has paused all non-priority schedules for ${hours} hours.`);
    }
    clearRainDelay() {
        this.rainDelayActive = false;
        this.rainDelayUntil = null;
        this.emit('rain:delay', { active: false });
    }
    isRainDelayed() {
        if (!this.rainDelayActive)
            return false;
        if (this.rainDelayUntil && this.rainDelayUntil < new Date()) {
            this.clearRainDelay();
            return false;
        }
        return true;
    }
    // ── State Queries ───────────────────────────────────
    getZoneState(zone) {
        const run = this.running.get(zone);
        let status = 'idle';
        let remainingSeconds = null;
        if (run) {
            status = 'running';
            const elapsed = (Date.now() - run.startedAt.getTime()) / 1000;
            remainingSeconds = Math.max(0, Math.round(run.durationMinutes * 60 - elapsed));
        }
        return {
            zone,
            name: this.zoneNameCache.get(zone) ?? `Zone ${zone}`,
            status,
            startedAt: run?.startedAt.toISOString() ?? null,
            remainingSeconds,
            lastRunAt: null,
            flowGpm: run ? this.gpio.getFlowGpm() : 0,
        };
    }
    getAllZoneStates() {
        const zones = [];
        for (let z = 1; z <= this.zoneCount; z++) {
            zones.push(this.getZoneState(z));
        }
        return zones;
    }
    getRunningZones() {
        return [...this.running.keys()];
    }
    isMasterValveOpen() {
        return this.masterOpen;
    }
    getRainDelayInfo() {
        return {
            active: this.isRainDelayed(),
            until: this.rainDelayUntil?.toISOString() ?? null,
        };
    }
    /** Refresh zone name cache from DB */
    async refreshNames() {
        const zones = await db.getZones();
        for (const z of zones) {
            this.zoneNameCache.set(z.zone, z.name);
        }
    }
}
//# sourceMappingURL=manager.js.map