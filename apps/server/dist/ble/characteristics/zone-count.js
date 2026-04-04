import { CHAR_UUIDS } from '../types.js';
export function createZoneCountCharacteristic(bleno, getCount) {
    let updateCallback = null;
    const characteristic = new bleno.Characteristic({
        uuid: CHAR_UUIDS.ZONE_COUNT,
        properties: ['read', 'notify'],
        onReadRequest: (_offset, callback) => {
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from([getCount()]));
        },
        onSubscribe: (_maxValueSize, updateValueCallback) => {
            updateCallback = updateValueCallback;
        },
        onUnsubscribe: () => { updateCallback = null; },
    });
    return {
        characteristic,
        notifyCount(count) {
            if (updateCallback) {
                updateCallback(Buffer.from([count]));
            }
        },
    };
}
//# sourceMappingURL=zone-count.js.map