import type { GpioPinConfig } from '../types.js';
import { EventEmitter } from 'node:events';
export interface GpioController extends EventEmitter {
    init(pinConfig: GpioPinConfig): Promise<void>;
    shutdown(): void;
    openValve(pin: number): void;
    closeValve(pin: number): void;
    isValveOpen(pin: number): boolean;
    openMaster(): void;
    closeMaster(): void;
    isMasterOpen(): boolean;
    isRainDetected(): boolean;
    getFlowPulseCount(): number;
    resetFlowPulseCount(): void;
    getFlowGpm(): number;
}
export declare function createGpioController(): GpioController;
//# sourceMappingURL=controller.d.ts.map