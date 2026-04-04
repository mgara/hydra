import { CHAR_UUIDS } from '../types.js';

export function createWifiPasswordCharacteristic(
  bleno: any,
  onPassword: (password: string) => void,
) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.WIFI_PASSWORD,
    properties: ['write'], // Write only — never readable for security
    onWriteRequest: (data: Buffer, _offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
      const password = data.toString('utf8').replace(/\0/g, '');
      onPassword(password);
      callback(bleno.Characteristic.RESULT_SUCCESS);
    },
  });
}
