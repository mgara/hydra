import { execSync } from 'node:child_process';
import os from 'node:os';
import { IS_PRODUCTION } from '../../config.js';
import * as db from '../../db/queries.js';
import { getMatterStatus } from '../../matter/status.js';
export function registerSystemRoutes(app, zoneManager, gpio) {
    // GET /api/system/status — full system overview
    app.get('/api/system/status', async () => {
        const rainDelay = zoneManager.getRainDelayInfo();
        return {
            online: true,
            masterValve: zoneManager.isMasterValveOpen() ? 'open' : 'closed',
            pressurePsi: 42.8 + Math.random() * 20, // TODO: real pressure sensor
            flowGpm: gpio.getFlowGpm(),
            dailyTotalGallons: await db.getDailyVolume(),
            cpuTempC: getCpuTemp(),
            memoryUsagePercent: getMemoryUsage(),
            uptimeSeconds: Math.round(process.uptime()),
            rainDelayActive: rainDelay.active,
            rainDelayUntil: rainDelay.until,
            activeZones: zoneManager.getRunningZones().length,
        };
    });
    // GET /api/system/settings — all settings
    app.get('/api/system/settings', async () => {
        return await db.getAllSettings();
    });
    // PUT /api/system/settings — update settings
    app.put('/api/system/settings', async (req) => {
        const updates = Object.entries(req.body);
        return await db.setSettingsAndReadAll(updates);
    });
    // GET /api/system/alerts — active alerts
    app.get('/api/system/alerts', async (req) => {
        return await db.getAlerts(req.query.all === 'true');
    });
    // POST /api/system/alerts/:id/dismiss — dismiss alert
    app.post('/api/system/alerts/:id/dismiss', async (req) => {
        await db.dismissAlert(parseInt(req.params.id, 10));
        return { success: true };
    });
    // POST /api/system/alerts/clear — clear non-critical dismissed alerts
    app.post('/api/system/alerts/clear', async () => {
        await db.clearNonCriticalAlerts();
        return { success: true };
    });
    // POST /api/system/master-valve — toggle master valve
    app.post('/api/system/master-valve', async (req, reply) => {
        if (req.body.state === 'open') {
            gpio.openMaster();
            return { masterValve: 'open' };
        }
        else if (req.body.state === 'closed') {
            zoneManager.stopAll(); // close all zones first
            gpio.closeMaster();
            return { masterValve: 'closed' };
        }
        return reply.status(400).send({ error: 'state must be "open" or "closed"' });
    });
    // POST /api/system/rain-delay — set/clear rain delay
    app.post('/api/system/rain-delay', async (req) => {
        if (req.body.clear) {
            zoneManager.clearRainDelay();
        }
        else {
            await zoneManager.setRainDelay(req.body.hours ?? 24);
        }
        return zoneManager.getRainDelayInfo();
    });
    // GET /api/system/config — system configuration
    app.get('/api/system/config', async () => {
        const config = await db.getSystemConfig();
        const assignments = await db.getGpioAssignments();
        return { config, assignments };
    });
    // GET /api/matter/status — Matter smart home integration status
    app.get('/api/matter/status', async () => {
        return getMatterStatus();
    });
    // POST /api/system/force-shutdown — emergency kill all
    app.post('/api/system/force-shutdown', async () => {
        zoneManager.stopAll();
        gpio.closeMaster();
        await db.createAlert('critical', 'Force Shutdown', 'All zones stopped and master valve closed via force shutdown.');
        return { success: true, message: 'All zones stopped, master valve closed' };
    });
}
function getCpuTemp() {
    if (!IS_PRODUCTION)
        return 42 + Math.random() * 5; // mock
    try {
        const raw = execSync('cat /sys/class/thermal/thermal_zone0/temp', { encoding: 'utf8' });
        return Math.round(parseInt(raw, 10) / 100) / 10;
    }
    catch {
        return null;
    }
}
function getMemoryUsage() {
    try {
        const total = os.totalmem();
        const free = os.freemem();
        return Math.round(((total - free) / total) * 100);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=system.js.map