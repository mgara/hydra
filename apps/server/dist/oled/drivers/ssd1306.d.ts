import { EventEmitter } from 'node:events';
import type { OledDriver } from '../types.js';
export declare class SSD1306Driver extends EventEmitter implements OledDriver {
    private i2cBus;
    private address;
    private busNumber;
    constructor(address?: number, busNumber?: number);
    init(): Promise<void>;
    writeBuffer(buffer: Uint8Array): void;
    displayOn(): void;
    displayOff(): void;
    setContrast(value: number): void;
    close(): void;
    private sendCommand;
    private sendCommands;
}
//# sourceMappingURL=ssd1306.d.ts.map