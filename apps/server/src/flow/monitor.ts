import { EventEmitter } from 'node:events';
import type { GpioController } from '../gpio/controller.js';
import type { ZoneManager } from '../zones/manager.js';
import * as db from '../db/queries.js';
import type { FlowSettings } from '../db/queries.js';

export class FlowMonitor extends EventEmitter {
  private gpio: GpioController;
  private zoneManager: ZoneManager;
  private samplingInterval: ReturnType<typeof setInterval> | null = null;
  private pruneInterval: ReturnType<typeof setInterval> | null = null;
  private noFlowTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private lastZoneStopTime = 0;
  private settings: FlowSettings = {
    flowMonitoringEnabled: true,
    flowSafetyEnabled: true,
    flowLeakDetectDelaySeconds: 30,
    flowNoFlowTimeoutSeconds: 60,
    flowMaxGpm: 15,
    flowExpectedGpm: 5,
    flowReadingIntervalSeconds: 5,
  };
  private lastAlarmTime = new Map<string, number>();
  private readonly ALARM_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between same alarm type

  constructor(gpio: GpioController, zoneManager: ZoneManager) {
    super();
    this.gpio = gpio;
    this.zoneManager = zoneManager;
  }

  async init(): Promise<void> {
    await this.reloadSettings();

    // Listen for zone events
    this.zoneManager.on('zone:start', (data: { zone: number }) => {
      this.onZoneStart(data.zone);
    });
    this.zoneManager.on('zone:stop', (data: { zone: number }) => {
      this.onZoneStop(data.zone);
    });

    // Start sampling loop
    this.startSampling();

    // Prune old readings once daily
    this.pruneInterval = setInterval(() => {
      db.pruneOldFlowReadings(7).catch(console.error);
    }, 24 * 60 * 60 * 1000);

    console.log('[FLOW] Flow monitor initialized');
  }

  async reloadSettings(): Promise<void> {
    this.settings = await db.getFlowSettings();

    // Restart sampling with new interval
    if (this.samplingInterval) {
      this.stopSampling();
      this.startSampling();
    }
  }

  shutdown(): void {
    this.stopSampling();
    if (this.pruneInterval) clearInterval(this.pruneInterval);
    for (const timer of this.noFlowTimers.values()) {
      clearTimeout(timer);
    }
    this.noFlowTimers.clear();
    console.log('[FLOW] Flow monitor shutdown');
  }

  getSettings(): FlowSettings {
    return { ...this.settings };
  }

  // ── Sampling Loop ──────────────────────────────────────

  private startSampling(): void {
    if (!this.settings.flowMonitoringEnabled) return;

    const intervalMs = this.settings.flowReadingIntervalSeconds * 1000;
    this.samplingInterval = setInterval(() => {
      this.sample().catch(console.error);
    }, intervalMs);
  }

  private stopSampling(): void {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }
  }

  private async sample(): Promise<void> {
    if (!this.settings.flowMonitoringEnabled) return;

    const gpm = this.gpio.getFlowGpm();
    const pulseCount = this.gpio.getFlowPulseCount();
    const runningZones = this.zoneManager.getRunningZones();
    const activeZone = runningZones.length > 0 ? runningZones[0] : null;

    // Only store readings when something interesting is happening
    const hasFlow = gpm > 0.05;
    const hasActiveZones = runningZones.length > 0;

    if (hasFlow || hasActiveZones) {
      await db.insertFlowReading(
        Math.round(gpm * 100) / 100,
        pulseCount,
        activeZone,
        'normal',
      );
    }

    // Emit reading for WebSocket broadcast
    this.emit('flow:reading', {
      gpm: Math.round(gpm * 100) / 100,
      totalPulses: pulseCount,
      activeZone,
      timestamp: new Date().toISOString(),
    });

    // Run safety checks
    if (this.settings.flowSafetyEnabled) {
      await this.checkExcessiveFlow(gpm, activeZone);
      await this.checkLeakDetection(gpm);
    }
  }

  // ── Safety: Excessive Flow ─────────────────────────────

  private async checkExcessiveFlow(gpm: number, activeZone: number | null): Promise<void> {
    if (gpm <= this.settings.flowMaxGpm) return;
    if (this.isAlarmCoolingDown('excessive')) return;

    console.log(`[FLOW] EXCESSIVE FLOW detected: ${gpm.toFixed(1)} GPM (max: ${this.settings.flowMaxGpm})`);
    this.lastAlarmTime.set('excessive', Date.now());

    // Emergency stop
    this.zoneManager.stopAll();
    this.gpio.closeMaster();

    // Record the anomaly
    await db.insertFlowReading(gpm, this.gpio.getFlowPulseCount(), activeZone, 'excessive');

    // Create critical alert
    await db.createAlert(
      'critical',
      'Excessive Flow Detected',
      `Flow rate of ${gpm.toFixed(1)} GPM exceeded the ${this.settings.flowMaxGpm} GPM threshold. All zones stopped and master valve closed. Possible burst pipe.`,
    );

    this.emit('flow:alarm', { type: 'excessive', gpm });
  }

  // ── Safety: No Flow ────────────────────────────────────

  private onZoneStart(zone: number): void {
    if (!this.settings.flowSafetyEnabled || !this.settings.flowMonitoringEnabled) return;

    // Clear any existing timer for this zone
    const existing = this.noFlowTimers.get(zone);
    if (existing) clearTimeout(existing);

    // Start a timer to check for flow
    const timer = setTimeout(async () => {
      this.noFlowTimers.delete(zone);
      await this.checkNoFlow(zone);
    }, this.settings.flowNoFlowTimeoutSeconds * 1000);

    this.noFlowTimers.set(zone, timer);
  }

  private onZoneStop(zone: number): void {
    // Clear no-flow timer
    const timer = this.noFlowTimers.get(zone);
    if (timer) {
      clearTimeout(timer);
      this.noFlowTimers.delete(zone);
    }

    this.lastZoneStopTime = Date.now();
  }

  private async checkNoFlow(zone: number): Promise<void> {
    // Verify zone is still running
    if (!this.zoneManager.getRunningZones().includes(zone)) return;
    if (this.isAlarmCoolingDown('no_flow')) return;

    const gpm = this.gpio.getFlowGpm();
    if (gpm > 0.1) return; // Flow is fine

    console.log(`[FLOW] NO FLOW detected for zone ${zone} after ${this.settings.flowNoFlowTimeoutSeconds}s`);
    this.lastAlarmTime.set('no_flow', Date.now());

    // Stop the offending zone
    await this.zoneManager.stopZone(zone, 'error');

    // Record the anomaly
    await db.insertFlowReading(0, this.gpio.getFlowPulseCount(), zone, 'no_flow');

    // Create warning alert
    await db.createAlert(
      'warning',
      'No Flow Detected',
      `Zone ${zone} ran for ${this.settings.flowNoFlowTimeoutSeconds}s with no measurable flow. Zone stopped. Check valve, wiring, or water supply.`,
    );

    this.emit('flow:alarm', { type: 'no_flow', zone, gpm });
  }

  // ── Safety: Leak Detection ─────────────────────────────

  private async checkLeakDetection(gpm: number): Promise<void> {
    const runningZones = this.zoneManager.getRunningZones();
    if (runningZones.length > 0) return; // Zones are active, not a leak

    // Grace period after last zone stop
    const timeSinceStop = Date.now() - this.lastZoneStopTime;
    if (timeSinceStop < this.settings.flowLeakDetectDelaySeconds * 1000) return;

    // Noise threshold
    if (gpm <= 0.1) return;

    if (this.isAlarmCoolingDown('leak')) return;

    console.log(`[FLOW] LEAK detected: ${gpm.toFixed(1)} GPM with no active zones`);
    this.lastAlarmTime.set('leak', Date.now());

    // Close master valve
    this.gpio.closeMaster();

    // Record the anomaly
    await db.insertFlowReading(gpm, this.gpio.getFlowPulseCount(), null, 'leak');

    // Create critical alert
    await db.createAlert(
      'critical',
      'Possible Leak Detected',
      `Flow of ${gpm.toFixed(1)} GPM detected with no active zones. Master valve closed. Inspect the system for leaks.`,
    );

    this.emit('flow:alarm', { type: 'leak', gpm });
  }

  // ── Helpers ────────────────────────────────────────────

  private isAlarmCoolingDown(type: string): boolean {
    const lastTime = this.lastAlarmTime.get(type);
    if (!lastTime) return false;
    return Date.now() - lastTime < this.ALARM_COOLDOWN_MS;
  }
}
