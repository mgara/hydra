export interface OledZoneState {
    id: number;
    name: string;
    active: boolean;
    enabled: boolean;
}
export interface HydraDisplayState {
    time: string;
    uptime: string;
    firmwareVersion: string;
    wifiStatus: 'connected' | 'disconnected' | 'connecting' | 'not-configured';
    wifiSsid: string;
    wifiIp: string;
    wifiRssi: number;
    bleAdvertising: boolean;
    bleConnected: boolean;
    bleDeviceName: string;
    zones: OledZoneState[];
    masterValveActive: boolean;
    nextRun: {
        time: string;
        zones: number[];
        duration: number;
    } | null;
    activeWatering: {
        zoneId: number;
        zoneName: string;
        remaining: string;
        elapsed: number;
        total: number;
        flowRate: number;
        nextZone: string | null;
    } | null;
    flowRate: number;
    rainDetected: boolean;
    activeError: {
        message: string;
        timestamp: string;
    } | null;
}
export type ScreenName = 'dashboard' | 'zone-control' | 'network' | 'watering' | 'setup' | 'error' | 'menu' | 'settings' | 'confirm';
export type SettingsAction = 'shutdown' | 'reset' | 'stop-all';
export declare const MENU_ITEMS: readonly ["System Status", "Zone Control", "Network", "Settings"];
export declare const SETTINGS_ITEMS: {
    label: string;
    action: SettingsAction;
}[];
export type ButtonAction = 'up' | 'down' | 'confirm';
export interface DisplayConfig {
    driver: 'simulator' | 'ssd1306';
    i2cAddress?: number;
    i2cBus?: number;
    buttonUpGpio?: number;
    buttonDownGpio?: number;
    buttonConfirmGpio?: number;
    sleepTimeout?: number;
    fastify?: any;
}
export interface OledDriver {
    init(): Promise<void>;
    writeBuffer(buffer: Uint8Array): void;
    displayOn(): void;
    displayOff(): void;
    setContrast(value: number): void;
    close(): void;
}
//# sourceMappingURL=types.d.ts.map