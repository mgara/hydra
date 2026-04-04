import { EventEmitter } from 'node:events';
import { DEFAULT_RUN_MINUTES, MAX_RUN_MINUTES, FLOW_SENSOR_PULSES_PER_GALLON } from '../config.js';
import type { GpioController } from '../gpio/controller.js';
import type { GpioPinConfig, ZoneState, ZoneStatus } from '../types.js';
import * as db from '../db/queries.js';

interface RunningZone {
  zone: number;
  startedAt: Date;
  durationMinutes: number;
  timer: ReturnType<typeof setTimeout>;
  logId: number;
  startPulseCount: number;
  scheduleId: number | null;
}

export class ZoneManager extends EventEmitter {
  private gpio: GpioController;
  private running = new Map<number, RunningZone>();
  private masterOpen = false;
  private rainDelayActive = false;
  private rainDelayUntil: Date | null = null;
  private zoneNameCache = new Map<number, string>();
  private zoneGpioMap = new Map<number, number>();
  private zoneCount = 0;

  constructor(gpio: GpioController) {
    super();
    this.gpio = gpio;
  }

  /** Load zone configuration from DB at startup */
  async init(): Promise<void> {
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
  initFromPinConfig(pinConfig: GpioPinConfig): void {
    for (const [zone, pin] of Object.entries(pinConfig.zoneValvePins)) {
      this.zoneGpioMap.set(Number(zone), pin);
    }
  }

  getZoneCount(): number {
    return this.zoneCount;
  }

  isValidZone(zone: number): boolean {
    return zone >= 1 && zone <= this.zoneCount;
  }

  // ── Zone Start / Stop ───────────────────────────────

  async startZone(
    zone: number,
    durationMinutes?: number,
    trigger: 'manual' | 'scheduled' = 'manual',
    scheduleId?: number | null,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.isValidZone(zone)) return { success: false, error: `Invalid zone (1-${this.zoneCount})` };
    if (this.running.has(zone)) return { success: false, error: `Zone ${zone} already running` };

    const duration = Math.min(durationMinutes || DEFAULT_RUN_MINUTES, MAX_RUN_MINUTES);
    const pin = this.zoneGpioMap.get(zone);
    if (pin == null) return { success: false, error: `No GPIO pin configured for zone ${zone}` };

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

    const runInfo: RunningZone = {
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

  async stopZone(zone: number, status: string = 'manual_stop'): Promise<{ success: boolean; error?: string }> {
    const run = this.running.get(zone);
    if (!run) return { success: false, error: `Zone ${zone} not running` };

    const pin = this.zoneGpioMap.get(zone);
    clearTimeout(run.timer);

    // Close zone valve
    if (pin != null) this.gpio.closeValve(pin);

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

  stopAll(): void {
    for (const zone of this.running.keys()) {
      this.stopZone(zone, 'manual_stop');
    }
  }

  // ── Rain Delay ──────────────────────────────────────

  async setRainDelay(hours: number): Promise<void> {
    this.rainDelayActive = true;
    this.rainDelayUntil = new Date(Date.now() + hours * 3600 * 1000);
    console.log(`[ZONE] Rain delay active for ${hours} hours`);
    this.emit('rain:delay', { active: true, until: this.rainDelayUntil.toISOString() });

    await db.createAlert('info', 'Rain Delay Active',
      `Smart delay has paused all non-priority schedules for ${hours} hours.`);
  }

  clearRainDelay(): void {
    this.rainDelayActive = false;
    this.rainDelayUntil = null;
    this.emit('rain:delay', { active: false });
  }

  isRainDelayed(): boolean {
    if (!this.rainDelayActive) return false;
    if (this.rainDelayUntil && this.rainDelayUntil < new Date()) {
      this.clearRainDelay();
      return false;
    }
    return true;
  }

  // ── State Queries ───────────────────────────────────

  getZoneState(zone: number): ZoneState {
    const run = this.running.get(zone);

    let status: ZoneStatus = 'idle';
    let remainingSeconds: number | null = null;

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

  getAllZoneStates(): ZoneState[] {
    const zones: ZoneState[] = [];
    for (let z = 1; z <= this.zoneCount; z++) {
      zones.push(this.getZoneState(z));
    }
    return zones;
  }

  getRunningZones(): number[] {
    return [...this.running.keys()];
  }

  isMasterValveOpen(): boolean {
    return this.masterOpen;
  }

  getRainDelayInfo(): { active: boolean; until: string | null } {
    return {
      active: this.isRainDelayed(),
      until: this.rainDelayUntil?.toISOString() ?? null,
    };
  }

  /** Refresh zone name cache from DB */
  async refreshNames(): Promise<void> {
    const zones = await db.getZones();
    for (const z of zones) {
      this.zoneNameCache.set(z.zone, z.name);
    }
  }
}
