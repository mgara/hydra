import { BleManager } from './ble-manager.js';
import type { BleConfig } from './types.js';

export { BleManager } from './ble-manager.js';
export { WifiManager } from './wifi-manager.js';
export type { BleConfig, WifiStatusCode } from './types.js';

export async function createBleProvisioning(config: BleConfig): Promise<BleManager> {
  const manager = new BleManager(config);
  await manager.init();
  return manager;
}
