import { EventEmitter } from 'node:events';
import os from 'node:os';
import { SERVICE_UUID } from './types.js';
import { WifiManager } from './wifi-manager.js';
import { createWifiSsidCharacteristic } from './characteristics/wifi-ssid.js';
import { createWifiPasswordCharacteristic } from './characteristics/wifi-password.js';
import { createWifiStatusCharacteristic } from './characteristics/wifi-status.js';
import { createIpAddressCharacteristic } from './characteristics/ip-address.js';
import { createDeviceNameCharacteristic } from './characteristics/device-name.js';
import { createZoneCountCharacteristic } from './characteristics/zone-count.js';
import { createZoneNamesCharacteristic } from './characteristics/zone-names.js';
import { createSystemStatusCharacteristic } from './characteristics/system-status.js';
import { createFirmwareVersionCharacteristic } from './characteristics/firmware-version.js';
import { createFactoryResetCharacteristic } from './characteristics/factory-reset.js';
import { createCloudTokenCharacteristic } from './characteristics/cloud-token.js';
export class BleManager extends EventEmitter {
    bleno = null;
    config;
    wifiManager;
    deviceName;
    pendingSsid = '';
    advertising = false;
    connected = false;
    statusNotifier = null;
    ipNotifier = null;
    statusInterval = null;
    constructor(config) {
        super();
        this.config = config;
        this.wifiManager = new WifiManager();
        this.deviceName = `HYDRA-${this.getMacSuffix()}`;
    }
    async init() {
        try {
            // @ts-ignore — @abandonware/bleno is an optional dependency (only on Linux/Pi)
            const blenoModule = await import('@abandonware/bleno');
            this.bleno = blenoModule.default ?? blenoModule;
        }
        catch {
            console.log('[BLE] bleno not available — BLE provisioning disabled');
            console.log('[BLE] Install @abandonware/bleno to enable BLE');
            return;
        }
        this.bleno.on('stateChange', (state) => {
            console.log(`[BLE] State: ${state}`);
            if (state === 'poweredOn') {
                this.startAdvertising();
            }
            else {
                this.stopAdvertising();
            }
        });
        this.bleno.on('accept', (clientAddress) => {
            this.connected = true;
            console.log(`[BLE] Client connected: ${clientAddress}`);
            this.emit('connected');
        });
        this.bleno.on('disconnect', (clientAddress) => {
            this.connected = false;
            console.log(`[BLE] Client disconnected: ${clientAddress}`);
            this.emit('disconnected');
            // Resume advertising
            this.startAdvertising();
        });
        // Periodic system status notifications
        this.statusInterval = setInterval(() => {
            // Could notify subscribers here
        }, 10000);
        console.log(`[BLE] BLE manager initialized as "${this.deviceName}"`);
    }
    isAdvertising() { return this.advertising; }
    isConnected() { return this.connected; }
    getDeviceName() { return this.deviceName; }
    shutdown() {
        if (this.statusInterval)
            clearInterval(this.statusInterval);
        if (this.bleno) {
            this.stopAdvertising();
        }
        console.log('[BLE] Manager shutdown');
    }
    startAdvertising() {
        if (!this.bleno)
            return;
        const characteristics = this.buildCharacteristics();
        const service = new this.bleno.PrimaryService({
            uuid: SERVICE_UUID,
            characteristics,
        });
        this.bleno.setServices([service], (err) => {
            if (err) {
                console.error('[BLE] Failed to set services:', err);
                return;
            }
        });
        this.bleno.startAdvertising(this.deviceName, [SERVICE_UUID], (err) => {
            if (err) {
                console.error('[BLE] Failed to start advertising:', err);
                return;
            }
            this.advertising = true;
            console.log(`[BLE] Advertising as "${this.deviceName}"`);
            this.emit('advertising-start');
        });
    }
    stopAdvertising() {
        if (!this.bleno)
            return;
        this.bleno.stopAdvertising();
        this.advertising = false;
        this.emit('advertising-stop');
    }
    buildCharacteristics() {
        const bleno = this.bleno;
        // WiFi SSID
        const ssidChar = createWifiSsidCharacteristic(bleno, () => this.pendingSsid || this.wifiManager.getCurrentNetwork(), (ssid) => { this.pendingSsid = ssid; });
        // WiFi Password — triggers connection on write
        const passwordChar = createWifiPasswordCharacteristic(bleno, async (password) => {
            const ssid = this.pendingSsid;
            if (!ssid)
                return;
            this.emit('wifi-credentials-received', ssid);
            this.statusNotifier?.setStatus(1); // connecting
            const status = await this.wifiManager.connect(ssid, password);
            this.statusNotifier?.setStatus(status);
            if (status === 2) {
                const ip = this.wifiManager.getIpAddress();
                this.ipNotifier?.notifyIp(ip);
                this.emit('provisioning-complete', { ssid, ip });
                // Also trigger the external callback
                await this.config.onWifiCredentials(ssid, password);
            }
        });
        // WiFi Status (notifiable)
        const { characteristic: wifiStatusChar, setStatus } = createWifiStatusCharacteristic(bleno);
        this.statusNotifier = { setStatus };
        // IP Address (notifiable)
        const { characteristic: ipChar, notifyIp } = createIpAddressCharacteristic(bleno, () => this.wifiManager.getIpAddress());
        this.ipNotifier = { notifyIp };
        // Device Name
        const nameChar = createDeviceNameCharacteristic(bleno, () => this.deviceName, (name) => { this.deviceName = name; });
        // Zone Count
        const { characteristic: zoneCountChar } = createZoneCountCharacteristic(bleno, this.config.getZoneCount);
        // Zone Names
        const zoneNamesChar = createZoneNamesCharacteristic(bleno, this.config.getZoneNames, async (names) => { await this.config.onZoneNames(names); });
        // System Status
        const { characteristic: sysStatusChar } = createSystemStatusCharacteristic(bleno, this.config.getSystemStatus);
        // Firmware Version
        const fwChar = createFirmwareVersionCharacteristic(bleno, '3.0.0');
        // Factory Reset
        const resetChar = createFactoryResetCharacteristic(bleno, async () => {
            console.log('[BLE] Factory reset requested');
            this.emit('factory-reset');
            await this.config.onFactoryReset();
        });
        // Cloud Token
        const tokenChar = createCloudTokenCharacteristic(bleno, async (token) => {
            console.log('[BLE] Cloud sync token received');
            await this.config.onCloudToken(token);
        });
        return [
            ssidChar, passwordChar, wifiStatusChar, ipChar,
            nameChar, zoneCountChar, zoneNamesChar, sysStatusChar,
            fwChar, resetChar, tokenChar,
        ];
    }
    getMacSuffix() {
        const interfaces = os.networkInterfaces();
        for (const nets of Object.values(interfaces)) {
            if (!nets)
                continue;
            for (const net of nets) {
                if (!net.internal && net.mac && net.mac !== '00:00:00:00:00:00') {
                    return net.mac.replace(/:/g, '').slice(-4).toUpperCase();
                }
            }
        }
        return '0000';
    }
}
//# sourceMappingURL=ble-manager.js.map