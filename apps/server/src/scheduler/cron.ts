import cron from 'node-cron';
import { IS_PRODUCTION } from '../config.js';
import type { Schedule } from '../types.js';
import { ZoneManager } from '../zones/manager.js';
import { shouldSkipForRain, getSolarTimes, computeSolarTime, getHeatWaveStatus } from './weather.js';
import type { MqttClient } from '../mqtt/client.js';
import { calculateSmartDuration } from './smart.js';
import * as db from '../db/queries.js';

const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export class Scheduler {
  private zoneManager: ZoneManager;
  private mqttClient: MqttClient | null;
  private tasks = new Map<number, cron.ScheduledTask>();
  private weatherCheckTask: cron.ScheduledTask | null = null;
  private syncTask: cron.ScheduledTask | null = null;
  /** Track which schedules we've already executed this minute to avoid double-runs */
  private recentlyExecuted = new Set<string>();
  /** Track last heat wave severity to avoid duplicate alerts */
  private lastHeatWaveSeverity: 'none' | 'warning' | 'extreme' = 'none';

  constructor(zoneManager: ZoneManager, mqttClient?: MqttClient | null) {
    this.zoneManager = zoneManager;
    this.mqttClient = mqttClient ?? null;
  }

  async start(): Promise<void> {
    await this.syncSchedules();

    if (IS_PRODUCTION) {
      // Re-sync schedules every 5 minutes (picks up DB changes)
      this.syncTask = cron.schedule('*/5 * * * *', () => {
        this.syncSchedules();
      });

      // Weather check every 30 minutes
      this.weatherCheckTask = cron.schedule('*/30 * * * *', () => { this.checkWeather(); });
    } else {
      // Dev: re-sync every 10 seconds for fast iteration
      this.syncTask = cron.schedule('*/10 * * * * *', () => {
        this.syncSchedules();
      });

      // Dev: weather check every 2 minutes
      this.weatherCheckTask = cron.schedule('*/2 * * * *', () => { this.checkWeather(); });

      console.log('[SCHEDULER] Dev mode: sync every 10s, weather check every 2min');
    }

    console.log('[SCHEDULER] Started');
  }

  stop(): void {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
    this.weatherCheckTask?.stop();
    this.syncTask?.stop();
    console.log('[SCHEDULER] Stopped');
  }

  private async checkWeather(): Promise<void> {
    // Rain check
    const { skip, probability } = await shouldSkipForRain();
    if (skip && !this.zoneManager.isRainDelayed()) {
      console.log(`[SCHEDULER] Rain skip triggered: ${probability}% precipitation`);
      await this.zoneManager.setRainDelay(24);
    }

    // Heat wave check — alert on new or escalated heat wave
    try {
      const heatWave = await getHeatWaveStatus();
      if (heatWave.active && heatWave.severity !== this.lastHeatWaveSeverity) {
        const severity = heatWave.severity === 'extreme' ? 'warning' : 'info';
        const boostPct = Math.round((heatWave.boostMultiplier - 1) * 100);
        await db.createAlert(severity,
          `Heat Wave ${heatWave.severity === 'extreme' ? '— Extreme' : 'Warning'}`,
          `${heatWave.consecutiveDays} consecutive days above threshold` +
          (heatWave.peakTempF != null ? ` (peak ${heatWave.peakTempF}°F)` : '') +
          `. Smart irrigation zones boosted +${boostPct}%.`
        );
        console.log(`[SCHEDULER] Heat wave ${heatWave.severity}: +${boostPct}% boost`);
      }
      this.lastHeatWaveSeverity = heatWave.severity;
    } catch { /* weather unavailable */ }
  }

  async syncSchedules(): Promise<void> {
    // Stop existing tasks
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();

    // Disable expired schedules
    await this.disableExpiredSchedules();

    // Load enabled schedules from DB
    const schedules = await db.getEnabledSchedules();

    // Fetch solar times once for all solar schedules
    const hasSolarSchedules = schedules.some(s => s.startMode !== 'fixed');
    const solarTimes = hasSolarSchedules ? await getSolarTimes() : null;

    for (const schedule of schedules) {
      let effectiveTime: string;

      if (schedule.startMode === 'fixed') {
        effectiveTime = schedule.startTime;
      } else {
        // Compute effective time from sunrise/sunset + offset
        if (!solarTimes) continue; // skip solar schedules if we can't get times
        const baseTime = schedule.startMode === 'sunrise' ? solarTimes.sunrise : solarTimes.sunset;
        const computed = computeSolarTime(baseTime, schedule.startOffset);
        if (!computed) continue;
        effectiveTime = computed;
      }

      const [hours, minutes] = effectiveTime.split(':').map(Number);
      const days = schedule.days.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]).filter(d => d !== undefined);

      if (days.length === 0) continue;

      // node-cron format: minute hour * * dayOfWeek
      const cronExpr = `${minutes} ${hours} * * ${days.join(',')}`;

      const task = cron.schedule(cronExpr, async () => {
        await this.executeSchedule(schedule.id);
      });

      this.tasks.set(schedule.id, task);
    }

    // Check if any schedule should be running right now (catches missed cron fires)
    await this.checkDueSchedules(schedules, solarTimes);
  }

  /**
   * After syncing, check if any schedule's time window includes "right now".
   * This catches schedules that were created/synced after the cron minute passed.
   */
  private async checkDueSchedules(
    schedules: Schedule[],
    solarTimes?: { sunrise: string; sunset: string } | null,
  ): Promise<void> {
    const now = new Date();
    const currentDay = DAY_NAMES[now.getDay()];
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;

      // Check if today is a scheduled day
      const scheduleDays = schedule.days.split(',').map((d: string) => d.trim().toLowerCase());
      if (!scheduleDays.includes(currentDay)) continue;

      // Resolve effective start time
      let effectiveTime: string;
      if (schedule.startMode === 'fixed') {
        effectiveTime = schedule.startTime;
      } else {
        if (!solarTimes) continue;
        const baseTime = schedule.startMode === 'sunrise' ? solarTimes.sunrise : solarTimes.sunset;
        const computed = computeSolarTime(baseTime, schedule.startOffset);
        if (!computed) continue;
        effectiveTime = computed;
      }

      // Check if current time is within the schedule's run window
      const [h, m] = effectiveTime.split(':').map(Number);
      const startMinutes = (h ?? 0) * 60 + (m ?? 0);
      const endMinutes = startMinutes + schedule.durationMinutes;

      if (nowMinutes < startMinutes || nowMinutes >= endMinutes) continue;

      // Don't double-execute: check dedup key (scheduleId + date + startTime)
      const dedupKey = `${schedule.id}:${now.toDateString()}:${schedule.startTime}`;
      if (this.recentlyExecuted.has(dedupKey)) continue;

      // Don't execute if zone is already running
      if (this.zoneManager.getRunningZones().includes(schedule.zone)) continue;

      // Check if there's already a log entry for this schedule today
      const alreadyRan = await db.hasRecentLog(schedule.id, schedule.startTime);
      if (alreadyRan) {
        this.recentlyExecuted.add(dedupKey);
        continue;
      }

      // Execute with remaining duration
      const elapsedMinutes = nowMinutes - startMinutes;
      const remainingMinutes = schedule.durationMinutes - elapsedMinutes;
      if (remainingMinutes <= 0) continue;

      console.log(`[SCHEDULER] Due now: schedule ${schedule.id} (Zone ${schedule.zone}), ${remainingMinutes} min remaining`);
      this.recentlyExecuted.add(dedupKey);
      await this.executeSchedule(schedule.id, remainingMinutes);
    }

    // Clean old dedup keys (keep only today's)
    const todayPrefix = now.toDateString();
    for (const key of this.recentlyExecuted) {
      if (!key.includes(todayPrefix)) {
        this.recentlyExecuted.delete(key);
      }
    }
  }

  private async executeSchedule(scheduleId: number, overrideDuration?: number): Promise<void> {
    const schedule = await db.getScheduleById(scheduleId);
    if (!schedule || !schedule.enabled) return;

    // Smart irrigation: calculate duration from soil/plant profile if enabled
    let duration: number;
    if (overrideDuration != null) {
      duration = overrideDuration;
    } else {
      const smart = await calculateSmartDuration(schedule.zone, schedule.durationMinutes);
      duration = smart.minutes;
      if (smart.method === 'smart') {
        console.log(`[SCHEDULER] Smart duration for zone ${schedule.zone}: ${smart.minutes} min (${smart.waterNeededIn.toFixed(3)} in, ET₀=${smart.et0In?.toFixed(3) ?? 'n/a'})`);
      }
    }

    // Check rain skip
    if (schedule.rainSkip && !schedule.priority) {
      if (this.zoneManager.isRainDelayed()) {
        console.log(`[SCHEDULER] Schedule ${scheduleId} skipped (rain delay active)`);
        const logId = await db.createLog(schedule.zone, 'scheduled', scheduleId);
        await db.completeLog(logId, 'rain_skip', 0, 0, 'Rain delay active');
        await db.createAlert('info', 'Schedule Skipped',
          `"${schedule.name}" (Zone ${schedule.zone}) was skipped due to active rain delay.`);
        this.zoneManager.emit('schedule:skipped', { scheduleId, reason: 'rain_delay' });
        return;
      }

      const { skip, probability } = await shouldSkipForRain();
      if (skip) {
        console.log(`[SCHEDULER] Schedule ${scheduleId} skipped (${probability}% precipitation)`);
        const logId = await db.createLog(schedule.zone, 'scheduled', scheduleId);
        await db.completeLog(logId, 'rain_skip', 0, 0, `Precipitation probability: ${probability}%`);
        await db.createAlert('info', 'Schedule Skipped',
          `"${schedule.name}" (Zone ${schedule.zone}) was skipped — ${probability}% precipitation chance.`);
        await this.zoneManager.setRainDelay(24);
        return;
      }
    }

    // Check moisture skip (soil is already wet enough)
    if (this.mqttClient && schedule.rainSkip) {
      const moistureEnabled = await db.getSetting('moisture_skip_enabled');
      if (moistureEnabled === 'true') {
        const { skip, moisture, threshold } = await this.mqttClient.shouldSkipForMoisture(schedule.zone);
        if (skip) {
          console.log(`[SCHEDULER] Schedule ${scheduleId} skipped (soil moisture ${moisture}% >= ${threshold}%)`);
          const logId = await db.createLog(schedule.zone, 'scheduled', scheduleId);
          await db.completeLog(logId, 'rain_skip', 0, 0, `Soil moisture ${moisture}% >= ${threshold}% threshold`);
          await db.createAlert('info', 'Schedule Skipped (Soil Wet)',
            `"${schedule.name}" (Zone ${schedule.zone}) skipped — soil moisture ${moisture}% exceeds ${threshold}% threshold.`);
          return;
        }
      }
    }

    console.log(`[SCHEDULER] Executing schedule ${scheduleId}: Zone ${schedule.zone} for ${duration} min`);
    this.zoneManager.emit('schedule:triggered', {
      scheduleId,
      zone: schedule.zone,
      duration,
    });

    const result = await this.zoneManager.startZone(
      schedule.zone,
      duration,
      'scheduled',
      scheduleId,
    );

    if (!result.success) {
      console.error(`[SCHEDULER] Failed to start zone ${schedule.zone}: ${result.error}`);
      await db.createAlert('warning', 'Schedule Failed',
        `"${schedule.name}" (Zone ${schedule.zone}) failed to start: ${result.error}`);
    }
  }

  /** Disable schedules that have passed their expiry date */
  private async disableExpiredSchedules(): Promise<void> {
    const all = await db.getEnabledSchedules();
    const now = new Date().toISOString();
    for (const s of all) {
      if (s.expiresAt && s.expiresAt <= now) {
        await db.updateSchedule(s.id, { enabled: false });
        console.log(`[SCHEDULER] Schedule "${s.name}" (zone ${s.zone}) expired — disabled`);
        await db.createAlert('info', 'Schedule Expired',
          `"${s.name}" (Zone ${s.zone}) has been automatically disabled — it expired on ${new Date(s.expiresAt).toLocaleDateString()}.`);
      }
    }
  }
}
