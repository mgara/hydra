import { CHAR_UUIDS } from '../types.js';

export function createCloudTokenCharacteristic(
  bleno: any,
  onToken: (token: string) => Promise<void>,
) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.CLOUD_TOKEN,
    properties: ['write'], // Write only — never readable for security
    onWriteRequest: async (data: Buffer, _offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
      const token = data.toString('utf8').replace(/\0/g, '');
      if (token.length > 0) {
        await onToken(token);
        callback(bleno.Characteristic.RESULT_SUCCESS);
      } else {
        callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
      }
    },
  });
}
