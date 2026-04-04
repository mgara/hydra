import { CHAR_UUIDS } from '../types.js';

export function createWifiSsidCharacteristic(bleno: any, getSsid: () => string, setSsid: (ssid: string) => void) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.WIFI_SSID,
    properties: ['read', 'write'],
    onReadRequest: (offset: number, callback: (result: number, data?: Buffer) => void) => {
      const data = Buffer.from(getSsid(), 'utf8');
      callback(bleno.Characteristic.RESULT_SUCCESS, data.subarray(offset));
    },
    onWriteRequest: (data: Buffer, offset: number, withoutResponse: boolean, callback: (result: number) => void) => {
      setSsid(data.toString('utf8').replace(/\0/g, ''));
      callback(bleno.Characteristic.RESULT_SUCCESS);
    },
  });
}
