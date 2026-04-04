import mqtt from 'mqtt';
import { EventEmitter } from 'node:events';
import { MQTT_BROKER, MQTT_USER, MQTT_PASS, MQTT_BASE_TOPIC } from '../config.js';
import * as db from '../db/queries.js';

export interface SoilReading {
  deviceId: string;
  friendlyName: string;
  moisture: number;
  temperature: number;
  battery: number | null;
  linkQuality: number | null;
  timestamp: string;
}

export interface MqttClientOptions {
  /** Optional zone mapping: friendly_name → zone number */
  zoneMapping?: Record<string, number>;
}

/** Minimal info about a discovered soil sensor (from bridge/devices) */
export interface DiscoveredDevice {
  friendlyName: string;
  model: string;
  ieeeAddress: string;
  lastSeen: string | null;
}

export class MqttClient extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  /** Latest reading per device (friendly_name → reading) */
  private latestReadings = new Map<string, SoilReading>();
  /** Devices discovered from bridge/devices (includes sensors that haven't reported yet) */
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async connect(): Promise<void> {
    if (!MQTT_BROKER) {
      console.log('[MQTT] No MQTT_BROKER configured — skipping MQTT');
      return;
    }

    const opts: mqtt.IClientOptions = {
      reconnectPeriod: 5000,
      connectTimeout: 10000,
    };
    if (MQTT_USER) opts.username = MQTT_USER;
    if (MQTT_PASS) opts.password = MQTT_PASS;

    this.client = mqtt.connect(MQTT_BROKER, opts);

    this.client.on('connect', () => {
      console.log(`[MQTT] Connected to ${MQTT_BROKER}`);
      // Subscribe to all zigbee2mqtt device messages
      const topic = `${MQTT_BASE_TOPIC}/+`;
      this.client!.subscribe(topic, (err) => {
        if (err) {
          console.error(`[MQTT] Subscribe error:`, err);
        } else {
          console.log(`[MQTT] Subscribed to ${topic}`);
        }
      });
      // Also subscribe to bridge/devices for device discovery
      this.client!.subscribe(`${MQTT_BASE_TOPIC}/bridge/devices`);
    });

    this.client.on('message', (topic, payload) => {
      this.handleMessage(topic, payload);
    });

    this.client.on('error', (err) => {
      console.error('[MQTT] Connection error:', err.message);
    });

    this.client.on('close', () => {
      console.warn('[MQTT] Connection closed');
    });

    this.client.on('offline', () => {
      console.warn('[MQTT] Client offline');
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    // Ignore bridge topics (except devices)
    const parts = topic.split('/');
    if (parts.length < 2) return;

    const friendlyName = parts.slice(1).join('/');

    // Bridge device list — extract soil sensors for discovery
    if (friendlyName === 'bridge/devices') {
      try {
        const devices = JSON.parse(payload.toString()) as Array<Record<string, unknown>>;
        this.processBridgeDevices(devices);
      } catch { /* ignore */ }
      return;
    }

    // Skip other bridge messages
    if (friendlyName.startsWith('bridge/')) return;

    try {
      const data = JSON.parse(payload.toString());
      this.processSensorData(friendlyName, data);
    } catch {
      // Not JSON — ignore
    }
  }

  private processBridgeDevices(devices: Array<Record<string, unknown>>): void {
    // Look for devices that expose soil_moisture
    for (const d of devices) {
      const def = d.definition as Record<string, unknown> | undefined;
      if (!def) continue;

      const exposes = def.exposes as Array<Record<string, unknown>> | undefined;
      if (!exposes) continue;

      // Check if any expose (or nested feature) has property "soil_moisture"
      const hasSoilMoisture = exposes.some(e => {
        if (e.property === 'soil_moisture') return true;
        const features = e.features as Array<Record<string, unknown>> | undefined;
        return features?.some(f => f.property === 'soil_moisture') ?? false;
      });

      if (!hasSoilMoisture) continue;

      const friendlyName = d.friendly_name as string;
      const model = (def.model as string) ?? 'unknown';
      const ieeeAddress = (d.ieee_address as string) ?? '';
      const lastSeen = (d.last_seen as string) ?? null;

      this.discoveredDevices.set(friendlyName, { friendlyName, model, ieeeAddress, lastSeen });
      console.log(`[MQTT] Discovered soil sensor: ${friendlyName} (${model})`);
    }

    this.emit('devices:discovered', this.getDiscoveredDevices());
  }

  private async processSensorData(friendlyName: string, data: Record<string, unknown>): Promise<void> {
    // CS-201Z reports: soil_moisture, temperature, battery, linkquality
    // Also support generic moisture sensors with "humidity" or "soil_moisture"
    const moisture = data.soil_moisture as number | undefined;
    if (moisture === undefined) return; // Not a soil sensor message

    const reading: SoilReading = {
      deviceId: (data.ieee_address as string) ?? friendlyName,
      friendlyName,
      moisture,
      temperature: (data.temperature as number) ?? 0,
      battery: (data.battery as number) ?? null,
      linkQuality: (data.linkquality as number) ?? null,
      timestamp: new Date().toISOString(),
    };

    this.latestReadings.set(friendlyName, reading);

    // Resolve zone from device-zone mapping in settings
    const zone = await this.resolveZone(friendlyName);

    // Persist to DB
    await db.insertSoilReading(
      friendlyName,
      reading.moisture,
      reading.temperature,
      reading.battery,
      reading.linkQuality,
      zone,
    );

    // Emit for WebSocket broadcast
    this.emit('soil:reading', { ...reading, zone });

    // Check moisture threshold — two behaviors depending on zone mapping
    const enabled = await db.getSetting('moisture_skip_enabled');
    if (enabled === 'true') {
      const thresholdStr = await db.getSetting('moisture_skip_threshold');
      const thresholdPct = thresholdStr ? parseFloat(thresholdStr) : 60;
      if (moisture >= thresholdPct) {
        if (zone != null) {
          // Mapped sensor: stop/skip this specific zone
          this.emit('soil:zone-wet', { zone, moisture, threshold: thresholdPct, friendlyName });
        } else {
          // Unmapped sensor: general high moisture → global skip (like rain)
          this.emit('soil:general-wet', { moisture, threshold: thresholdPct, friendlyName });
        }
      }
    }

    console.log(
      `[MQTT] ${friendlyName}: moisture=${moisture}%, temp=${reading.temperature}°C` +
      (reading.battery != null ? `, bat=${reading.battery}%` : '') +
      (zone != null ? `, zone=${zone}` : ''),
    );
  }

  private async resolveZone(friendlyName: string): Promise<number | null> {
    // Check settings for mapping: mqtt_zone_<friendlyName> = <zone_number>
    const key = `mqtt_zone_${friendlyName}`;
    const val = await db.getSetting(key);
    return val ? parseInt(val, 10) : null;
  }

  getLatestReadings(): SoilReading[] {
    return Array.from(this.latestReadings.values());
  }

  getDiscoveredDevices(): DiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /** Get all known sensor names — union of discovered + those that have reported */
  getAllKnownSensorNames(): string[] {
    const names = new Set<string>();
    for (const name of this.discoveredDevices.keys()) names.add(name);
    for (const name of this.latestReadings.keys()) names.add(name);
    return Array.from(names);
  }

  getReadingForDevice(friendlyName: string): SoilReading | undefined {
    return this.latestReadings.get(friendlyName);
  }

  /** Get latest moisture % for a zone (null if no sensor mapped) */
  async getMoistureForZone(zone: number): Promise<number | null> {
    // Check all device mappings
    for (const [name, reading] of this.latestReadings) {
      const mappedZone = await this.resolveZone(name);
      if (mappedZone === zone) return reading.moisture;
    }
    return null;
  }

  /** Check if a zone's soil is wet enough to skip irrigation */
  async shouldSkipForMoisture(zone: number): Promise<{ skip: boolean; moisture: number | null; threshold: number }> {
    const thresholdStr = await db.getSetting('moisture_skip_threshold');
    const threshold = thresholdStr ? parseFloat(thresholdStr) : 0;
    if (threshold === 0) return { skip: false, moisture: null, threshold: 0 };

    const moisture = await this.getMoistureForZone(zone);
    if (moisture === null) return { skip: false, moisture: null, threshold };

    return { skip: moisture >= threshold, moisture, threshold };
  }

  isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  async shutdown(): Promise<void> {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.client) {
      await this.client.endAsync();
      this.client = null;
    }
    console.log('[MQTT] Disconnected');
  }
}
