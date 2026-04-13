import { BleManager, Device, State, BleError, Characteristic } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';
import { SERVICE_UUID, CHAR_UUIDS, WifiStatusCode } from './ble';

export const bleManager = new BleManager();

/** Request Android BLE permissions (no-op on iOS). */
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const grants = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
  return Object.values(grants).every(v => v === PermissionsAndroid.RESULTS.GRANTED);
}

/** Wait until Bluetooth adapter is powered on. Rejects after timeoutMs. */
export function waitForBluetooth(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Bluetooth not available')), timeoutMs);
    bleManager.onStateChange(state => {
      if (state === State.PoweredOn) {
        clearTimeout(timer);
        resolve();
      }
    }, true);
  });
}

export interface HydraBleDev {
  id: string;
  name: string;
  rssi: number;
}

/**
 * Scan for Hydra BLE peripherals.
 * Calls onFound for each device discovered.
 * Returns a stop function — call it when done scanning.
 */
export function scanForHydra(onFound: (dev: HydraBleDev) => void): () => void {
  const seen = new Set<string>();
  bleManager.startDeviceScan(
    [SERVICE_UUID],
    { allowDuplicates: false },
    (error: BleError | null, device: Device | null) => {
      if (error || !device) return;
      if (seen.has(device.id)) return;
      seen.add(device.id);
      onFound({ id: device.id, name: device.name ?? device.localName ?? device.id, rssi: device.rssi ?? -100 });
    },
  );
  return () => bleManager.stopDeviceScan();
}

export interface ProvisionResult {
  status: WifiStatusCode;
  ip: string | null;
}

/**
 * Connect to a Hydra device and provision WiFi credentials.
 *
 * - Writes SSID then password (password write triggers connect on the server).
 * - Subscribes to WIFI_STATUS notifications; resolves/rejects when terminal status received.
 * - On success (status=2) reads IP_ADDRESS and resolves.
 *
 * @param deviceId BLE device ID from scan
 * @param ssid     WiFi network name
 * @param password WiFi password
 * @param onStatus Called for each intermediate status update
 */
export async function provisionWifi(
  deviceId: string,
  ssid: string,
  password: string,
  onStatus: (status: WifiStatusCode) => void,
): Promise<ProvisionResult> {
  const device = await bleManager.connectToDevice(deviceId, { autoConnect: false });
  await device.discoverAllServicesAndCharacteristics();

  // Write SSID
  const ssidB64 = btoa(ssid);
  await device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUIDS.WIFI_SSID, ssidB64);

  // Subscribe to status before writing password so we don't miss early notifications
  const statusResult = await new Promise<ProvisionResult>((resolve, reject) => {
    const sub = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHAR_UUIDS.WIFI_STATUS,
      (err: BleError | null, char: Characteristic | null) => {
        if (err) { sub.remove(); reject(err); return; }
        // Server sends status as a raw single byte (e.g. Buffer.from([2])).
        // ble-plx delivers it as base64, so atob() gives a binary string — use charCodeAt to get the number.
        const code = char?.value ? (atob(char.value).charCodeAt(0) as WifiStatusCode) : null;
        if (code === null) return;
        onStatus(code);
        // Terminal states: connected (2) or any failure (3, 4, 5)
        if (code === 2) {
          sub.remove();
          // Read IP address
          device.readCharacteristicForService(SERVICE_UUID, CHAR_UUIDS.IP_ADDRESS)
            .then(ipChar => {
              const ip = ipChar.value ? atob(ipChar.value) : null;
              resolve({ status: 2, ip });
            })
            .catch(() => resolve({ status: 2, ip: null }));
        } else if (code >= 3) {
          sub.remove();
          resolve({ status: code, ip: null });
        }
      },
    );

    // Write password — this triggers the async WiFi connect on the server
    const pwB64 = btoa(password);
    device.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_UUIDS.WIFI_PASSWORD, pwB64)
      .catch((err: BleError) => { sub.remove(); reject(err); });
  });

  await device.cancelConnection().catch(() => {/* ignore */});
  return statusResult;
}
