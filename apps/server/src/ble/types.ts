export type WifiStatusCode = 0 | 1 | 2 | 3 | 4 | 5;
// 0=not configured, 1=connecting, 2=connected, 3=failed, 4=wrong password, 5=network not found

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

export const SERVICE_UUID = '485944524100000100000000000000000';
export const CHAR_UUIDS = {
  WIFI_SSID:        '48594452410000010000000000000001',
  WIFI_PASSWORD:    '48594452410000010000000000000002',
  WIFI_STATUS:      '48594452410000010000000000000003',
  IP_ADDRESS:       '48594452410000010000000000000004',
  DEVICE_NAME:      '48594452410000010000000000000005',
  ZONE_COUNT:       '48594452410000010000000000000006',
  ZONE_NAMES:       '48594452410000010000000000000007',
  SYSTEM_STATUS:    '48594452410000010000000000000008',
  FIRMWARE_VERSION: '48594452410000010000000000000009',
  FACTORY_RESET:    '4859445241000001000000000000000a',
  CLOUD_TOKEN:      '4859445241000001000000000000000b',
} as const;
