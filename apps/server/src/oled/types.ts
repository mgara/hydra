export interface OledZoneState {
  id: number;
  name: string;
  active: boolean;
  enabled: boolean;
}

export interface HydraDisplayState {
  // System
  time: string;
  uptime: string;
  firmwareVersion: string;

  // WiFi
  wifiStatus: 'connected' | 'disconnected' | 'connecting' | 'not-configured';
  wifiSsid: string;
  wifiIp: string;
  wifiRssi: number;

  // BLE
  bleAdvertising: boolean;
  bleConnected: boolean;
  bleDeviceName: string;

  // Zones
  zones: OledZoneState[];
  masterValveActive: boolean;

  // Scheduling
  nextRun: { time: string; zones: number[]; duration: number } | null;
  activeWatering: {
    zoneId: number;
    zoneName: string;
    remaining: string;
    elapsed: number;
    total: number;
    flowRate: number;
    nextZone: string | null;
  } | null;

  // Sensors
  flowRate: number;
  rainDetected: boolean;

  // Errors
  activeError: { message: string; timestamp: string } | null;
}

export type ScreenName = 'dashboard' | 'zone-control' | 'network' | 'watering' | 'setup' | 'error' | 'menu' | 'settings' | 'confirm';

export type SettingsAction = 'shutdown' | 'reset' | 'stop-all';

export const MENU_ITEMS = ['System Status', 'Zone Control', 'Network', 'Settings'] as const;
export const SETTINGS_ITEMS: { label: string; action: SettingsAction }[] = [
  { label: 'Stop All Zones', action: 'stop-all' },
  { label: 'Restart Server', action: 'reset' },
  { label: 'Shutdown', action: 'shutdown' },
];
export type ButtonAction = 'up' | 'down' | 'confirm';

export interface DisplayConfig {
  driver: 'simulator' | 'ssd1306';
  i2cAddress?: number;
  i2cBus?: number;
  buttonUpGpio?: number;
  buttonDownGpio?: number;
  buttonConfirmGpio?: number;
  sleepTimeout?: number;
  fastify?: any; // FastifyInstance — typed as any to avoid import dep
}

export interface OledDriver {
  init(): Promise<void>;
  writeBuffer(buffer: Uint8Array): void;
  displayOn(): void;
  displayOff(): void;
  setContrast(value: number): void;
  close(): void;
}
