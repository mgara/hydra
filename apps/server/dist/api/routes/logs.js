import * as db from '../../db/queries.js';
export function registerLogRoutes(app) {
    // GET /api/logs — execution history
    app.get('/api/logs', async (req) => {
        return await db.getLogs({
            zone: req.query.zone ? parseInt(req.query.zone, 10) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
            offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
            dateFrom: req.query.from,
            dateTo: req.query.to,
        });
    });
    // GET /api/logs/volume/weekly — total weekly volume
    app.get('/api/logs/volume/weekly', async () => {
        return { volumeGallons: await db.getWeeklyVolume() };
    });
    // GET /api/logs/volume/daily — total daily volume
    app.get('/api/logs/volume/daily', async () => {
        return { volumeGallons: await db.getDailyVolume() };
    });
    // GET /api/logs/rain-skips — recent rain skip events (last 24h)
    app.get('/api/logs/rain-skips', async () => {
        const skips = await db.getRecentRainSkips();
        const zones = await db.getZones();
        const zoneNames = new Map(zones.map(z => [z.zone, z.name]));
        return skips.map(s => ({
            zone: s.zone,
            zoneName: zoneNames.get(s.zone) ?? `Zone ${s.zone}`,
            skippedAt: s.started_at,
            reason: s.notes,
        }));
    });
}
//# sourceMappingURL=logs.js.map