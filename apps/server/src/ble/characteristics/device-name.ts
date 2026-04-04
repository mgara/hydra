import { CHAR_UUIDS } from '../types.js';

export function createDeviceNameCharacteristic(
  bleno: any,
  getName: () => string,
  setName: (name: string) => void,
) {
  return new bleno.Characteristic({
    uuid: CHAR_UUIDS.DEVICE_NAME,
    properties: ['read', 'write'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(getName(), 'utf8'));
    },
    onWriteRequest: (data: Buffer, _offset: number, _withoutResponse: boolean, callback: (result: number) => void) => {
      setName(data.toString('utf8').replace(/\0/g, '').substring(0, 32));
      callback(bleno.Characteristic.RESULT_SUCCESS);
    },
  });
}
