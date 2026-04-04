import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { IS_PRODUCTION } from '../config.js';
import type { ZoneManager } from '../zones/manager.js';
import type { GpioController } from '../gpio/controller.js';
import { registerZoneRoutes } from './routes/zones.js';
import { registerScheduleRoutes } from './routes/schedules.js';
import { registerLogRoutes } from './routes/logs.js';
import { registerSystemRoutes } from './routes/system.js';
import { registerWeatherRoutes } from './routes/weather.js';
import { registerSetupRoutes } from './routes/setup.js';
import { registerFlowRoutes } from './routes/flow.js';
import { registerSoilRoutes } from './routes/soil.js';
import { registerWebSocket } from './websocket.js';
import type { FlowMonitor } from '../flow/monitor.js';
import type { MqttClient } from '../mqtt/client.js';
import * as db from '../db/queries.js';
import os from 'node:os';
import { execSync } from 'node:child_process';

const loggerConfig = IS_PRODUCTION
  ? { level: 'warn' }
  : {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
          singleLine: true,
        },
      },
    };

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

function getWifiRssi(): number | null {
  try {
    if (process.platform === 'linux') {
      // Raspberry Pi / Linux: parse /proc/net/wireless
      const raw = execSync('cat /proc/net/wireless', { timeout: 2000, encoding: 'utf8' });
      const lines = raw.trim().split('\n');
      // Data lines start after 2 header lines
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
  } catch {
    // No WiFi or command unavailable
  }
  return null;
}

/** Full operational server — all routes + WebSocket */
export async function createServer(zoneManager: ZoneManager, gpio: GpioController, flowMonitor?: FlowMonitor, mqttClient?: MqttClient | null) {
  const app = Fastify({ logger: loggerConfig });

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // Health check — re-checks setup state so reset is detected without server restart
  app.get('/api/health', async () => {
    const setupComplete = await db.isSetupComplete();
    return {
      status: setupComplete ? 'ok' : 'setup_required',
      mode: setupComplete ? 'operational' : 'setup',
      version: '3.0.0',
      uptime: Math.round(process.uptime()),
      ip: getLocalIp(),
      hostname: os.hostname(),
      wifiRssi: getWifiRssi(),
    };
  });

  // Register route modules
  registerZoneRoutes(app, zoneManager);
  registerScheduleRoutes(app, zoneManager);
  registerLogRoutes(app);
  registerSystemRoutes(app, zoneManager, gpio);
  registerWeatherRoutes(app);
  registerSetupRoutes(app);
  if (flowMonitor) {
    registerFlowRoutes(app, flowMonitor, gpio);
  }
  if (mqttClient) {
    registerSoilRoutes(app, mqttClient);
  }
  registerWebSocket(app, zoneManager, flowMonitor, mqttClient);

  // Serve web UI static files in production
  if (IS_PRODUCTION) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const webRoot = path.resolve(__dirname, '../../../web/dist');
    await app.register(fastifyStatic, { root: webRoot, wildcard: false });
    // SPA fallback — serve index.html for non-API routes
    app.setNotFoundHandler((_req, reply) => {
      return reply.sendFile('index.html');
    });
  }

  return app;
}

/** Setup-only server — only setup + health routes, everything else returns 503 */
export async function createSetupServer(onSetupComplete?: () => Promise<void>) {
  const app = Fastify({ logger: loggerConfig });

  await app.register(cors, { origin: true });

  // Health check
  app.get('/api/health', async () => ({
    status: 'setup_required',
    mode: 'setup',
    version: '3.0.0',
    uptime: Math.round(process.uptime()),
  }));

  // Setup routes (pass transition callback)
  registerSetupRoutes(app, onSetupComplete);

  // All other /api/* routes return 503
  app.all('/api/*', async (_req, reply) => {
    return reply.status(503).send({
      error: 'Setup required',
      message: 'System is not configured. POST to /api/setup to configure.',
    });
  });

  // Serve web UI static files in production
  if (IS_PRODUCTION) {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const webRoot = path.resolve(__dirname, '../../../web/dist');
    await app.register(fastifyStatic, { root: webRoot, wildcard: false });
    app.setNotFoundHandler((_req, reply) => {
      return reply.sendFile('index.html');
    });
  }

  return app;
}
