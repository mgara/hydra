import type { FastifyInstance } from 'fastify';
import type { MqttClient } from '../../mqtt/client.js';
import * as db from '../../db/queries.js';

export function registerSoilRoutes(app: FastifyInstance, mqttClient: MqttClient): void {
  // GET /api/soil/current — latest reading per device (with live zone mapping)
  app.get('/api/soil/current', async () => {
    const readings = mqttClient.getLatestReadings();
    const allSettings = await db.getAllSettings();
    return readings.map(r => ({
      ...r,
      zone: (() => {
        const val = allSettings[`mqtt_zone_${r.friendlyName}`];
        return val ? parseInt(val, 10) : null;
      })(),
    }));
  });

  // GET /api/soil/readings?device=X&zone=Z&since=ISO&limit=N — historical readings
  app.get<{
    Querystring: { device?: string; zone?: string; since?: string; limit?: string };
  }>('/api/soil/readings', async (req) => {
    return db.getSoilReadings({
      device: req.query.device,
      zone: req.query.zone ? parseInt(req.query.zone, 10) : undefined,
      since: req.query.since,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : undefined,
    });
  });

  // GET /api/soil/zone/:zone — latest moisture for a specific zone
  app.get<{ Params: { zone: string } }>('/api/soil/zone/:zone', async (req) => {
    const zone = parseInt(req.params.zone, 10);
    const result = await mqttClient.shouldSkipForMoisture(zone);
    const latest = await db.getLatestSoilReadingForZone(zone);
    return {
      zone,
      ...result,
      latest,
    };
  });

  // GET /api/soil/devices — list known soil sensor devices (discovered + reported)
  app.get('/api/soil/devices', async () => {
    // Merge DB records (sensors that have reported) with discovered devices (from bridge)
    const dbDevices = await db.getSoilDevices();
    const discovered = mqttClient.getDiscoveredDevices();
    const allSettings = await db.getAllSettings();
    const dbNames = new Set(dbDevices.map(d => d.device));

    // Resolve zone mapping from settings for any device
    const getZoneMapping = (device: string): number | null => {
      const val = allSettings[`mqtt_zone_${device}`];
      return val ? parseInt(val, 10) : null;
    };

    // Add discovered-but-not-yet-reported devices
    const extra = discovered
      .filter(d => !dbNames.has(d.friendlyName))
      .map(d => ({
        device: d.friendlyName,
        lastSeen: d.lastSeen ?? 'never',
        zone: getZoneMapping(d.friendlyName),
        model: d.model,
        discovered: true,
      }));

    // Enrich DB devices with model info + authoritative zone from settings
    const enriched = dbDevices.map(d => {
      const disc = discovered.find(dd => dd.friendlyName === d.device);
      return { ...d, zone: getZoneMapping(d.device), model: disc?.model ?? null, discovered: false };
    });

    return [...enriched, ...extra];
  });

  // PUT /api/soil/zone-mapping — map a device to a zone
  app.put<{
    Body: { device: string; zone: number | null };
  }>('/api/soil/zone-mapping', async (req) => {
    const { device, zone } = req.body;
    const key = `mqtt_zone_${device}`;
    if (zone === null) {
      // Remove mapping
      await db.setSetting(key, '');
    } else {
      await db.setSetting(key, String(zone));
    }
    return { device, zone, success: true };
  });

  // GET /api/soil/settings — moisture skip settings
  app.get('/api/soil/settings', async () => {
    const threshold = await db.getSetting('moisture_skip_threshold');
    const enabled = await db.getSetting('moisture_skip_enabled');
    return {
      moistureSkipEnabled: enabled !== 'false' && !!threshold,
      moistureSkipThreshold: threshold ? parseFloat(threshold) : 60,
    };
  });

  // PUT /api/soil/settings — update moisture skip settings
  app.put<{
    Body: { moistureSkipEnabled?: boolean; moistureSkipThreshold?: number };
  }>('/api/soil/settings', async (req) => {
    const { moistureSkipEnabled, moistureSkipThreshold } = req.body;
    if (moistureSkipEnabled !== undefined) {
      await db.setSetting('moisture_skip_enabled', String(moistureSkipEnabled));
    }
    if (moistureSkipThreshold !== undefined) {
      await db.setSetting('moisture_skip_threshold', String(moistureSkipThreshold));
    }
    return {
      moistureSkipEnabled: moistureSkipEnabled ?? (await db.getSetting('moisture_skip_enabled')) !== 'false',
      moistureSkipThreshold: moistureSkipThreshold ?? parseFloat((await db.getSetting('moisture_skip_threshold')) || '60'),
    };
  });

  // GET /api/mqtt/status — MQTT connection status
  app.get('/api/mqtt/status', async () => {
    return {
      connected: mqttClient.isConnected(),
      devices: mqttClient.getAllKnownSensorNames().length,
    };
  });
}
