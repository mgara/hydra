import { BleManager } from './ble-manager.js';
export { BleManager } from './ble-manager.js';
export { WifiManager } from './wifi-manager.js';
export async function createBleProvisioning(config) {
    const manager = new BleManager(config);
    await manager.init();
    return manager;
}
//# sourceMappingURL=index.js.map