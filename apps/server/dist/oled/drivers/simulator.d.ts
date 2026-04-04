import type { FastifyInstance } from 'fastify';
import { EventEmitter } from 'node:events';
import type { OledDriver } from '../types.js';
export declare class SimulatorDriver extends EventEmitter implements OledDriver {
    private clients;
    private displayEnabled;
    private fastify;
    private zoneData;
    constructor(fastify: FastifyInstance);
    init(): Promise<void>;
    writeBuffer(buffer: Uint8Array): void;
    displayOn(): void;
    displayOff(): void;
    setContrast(_value: number): void;
    close(): void;
    /** Send zone state to connected simulator clients */
    updateZones(zones: Array<{
        id: number;
        active: boolean;
    }>): void;
}
export default function simulatorPlugin(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=simulator.d.ts.map