import cron from 'node-cron';
import { IS_PRODUCTION } from '../config.js';
import { shouldSkipForRain, getSolarTimes, computeSolarTime } from './weather.js';
import { calculateSmartDuration } from './smart.js';
import * as db from '../db/queries.js';
const DAY_MAP = {
    sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export class Scheduler {
    zoneManager;
    mqttClient;
    tasks = new Map();
    weatherCheckTask = null;
    syncTask = null;
    /** Track which schedules we've already executed this minute to avoid double-runs */
    recentlyExecuted = new Set();
    constructor(zoneManager, mqttClient) {
        this.zoneManager = zoneManager;
        this.mqttClient = mqttClient ?? null;
    }
    async start() {
        await this.syncSchedules();
        if (IS_PRODUCTION) {
            // Re-sync schedules every 5 minutes (picks up DB changes)
            this.syncTask = cron.schedule('*/5 * * * *', () => {
                this.syncSchedules();
            });
            // Weather check every 30 minutes
            this.weatherCheckTask = cron.schedule('*/30 * * * *', async () => {
                const { skip, probability } = await shouldSkipForRain();
                if (skip && !this.zoneManager.isRainDelayed()) {
                    console.log(`[SCHEDULER] Rain skip triggered: ${probability}% precipitation`);
                    await this.zoneManager.setRainDelay(24);
                }
            });
        }
        else {
            // Dev: re-sync every 10 seconds for fast iteration
            this.syncTask = cron.schedule('*/10 * * * * *', () => {
                this.syncSchedules();
            });
            // Dev: weather check every 2 minutes
            this.weatherCheckTask = cron.schedule('*/2 * * * *', async () => {
                const { skip, probability } = await shouldSkipForRain();
                if (skip && !this.zoneManager.isRainDelayed()) {
                    console.log(`[SCHEDULER] Rain skip triggered: ${probability}% precipitation`);
                    await this.zoneManager.setRainDelay(24);
                }
            });
            console.log('[SCHEDULER] Dev mode: sync every 10s, weather check every 2min');
        }
        console.log('[SCHEDULER] Started');
    }
    stop() {
        for (const task of this.tasks.values()) {
            task.stop();
        }
        this.tasks.clear();
        this.weatherCheckTask?.stop();
        this.syncTask?.stop();
        console.log('[SCHEDULER] Stopped');
    }
    async syncSchedules() {
        // Stop existing tasks
        for (const task of this.tasks.values()) {
            task.stop();
        }
        this.tasks.clear();
        // Load enabled schedules from DB
        const schedules = await db.getEnabledSchedules();
        // Fetch solar times once for all solar schedules
        const hasSolarSchedules = schedules.some(s => s.startMode !== 'fixed');
        const solarTimes = hasSolarSchedules ? await getSolarTimes() : null;
        for (const schedule of schedules) {
            let effectiveTime;
            if (schedule.startMode === 'fixed') {
                effectiveTime = schedule.startTime;
            }
            else {
                // Compute effective time from sunrise/sunset + offset
                if (!solarTimes)
                    continue; // skip solar schedules if we can't get times
                const baseTime = schedule.startMode === 'sunrise' ? solarTimes.sunrise : solarTimes.sunset;
                const computed = computeSolarTime(baseTime, schedule.startOffset);
                if (!computed)
                    continue;
                effectiveTime = computed;
            }
            const [hours, minutes] = effectiveTime.split(':').map(Number);
            const days = schedule.days.split(',').map(d => DAY_MAP[d.trim().toLowerCase()]).filter(d => d !== undefined);
            if (days.length === 0)
                continue;
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
    async checkDueSchedules(schedules, solarTimes) {
        const now = new Date();
        const currentDay = DAY_NAMES[now.getDay()];
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        for (const schedule of schedules) {
            if (!schedule.enabled)
                continue;
            // Check if today is a scheduled day
            const scheduleDays = schedule.days.split(',').map((d) => d.trim().toLowerCase());
            if (!scheduleDays.includes(currentDay))
                continue;
            // Resolve effective start time
            let effectiveTime;
            if (schedule.startMode === 'fixed') {
                effectiveTime = schedule.startTime;
            }
            else {
                if (!solarTimes)
                    continue;
                const baseTime = schedule.startMode === 'sunrise' ? solarTimes.sunrise : solarTimes.sunset;
                const computed = computeSolarTime(baseTime, schedule.startOffset);
                if (!computed)
                    continue;
                effectiveTime = computed;
            }
            // Check if current time is within the schedule's run window
            const [h, m] = effectiveTime.split(':').map(Number);
            const startMinutes = (h ?? 0) * 60 + (m ?? 0);
            const endMinutes = startMinutes + schedule.durationMinutes;
            if (nowMinutes < startMinutes || nowMinutes >= endMinutes)
                continue;
            // Don't double-execute: check dedup key (scheduleId + date + startTime)
            const dedupKey = `${schedule.id}:${now.toDateString()}:${schedule.startTime}`;
            if (this.recentlyExecuted.has(dedupKey))
                continue;
            // Don't execute if zone is already running
            if (this.zoneManager.getRunningZones().includes(schedule.zone))
                continue;
            // Check if there's already a log entry for this schedule today
            const alreadyRan = await db.hasRecentLog(schedule.id, schedule.startTime);
            if (alreadyRan) {
                this.recentlyExecuted.add(dedupKey);
                continue;
            }
            // Execute with remaining duration
            const elapsedMinutes = nowMinutes - startMinutes;
            const remainingMinutes = schedule.durationMinutes - elapsedMinutes;
            if (remainingMinutes <= 0)
                continue;
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
    async executeSchedule(scheduleId, overrideDuration) {
        const schedule = await db.getScheduleById(scheduleId);
        if (!schedule || !schedule.enabled)
            return;
        // Smart irrigation: calculate duration from soil/plant profile if enabled
        let duration;
        if (overrideDuration != null) {
            duration = overrideDuration;
        }
        else {
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
                await db.createAlert('info', 'Schedule Skipped', `"${schedule.name}" (Zone ${schedule.zone}) was skipped due to active rain delay.`);
                this.zoneManager.emit('schedule:skipped', { scheduleId, reason: 'rain_delay' });
                return;
            }
            const { skip, probability } = await shouldSkipForRain();
            if (skip) {
                console.log(`[SCHEDULER] Schedule ${scheduleId} skipped (${probability}% precipitation)`);
                const logId = await db.createLog(schedule.zone, 'scheduled', scheduleId);
                await db.completeLog(logId, 'rain_skip', 0, 0, `Precipitation probability: ${probability}%`);
                await db.createAlert('info', 'Schedule Skipped', `"${schedule.name}" (Zone ${schedule.zone}) was skipped — ${probability}% precipitation chance.`);
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
                    await db.createAlert('info', 'Schedule Skipped (Soil Wet)', `"${schedule.name}" (Zone ${schedule.zone}) skipped — soil moisture ${moisture}% exceeds ${threshold}% threshold.`);
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
        const result = await this.zoneManager.startZone(schedule.zone, duration, 'scheduled', scheduleId);
        if (!result.success) {
            console.error(`[SCHEDULER] Failed to start zone ${schedule.zone}: ${result.error}`);
            await db.createAlert('warning', 'Schedule Failed', `"${schedule.name}" (Zone ${schedule.zone}) failed to start: ${result.error}`);
        }
    }
}
//# sourceMappingURL=cron.js.map