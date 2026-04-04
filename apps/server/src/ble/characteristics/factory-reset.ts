import { CHAR_UUIDS } from '../types.js';

export function createFactoryResetCharacteristic(
  bleno: any,
  onReset: () => Promise<void>,
) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.FACTORY_RESET,
    properties: ['write'], // Write only
    onWriteRequest: async (data: Buffer, _offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
      const value = data.toString('utf8').trim();
      if (value === 'RESET') {
        callback(bleno.Characteristic.RESULT_SUCCESS);
        // Execute reset after responding
        setTimeout(() => onReset(), 500);
      } else {
        callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      }
    },
  });
}
