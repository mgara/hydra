import Fastify from 'fastify';
import type { ZoneManager } from '../zones/manager.js';
import type { GpioController } from '../gpio/controller.js';
import type { FlowMonitor } from '../flow/monitor.js';
import type { MqttClient } from '../mqtt/client.js';
/** Full operational server — all routes + WebSocket */
export declare function createServer(zoneManager: ZoneManager, gpio: GpioController, flowMonitor?: FlowMonitor, mqttClient?: MqttClient | null): Promise<Fastify.FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>>;
/** Setup-only server — only setup + health routes, everything else returns 503 */
export declare function createSetupServer(onSetupComplete?: () => Promise<void>): Promise<Fastify.FastifyInstance<import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, Fastify.FastifyBaseLogger, Fastify.FastifyTypeProviderDefault>>;
//# sourceMappingURL=server.d.ts.map