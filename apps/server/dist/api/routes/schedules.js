import * as db from '../../db/queries.js';
const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const VALID_START_MODES = ['fixed', 'sunrise', 'sunset'];
export function registerScheduleRoutes(app, zoneManager) {
    // GET /api/schedules — list all schedules
    app.get('/api/schedules', async (req) => {
        const zone = req.query.zone ? parseInt(req.query.zone, 10) : undefined;
        return await db.getSchedules(zone);
    });
    // GET /api/schedules/:id — single schedule
    app.get('/api/schedules/:id', async (req, reply) => {
        const schedule = await db.getScheduleById(parseInt(req.params.id, 10));
        if (!schedule)
            return reply.status(404).send({ error: 'Schedule not found' });
        return schedule;
    });
    // POST /api/schedules — create new schedule
    app.post('/api/schedules', async (req, reply) => {
        const { zone, name, startTime, startMode, startOffset, durationMinutes, days, enabled, rainSkip, priority, smart, expiresAt, expiresInWeeks } = req.body;
        if (!zone || !zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        const mode = startMode ?? 'fixed';
        if (!VALID_START_MODES.includes(mode)) {
            return reply.status(400).send({ error: `startMode must be one of: ${VALID_START_MODES.join(', ')}` });
        }
        if (mode === 'fixed') {
            if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
                return reply.status(400).send({ error: 'startTime must be HH:MM format' });
            }
        }
        if (startOffset !== undefined && (startOffset < -120 || startOffset > 120)) {
            return reply.status(400).send({ error: 'startOffset must be between -120 and 120 minutes' });
        }
        if (!durationMinutes || durationMinutes < 1 || durationMinutes > 120) {
            return reply.status(400).send({ error: 'durationMinutes must be 1-120' });
        }
        if (!days) {
            return reply.status(400).send({ error: 'days is required (e.g., "mon,wed,fri")' });
        }
        const dayList = days.split(',').map(d => d.trim().toLowerCase());
        if (!dayList.every(d => VALID_DAYS.includes(d))) {
            return reply.status(400).send({ error: `Invalid days. Use: ${VALID_DAYS.join(',')}` });
        }
        const id = await db.createSchedule({
            zone,
            name: name || `Schedule ${zone}`,
            startTime: startTime || '00:00',
            startMode: mode,
            startOffset: startOffset ?? 0,
            durationMinutes,
            days: dayList.join(','),
            enabled,
            rainSkip,
            priority,
            smart,
            expiresAt,
            expiresInWeeks,
        });
        return reply.status(201).send(await db.getScheduleById(id));
    });
    // PUT /api/schedules/:id — update schedule
    app.put('/api/schedules/:id', async (req, reply) => {
        const id = parseInt(req.params.id, 10);
        const existing = await db.getScheduleById(id);
        if (!existing)
            return reply.status(404).send({ error: 'Schedule not found' });
        if (req.body.days) {
            const dayList = req.body.days.split(',').map(d => d.trim().toLowerCase());
            if (!dayList.every(d => VALID_DAYS.includes(d))) {
                return reply.status(400).send({ error: `Invalid days. Use: ${VALID_DAYS.join(',')}` });
            }
            req.body.days = dayList.join(',');
        }
        await db.updateSchedule(id, req.body);
        return await db.getScheduleById(id);
    });
    // DELETE /api/schedules/:id — delete schedule
    app.delete('/api/schedules/:id', async (req, reply) => {
        const id = parseInt(req.params.id, 10);
        const existing = await db.getScheduleById(id);
        if (!existing)
            return reply.status(404).send({ error: 'Schedule not found' });
        await db.deleteSchedule(id);
        return { success: true };
    });
}
//# sourceMappingURL=schedules.js.map