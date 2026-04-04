import type { FastifyInstance } from 'fastify';
import type { ZoneManager } from '../zones/manager.js';
import type { FlowMonitor } from '../flow/monitor.js';
import type { MqttClient } from '../mqtt/client.js';
export declare function registerWebSocket(app: FastifyInstance, zoneManager: ZoneManager, flowMonitor?: FlowMonitor, mqttClient?: MqttClient | null): void;
//# sourceMappingURL=websocket.d.ts.map