import { CHAR_UUIDS } from '../types.js';

export function createSystemStatusCharacteristic(
  bleno: any,
  getStatus: () => { uptime: number; wifiRssi: number; activeZones: number; flowRate: number; firmware: string },
) {
  let updateCallback: ((data: Buffer) => void) | null = null;

  const characteristic = new bleno.Characteristic({
    uuid: CHAR_UUIDS.SYSTEM_STATUS,
    properties: ['read', 'notify'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      const json = JSON.stringify(getStatus());
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(json, 'utf8'));
    },
    onSubscribe: (_maxValueSize: number, updateValueCallback: (data: Buffer) => void) => {
      updateCallback = updateValueCallback;
    },
    onUnsubscribe: () => { updateCallback = null; },
  });

  return {
    characteristic,
    notifyStatus() {
      if (updateCallback) {
        const json = JSON.stringify(getStatus());
        updateCallback(Buffer.from(json, 'utf8'));
      }
    },
  };
}
