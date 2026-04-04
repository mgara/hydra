import { CHAR_UUIDS } from '../types.js';

export function createFirmwareVersionCharacteristic(bleno: any, version: string) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.FIRMWARE_VERSION,
    properties: ['read'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(version, 'utf8'));
    },
  });
}
