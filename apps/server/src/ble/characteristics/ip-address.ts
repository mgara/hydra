import { CHAR_UUIDS } from '../types.js';

export function createIpAddressCharacteristic(bleno: any, getIp: () => string) {
  let updateCallback: ((data: Buffer) => void) | null = null;

  const characteristic = new bleno.Characteristic({
    uuid: CHAR_UUIDS.IP_ADDRESS,
    properties: ['read', 'notify'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(getIp(), 'utf8'));
    },
    onSubscribe: (_maxValueSize: number, updateValueCallback: (data: Buffer) => void) => {
      updateCallback = updateValueCallback;
    },
    onUnsubscribe: () => { updateCallback = null; },
  });

  return {
    characteristic,
    notifyIp(ip: string) {
      if (updateCallback) {
        updateCallback(Buffer.from(ip, 'utf8'));
      }
    },
  };
}
