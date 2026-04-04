import { CHAR_UUIDS } from '../types.js';

export function createZoneCountCharacteristic(bleno: any, getCount: () => number) {
  let updateCallback: ((data: Buffer) => void) | null = null;

  const characteristic = new bleno.Characteristic({
    uuid: CHAR_UUIDS.ZONE_COUNT,
    properties: ['read', 'notify'],
    onReadRequest: (_offset: number, callback: (result: number, data?: Buffer) => void) => {
      callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from([getCount()]));
    },
    onSubscribe: (_maxValueSize: number, updateValueCallback: (data: Buffer) => void) => {
      updateCallback = updateValueCallback;
    },
    onUnsubscribe: () => { updateCallback = null; },
  });

  return {
    characteristic,
    notifyCount(count: number) {
      if (updateCallback) {
        updateCallback(Buffer.from([count]));
      }
    },
  };
}
