import { CHAR_UUIDS, type WifiStatusCode } from '../types.js';

export function createWifiStatusCharacteristic(bleno: any) {
  let statusValue: WifiStatusCode = 0;
  let updateCallback: ((data: Buffer) => void) | null = null;

  const characteristic = new bleno.Characteristic({
    uuid: CHAR_UUIDS.WIFI_STATUS,
    properties: ['read', 'notify'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from([statusValue]));
    },
    onSubscribe: (maxValueSize: number, updateValueCallback: (data: Buffer) => void) => {
      updateCallback = updateValueCallback;
    },
    onUnsubscribe: () => {
      updateCallback = null;
    },
  });

  return {
    characteristic,
    setStatus(status: WifiStatusCode) {
      statusValue = status;
      if (updateCallback) {
        updateCallback(Buffer.from([status]));
      }
    },
  };
}
