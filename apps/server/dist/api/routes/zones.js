import * as db from '../../db/queries.js';
import { calculateSmartDuration, applySmartSchedule, removeSmartSchedules } from '../../scheduler/smart.js';
import { DEFAULT_RUN_MINUTES, MAX_RUN_MINUTES } from '../../config.js';
import { detectHardinessZone, getZone, getRecommendedPlantTypes, HARDINESS_ZONES } from '../../lib/hardiness.js';
export function registerZoneRoutes(app, zoneManager) {
    // GET /api/zones — list all zones with live state
    app.get('/api/zones', async () => {
        return zoneManager.getAllZoneStates();
    });
    // GET /api/zones/:zone — single zone state
    app.get('/api/zones/:zone', async (req, reply) => {
        const zone = parseInt(req.params.zone, 10);
        if (!zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        return zoneManager.getZoneState(zone);
    });
    // PUT /api/zones/:zone — update zone config (name, enabled)
    app.put('/api/zones/:zone', async (req, reply) => {
        const zone = parseInt(req.params.zone, 10);
        if (!zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        const zones = await db.getZones();
        const existing = zones.find(z => z.zone === zone);
        if (!existing)
            return reply.status(404).send({ error: 'Zone not found' });
        await db.updateZone(zone, req.body.name ?? existing.name, req.body.enabled ?? !!existing.enabled);
        await zoneManager.refreshNames();
        return zoneManager.getZoneState(zone);
    });
    // GET /api/zones/profiles — get soil/plant profiles for all zones
    app.get('/api/zones/profiles', async () => {
        const zones = await db.getZones();
        return zones.map(z => ({
            zone: z.zone,
            name: z.name,
            soilType: z.soil_type,
            plantType: z.plant_type,
            smartEnabled: !!z.smart_enabled,
        }));
    });
    // PUT /api/zones/:zone/profile — update soil/plant type for a zone
    app.put('/api/zones/:zone/profile', async (req, reply) => {
        const zone = parseInt(req.params.zone, 10);
        if (!zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        const zones = await db.getZones();
        const existing = zones.find(z => z.zone === zone);
        if (!existing)
            return reply.status(404).send({ error: 'Zone not found' });
        const soilType = req.body.soilType !== undefined ? req.body.soilType : existing.soil_type;
        const plantType = req.body.plantType !== undefined ? req.body.plantType : existing.plant_type;
        const smartEnabled = req.body.smartEnabled;
        await db.updateZoneProfile(zone, soilType, plantType, smartEnabled);
        const isNowSmart = smartEnabled ?? !!existing.smart_enabled;
        // Auto-create or remove smart schedule when toggled
        let smartSchedule;
        if (smartEnabled === true && soilType && plantType) {
            const result = await applySmartSchedule(zone);
            smartSchedule = { created: result.created, reason: result.schedule?.reason };
        }
        else if (smartEnabled === false) {
            await removeSmartSchedules(zone);
            smartSchedule = { created: false };
        }
        else if (isNowSmart && (req.body.soilType !== undefined || req.body.plantType !== undefined) && soilType && plantType) {
            // Profile changed while smart is on — regenerate schedule
            const result = await applySmartSchedule(zone);
            smartSchedule = { created: result.created, reason: result.schedule?.reason };
        }
        return { zone, soilType, plantType, smartEnabled: isNowSmart, smartSchedule };
    });
    // GET /api/zones/:zone/smart — preview the smart duration calculation
    app.get('/api/zones/:zone/smart', async (req, reply) => {
        const zone = parseInt(req.params.zone, 10);
        if (!zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        const result = await calculateSmartDuration(zone, DEFAULT_RUN_MINUTES);
        return result;
    });
    // ── Hardiness Zone ──────────────────────────────────────
    // GET /api/zones/hardiness — current hardiness zone info
    app.get('/api/zones/hardiness', async () => {
        const zone = await db.getSetting('hardiness_zone');
        const minTempF = await db.getSetting('hardiness_zone_temp_f');
        const auto = await db.getSetting('hardiness_zone_auto');
        const growStart = await db.getSetting('growing_season_start');
        const growEnd = await db.getSetting('growing_season_end');
        const zoneData = zone ? getZone(zone) : null;
        return {
            zone: zone ?? null,
            label: zoneData?.label ?? null,
            minTempF: minTempF ? parseFloat(minTempF) : null,
            auto: auto === 'true',
            growingSeasonStart: growStart ?? null,
            growingSeasonEnd: growEnd ?? null,
            recommendedPlantTypes: zone ? getRecommendedPlantTypes(zone) : [],
            allZones: HARDINESS_ZONES.map(z => ({ code: z.code, label: z.label })),
        };
    });
    // POST /api/zones/hardiness/detect — auto-detect from lat/lon
    app.post('/api/zones/hardiness/detect', async () => {
        const result = await detectHardinessZone();
        await db.setSetting('hardiness_zone', result.zone);
        await db.setSetting('hardiness_zone_temp_f', String(result.minTempF));
        await db.setSetting('hardiness_zone_auto', 'true');
        await db.setSetting('growing_season_start', result.growingSeasonStart);
        await db.setSetting('growing_season_end', result.growingSeasonEnd);
        const zoneData = getZone(result.zone);
        return {
            zone: result.zone,
            label: zoneData?.label ?? null,
            minTempF: result.minTempF,
            auto: true,
            growingSeasonStart: result.growingSeasonStart,
            growingSeasonEnd: result.growingSeasonEnd,
            recommendedPlantTypes: getRecommendedPlantTypes(result.zone),
        };
    });
    // PUT /api/zones/hardiness — manual override
    app.put('/api/zones/hardiness', async (req) => {
        const zoneData = getZone(req.body.zone);
        if (!zoneData)
            return { error: 'Invalid zone code' };
        await db.setSetting('hardiness_zone', zoneData.code);
        await db.setSetting('hardiness_zone_auto', 'false');
        await db.setSetting('growing_season_start', zoneData.lastFrostMmDd);
        await db.setSetting('growing_season_end', zoneData.firstFrostMmDd);
        return {
            zone: zoneData.code,
            label: zoneData.label,
            minTempF: zoneData.minTempF,
            auto: false,
            growingSeasonStart: zoneData.lastFrostMmDd,
            growingSeasonEnd: zoneData.firstFrostMmDd,
            recommendedPlantTypes: getRecommendedPlantTypes(zoneData.code),
        };
    });
    // POST /api/zones/:zone/start — start a zone manually
    app.post('/api/zones/:zone/start', async (req, reply) => {
        const zone = parseInt(req.params.zone, 10);
        if (!zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        let duration;
        if (req.body?.durationMinutes != null) {
            // Explicit duration provided — use it
            duration = Math.min(Math.max(1, req.body.durationMinutes), MAX_RUN_MINUTES);
        }
        else {
            // No explicit duration — use smart calculation if enabled, else default
            const smart = await calculateSmartDuration(zone, DEFAULT_RUN_MINUTES);
            duration = smart.minutes;
        }
        const result = await zoneManager.startZone(zone, duration, 'manual');
        if (!result.success)
            return reply.status(409).send({ error: result.error });
        return zoneManager.getZoneState(zone);
    });
    // POST /api/zones/:zone/stop — stop a zone
    app.post('/api/zones/:zone/stop', async (req, reply) => {
        const zone = parseInt(req.params.zone, 10);
        if (!zoneManager.isValidZone(zone)) {
            return reply.status(400).send({ error: `Invalid zone (1-${zoneManager.getZoneCount()})` });
        }
        const result = await zoneManager.stopZone(zone);
        if (!result.success)
            return reply.status(409).send({ error: result.error });
        return zoneManager.getZoneState(zone);
    });
    // POST /api/zones/stop-all — emergency stop all zones
    app.post('/api/zones/stop-all', async () => {
        zoneManager.stopAll();
        return { success: true, zones: zoneManager.getAllZoneStates() };
    });
}
//# sourceMappingURL=zones.js.map