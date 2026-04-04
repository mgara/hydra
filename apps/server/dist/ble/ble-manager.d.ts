import { EventEmitter } from 'node:events';
import type { BleConfig } from './types.js';
export declare class BleManager extends EventEmitter {
    private bleno;
    private config;
    private wifiManager;
    private deviceName;
    private pendingSsid;
    private advertising;
    private connected;
    private statusNotifier;
    private ipNotifier;
    private statusInterval;
    constructor(config: BleConfig);
    init(): Promise<void>;
    isAdvertising(): boolean;
    isConnected(): boolean;
    getDeviceName(): string;
    shutdown(): void;
    private startAdvertising;
    private stopAdvertising;
    private buildCharacteristics;
    private getMacSuffix;
}
//# sourceMappingURL=ble-manager.d.ts.map