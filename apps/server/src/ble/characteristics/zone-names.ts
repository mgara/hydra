import { CHAR_UUIDS } from '../types.js';

export function createZoneNamesCharacteristic(
  bleno: any,
  getNames: () => string[],
  setNames: (names: string[]) => void,
) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.ZONE_NAMES,
    properties: ['read', 'write'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      const json = JSON.stringify(getNames());
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(json, 'utf8'));
    },
    onWriteRequest: (data: Buffer, _offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
      try {
        const names = JSON.parse(data.toString('utf8'));
        if (Array.isArray(names) && names.every((n: unknown) => typeof n === 'string')) {
          setNames(names);
          callback(bleno.Characteristic.RESULT_SUCCESS);
        } else {
          callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
        }
      } catch {
        callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      }
    },
  });
}
