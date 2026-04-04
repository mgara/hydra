import { EventEmitter } from 'node:events';
import type { WifiStatusCode } from './types.js';
export declare class WifiManager extends EventEmitter {
    private status;
    getStatus(): WifiStatusCode;
    getIpAddress(): string;
    getCurrentNetwork(): string;
    connect(ssid: string, password: string): Promise<WifiStatusCode>;
    private connectLinux;
    disconnect(): void;
}
//# sourceMappingURL=wifi-manager.d.ts.map