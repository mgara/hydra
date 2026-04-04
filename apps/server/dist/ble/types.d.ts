export type WifiStatusCode = 0 | 1 | 2 | 3 | 4 | 5;
export interface BleConfig {
    onWifiCredentials: (ssid: string, password: string) => Promise<void>;
    onZoneNames: (names: string[]) => Promise<void>;
    onFactoryReset: () => Promise<void>;
    onCloudToken: (token: string) => Promise<void>;
    getZoneCount: () => number;
    getZoneNames: () => string[];
    getSystemStatus: () => {
        uptime: number;
        wifiRssi: number;
        activeZones: number;
        flowRate: number;
        firmware: string;
    };
}
export declare const SERVICE_UUID = "485944524100000100000000000000000";
export declare const CHAR_UUIDS: {
    readonly WIFI_SSID: "48594452410000010000000000000001";
    readonly WIFI_PASSWORD: "48594452410000010000000000000002";
    readonly WIFI_STATUS: "48594452410000010000000000000003";
    readonly IP_ADDRESS: "48594452410000010000000000000004";
    readonly DEVICE_NAME: "48594452410000010000000000000005";
    readonly ZONE_COUNT: "48594452410000010000000000000006";
    readonly ZONE_NAMES: "48594452410000010000000000000007";
    readonly SYSTEM_STATUS: "48594452410000010000000000000008";
    readonly FIRMWARE_VERSION: "48594452410000010000000000000009";
    readonly FACTORY_RESET: "4859445241000001000000000000000a";
    readonly CLOUD_TOKEN: "4859445241000001000000000000000b";
};
//# sourceMappingURL=types.d.ts.map