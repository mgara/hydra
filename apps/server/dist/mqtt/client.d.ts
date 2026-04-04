import { EventEmitter } from 'node:events';
export interface SoilReading {
    deviceId: string;
    friendlyName: string;
    moisture: number;
    temperature: number;
    battery: number | null;
    linkQuality: number | null;
    timestamp: string;
}
export interface MqttClientOptions {
    /** Optional zone mapping: friendly_name → zone number */
    zoneMapping?: Record<string, number>;
}
/** Minimal info about a discovered soil sensor (from bridge/devices) */
export interface DiscoveredDevice {
    friendlyName: string;
    model: string;
    ieeeAddress: string;
    lastSeen: string | null;
}
export declare class MqttClient extends EventEmitter {
    private client;
    /** Latest reading per device (friendly_name → reading) */
    private latestReadings;
    /** Devices discovered from bridge/devices (includes sensors that haven't reported yet) */
    private discoveredDevices;
    private reconnectTimer;
    connect(): Promise<void>;
    private handleMessage;
    private processBridgeDevices;
    private processSensorData;
    private resolveZone;
    getLatestReadings(): SoilReading[];
    getDiscoveredDevices(): DiscoveredDevice[];
    /** Get all known sensor names — union of discovered + those that have reported */
    getAllKnownSensorNames(): string[];
    getReadingForDevice(friendlyName: string): SoilReading | undefined;
    /** Get latest moisture % for a zone (null if no sensor mapped) */
    getMoistureForZone(zone: number): Promise<number | null>;
    /** Check if a zone's soil is wet enough to skip irrigation */
    shouldSkipForMoisture(zone: number): Promise<{
        skip: boolean;
        moisture: number | null;
        threshold: number;
    }>;
    isConnected(): boolean;
    shutdown(): Promise<void>;
}
//# sourceMappingURL=client.d.ts.map