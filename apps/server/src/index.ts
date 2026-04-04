import { SERVER_PORT, SERVER_HOST, MATTER_ENABLED, OLED_ENABLED, OLED_DRIVER, OLED_I2C_ADDRESS, OLED_I2C_BUS, OLED_BUTTON_UP_GPIO, OLED_BUTTON_DOWN_GPIO, OLED_BUTTON_CONFIRM_GPIO, OLED_SLEEP_TIMEOUT, BLE_ENABLED, MQTT_BROKER } from './config.js';
import { initDb, closeDb } from './db/index.js';
import * as db from './db/queries.js';
import { createGpioController } from './gpio/controller.js';
import type { GpioController } from './gpio/controller.js';
import { ZoneManager } from './zones/manager.js';
import { FlowMonitor } from './flow/monitor.js';
import { Scheduler } from './scheduler/cron.js';
import { createServer, createSetupServer } from './api/server.js';
import type { DisplayManager } from './oled/index.js';
import type { BleManager } from './ble/index.js';
import type { MqttClient } from './mqtt/client.js';
import os from 'node:os';
import { execSync } from 'node:child_process';

function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  for (const nets of Object.values(interfaces)) {
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

function getWifiSsid(): string {
  try {
    if (process.platform === 'linux') {
      return execSync('iwgetid -r', { timeout: 3000, encoding: 'utf8' }).trim();
    } else if (process.platform === 'darwin') {
      const raw = execSync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -I',
        { timeout: 3000, encoding: 'utf8' },
      );
      return raw.match(/\sSSID:\s*(.+)/)?.[1]?.trim() ?? '';
    }
  } catch { /* no wifi */ }
  return '';
}

function getWifiRssi(): number {
  try {
    if (process.platform === 'linux') {
      const raw = execSync('cat /proc/net/wireless', { timeout: 2000, encoding: 'utf8' });
      const lines = raw.trim().split('\n');
      if (lines.length >= 3) {
        const match = lines[2].match(/\s+-?\d+\.\s+(-?\d+)\./);
        if (match) return parseInt(match[1], 10);
      }
    } else if (process.platform === 'darwin') {
      const raw = execSync(
        '/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -I',
        { timeout: 2000, encoding: 'utf8' },
      );
      const match = raw.match(/agrCtlRSSI:\s*(-?\d+)/);
      if (match) return parseInt(match[1], 10);
    }
  } catch { /* no wifi */ }
  return 0;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

let currentApp: { close: () => Promise<void> } | null = null;
let scheduler: Scheduler | null = null;
let zoneManager: ZoneManager | null = null;
let gpio: GpioController | null = null;
let flowMonitor: FlowMonitor | null = null;
let matterBridge: { stop(): Promise<void> } | null = null;
let display: DisplayManager | null = null;
let ble: BleManager | null = null;
let mqttClient: MqttClient | null = null;

async function startOperationalMode(): Promise<void> {
  const config = await db.getSystemConfig();
  console.log(`[STARTUP] Configuration loaded — ${config!.zoneCount} zones`);

  // Load GPIO pin config from DB
  const pinConfig = await db.getGpioPinConfig();

  // Initialize GPIO
  gpio = createGpioController();
  await gpio.init(pinConfig);

  // Initialize zone manager
  zoneManager = new ZoneManager(gpio);
  await zoneManager.init();
  zoneManager.initFromPinConfig(pinConfig);

  // Initialize flow monitor
  flowMonitor = new FlowMonitor(gpio, zoneManager);
  await flowMonitor.init();

  // Start MQTT client (soil sensors via Zigbee2MQTT)
  if (MQTT_BROKER) {
    try {
      const { MqttClient: MqttClientCls } = await import('./mqtt/client.js');
      mqttClient = new MqttClientCls();
      await mqttClient.connect();

      // Mapped sensor → zone-specific: stop if running, flag for skip if scheduled
      mqttClient.on('soil:zone-wet', async (data: { zone: number; moisture: number; threshold: number; friendlyName: string }) => {
        console.log(`[MQTT] Zone ${data.zone} soil wet (${data.moisture}% >= ${data.threshold}%) — sensor: ${data.friendlyName}`);

        // If zone is currently irrigating, stop it immediately
        if (zoneManager!.getRunningZones().includes(data.zone)) {
          console.log(`[MQTT] Stopping zone ${data.zone} — soil already wet`);
          await zoneManager!.stopZone(data.zone, 'completed');
          await db.createAlert('info', 'Zone Stopped (Soil Wet)',
            `Zone ${data.zone} stopped — soil moisture ${data.moisture}% exceeds ${data.threshold}% threshold (sensor: ${data.friendlyName}).`);
        }
        // Future scheduled runs for this zone are handled by the scheduler's moisture check
      });

      // Unmapped sensor → if soil is wet AND no irrigation in last 24h, it rained → global skip
      mqttClient.on('soil:general-wet', async (data: { moisture: number; threshold: number; friendlyName: string }) => {
        if (zoneManager!.isRainDelayed()) return; // already delayed

        // Check if any zone was irrigated in the last 24h
        const { logs } = await db.getLogs({ limit: 1, dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() });
        const recentIrrigation = logs.length > 0;

        if (!recentIrrigation) {
          // Wet soil + no recent irrigation = it rained
          console.log(`[MQTT] Rain detected via soil — ${data.moisture}% moisture, no irrigation in 24h (sensor: ${data.friendlyName})`);
          await zoneManager!.setRainDelay(24);
          await db.createAlert('info', 'Rain Detected (Soil Sensor)',
            `All irrigation paused 24h — sensor "${data.friendlyName}" reports ${data.moisture}% moisture with no irrigation in the past 24h.`);
        } else {
          console.log(`[MQTT] High moisture (${data.moisture}%) on unmapped sensor "${data.friendlyName}" — recent irrigation found, ignoring`);
        }
      });
    } catch (err) {
      console.warn('[MQTT] Failed to start MQTT client:', err);
    }
  }

  // Start scheduler (after MQTT so moisture skip is available)
  scheduler = new Scheduler(zoneManager, mqttClient);
  await scheduler.start();

  // Start HTTP + WebSocket server
  const app = await createServer(zoneManager, gpio, flowMonitor, mqttClient);

  // Initialize OLED display BEFORE app.listen() — simulator registers routes on the Fastify instance
  if (OLED_ENABLED) {
    try {
      const { createDisplay } = await import('./oled/index.js');
      display = await createDisplay({
        driver: OLED_DRIVER,
        i2cAddress: OLED_I2C_ADDRESS,
        i2cBus: OLED_I2C_BUS,
        buttonUpGpio: OLED_BUTTON_UP_GPIO,
        buttonDownGpio: OLED_BUTTON_DOWN_GPIO,
        buttonConfirmGpio: OLED_BUTTON_CONFIRM_GPIO,
        sleepTimeout: OLED_SLEEP_TIMEOUT,
        fastify: app,
      });

      // Wire display zone-toggle to zone manager
      display.on('zone-toggle', (zoneId: number) => {
        if (zoneManager!.getRunningZones().includes(zoneId)) {
          zoneManager!.stopZone(zoneId);
        } else {
          zoneManager!.startZone(zoneId);
        }
      });

      // Wire display settings actions
      display.on('action', async (action: string) => {
        switch (action) {
          case 'stop-all':
            zoneManager!.stopAll();
            gpio!.closeMaster();
            await db.createAlert('info', 'Stop All', 'All zones stopped via OLED button.');
            console.log('[OLED] Stop all zones executed');
            break;
          case 'reset':
            await db.createAlert('info', 'Restart', 'Server restart triggered via OLED button.');
            console.log('[OLED] Restart requested');
            setTimeout(() => process.exit(0), 500); // PM2 will restart
            break;
          case 'shutdown':
            zoneManager!.stopAll();
            gpio!.closeMaster();
            await db.createAlert('critical', 'Shutdown', 'Server shutdown triggered via OLED button.');
            console.log('[OLED] Shutdown requested');
            if (process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64')) {
              const { execSync } = await import('node:child_process');
              setTimeout(() => execSync('sudo poweroff'), 500);
            } else {
              console.log('[OLED] Shutdown ignored — not running on Pi');
            }
            break;
        }
      });

      // Update display state periodically
      const updateDisplayState = () => {
        if (!display || !zoneManager) return;
        const zones = zoneManager.getAllZoneStates();
        const running = zoneManager.getRunningZones();
        const now = new Date();

        display.updateState({
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
          zones: zones.map(z => ({
            id: z.zone,
            name: z.name,
            active: z.status === 'running',
            enabled: true,
          })),
          masterValveActive: zoneManager.isMasterValveOpen(),
          flowRate: gpio!.getFlowGpm(),
          uptime: formatUptime(Math.round(process.uptime())),
          wifiStatus: 'connected',
          wifiSsid: getWifiSsid(),
          wifiIp: getLocalIp(),
          wifiRssi: getWifiRssi(),
          activeWatering: running.length > 0 ? (() => {
            const z = zones.find(z => z.status === 'running')!;
            return {
              zoneId: z.zone,
              zoneName: z.name,
              remaining: z.remainingSeconds != null
                ? `${Math.floor(z.remainingSeconds / 60)}:${String(z.remainingSeconds % 60).padStart(2, '0')}`
                : '--:--',
              elapsed: z.startedAt ? Math.round((Date.now() - new Date(z.startedAt).getTime()) / 1000) : 0,
              total: z.remainingSeconds != null && z.startedAt
                ? Math.round((Date.now() - new Date(z.startedAt).getTime()) / 1000) + z.remainingSeconds
                : 0,
              flowRate: z.flowGpm,
              nextZone: null,
            };
          })() : null,
        });
      };
      setInterval(updateDisplayState, 1000);
      updateDisplayState();
    } catch (err) {
      console.warn('[OLED] Failed to start display:', err);
    }
  }

  // Now that all routes (including OLED simulator) are registered, start listening
  await app.listen({ port: SERVER_PORT, host: SERVER_HOST });
  currentApp = app;
  console.log(`[SERVER] Listening on http://${SERVER_HOST}:${SERVER_PORT}`);
  console.log();

  // Listen for hardware rain sensor
  gpio.on('rain', (detected: boolean) => {
    if (detected) {
      console.log('[RAIN] Rain detected — skipping active schedules');
    }
  });

  // Start Matter bridge (optional)
  if (MATTER_ENABLED) {
    try {
      const { startMatterServer } = await import('./matter/server.js');
      matterBridge = await startMatterServer(zoneManager);
      console.log('[MATTER] Bridge started');
    } catch (err) {
      console.warn('[MATTER] Failed to start Matter bridge:', err);
    }
  }

  // Start BLE provisioning (optional — failure doesn't crash the server)
  if (BLE_ENABLED) {
    try {
      const { createBleProvisioning } = await import('./ble/index.js');
      ble = await createBleProvisioning({
        onWifiCredentials: async (ssid, password) => {
          console.log(`[BLE] WiFi credentials received for "${ssid}"`);
        },
        onZoneNames: async (names) => {
          const zones = await db.getZones();
          for (let i = 0; i < Math.min(names.length, zones.length); i++) {
            await db.updateZone(zones[i].zone, names[i], !!zones[i].enabled);
          }
          await zoneManager!.refreshNames();
        },
        onFactoryReset: async () => {
          await db.resetSetup();
          await transitionToSetup();
        },
        onCloudToken: async (token) => {
          await db.setSetting('turso_token', token);
        },
        getZoneCount: () => zoneManager!.getZoneCount(),
        getZoneNames: () => {
          const states = zoneManager!.getAllZoneStates();
          return states.map(z => z.name);
        },
        getSystemStatus: () => ({
          uptime: Math.round(process.uptime()),
          wifiRssi: 0,
          activeZones: zoneManager!.getRunningZones().length,
          flowRate: gpio!.getFlowGpm(),
          firmware: '3.0.0',
        }),
      });

      // Wire BLE events to display
      if (display) {
        ble.on('connected', () => display!.updateState({ bleConnected: true }));
        ble.on('disconnected', () => display!.updateState({ bleConnected: false }));
        ble.on('advertising-start', () => display!.updateState({ bleAdvertising: true, bleDeviceName: ble!.getDeviceName() }));
      }
    } catch (err) {
      console.warn('[BLE] Failed to start BLE provisioning:', err);
    }
  }
}

async function startSetupMode(): Promise<void> {
  console.log('[STARTUP] No configuration found — entering setup mode');
  console.log('[STARTUP] POST to /api/setup to configure the system');
  console.log();

  const app = await createSetupServer(transitionToOperational);
  await app.listen({ port: SERVER_PORT, host: SERVER_HOST });
  currentApp = app;
  console.log(`[SERVER] Setup server listening on http://${SERVER_HOST}:${SERVER_PORT}`);
}

/** Called by the setup endpoint after setup completes — transitions to full operational mode */
async function transitionToOperational(): Promise<void> {
  console.log('[STARTUP] Setup complete — transitioning to operational mode...');

  // Close the setup server
  if (currentApp) {
    await currentApp.close();
    currentApp = null;
  }

  // Start operational mode on the same port
  await startOperationalMode();
  console.log('[STARTUP] Transition to operational mode complete');
}

/** Called by the reset endpoint — transitions back to setup mode */
async function transitionToSetup(): Promise<void> {
  console.log('[STARTUP] Reset — transitioning to setup mode...');

  // Stop all subsystems
  if (mqttClient) { await mqttClient.shutdown(); mqttClient = null; }
  if (ble) { ble.shutdown(); ble = null; }
  if (display) { display.shutdown(); display = null; }
  if (matterBridge) { await matterBridge.stop(); matterBridge = null; }
  if (flowMonitor) { flowMonitor.shutdown(); flowMonitor = null; }
  if (scheduler) { scheduler.stop(); scheduler = null; }
  if (zoneManager) { zoneManager.stopAll(); zoneManager = null; }
  if (gpio) { gpio.shutdown(); gpio = null; }

  // Close operational server
  if (currentApp) {
    await currentApp.close();
    currentApp = null;
  }

  // Start setup server
  await startSetupMode();
  console.log('[STARTUP] Transition to setup mode complete');
}

async function main() {
  console.log('┌──────────────────────────────────┐');
  console.log('│         HYDRA v3.0.0             │');
  console.log('│  Dynamic Irrigation Controller   │');
  console.log('└──────────────────────────────────┘');
  console.log();

  // 1. Initialize database
  await initDb();

  // 2. Check if setup is complete
  const setupComplete = await db.isSetupComplete();

  if (!setupComplete) {
    await startSetupMode();
  } else {
    await startOperationalMode();
  }

  // ── Graceful Shutdown ───────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`\n[SHUTDOWN] ${signal} received, cleaning up...`);
    if (mqttClient) await mqttClient.shutdown();
    if (ble) ble.shutdown();
    if (display) display.shutdown();
    if (flowMonitor) flowMonitor.shutdown();
    if (scheduler) scheduler.stop();
    if (zoneManager) zoneManager.stopAll();
    if (matterBridge) await matterBridge.stop();
    if (gpio) gpio.shutdown();
    if (currentApp) await currentApp.close();
    closeDb();
    console.log('[SHUTDOWN] Complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Export for use by route handlers
export { transitionToOperational, transitionToSetup };

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
