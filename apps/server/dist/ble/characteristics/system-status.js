import { CHAR_UUIDS } from '../types.js';
export function createSystemStatusCharacteristic(bleno, getStatus) {
    let updateCallback = null;
    const characteristic = new bleno.Characteristic({
        uuid: CHAR_UUIDS.SYSTEM_STATUS,
        properties: ['read', 'notify'],
        onReadRequest: (_offset, callback) => {
            const json = JSON.stringify(getStatus());
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(json, 'utf8'));
        },
        onSubscribe: (_maxValueSize, updateValueCallback) => {
            updateCallback = updateValueCallback;
        },
        onUnsubscribe: () => { updateCallback = null; },
    });
    return {
        characteristic,
        notifyStatus() {
            if (updateCallback) {
                const json = JSON.stringify(getStatus());
                updateCallback(Buffer.from(json, 'utf8'));
            }
        },
    };
}
//# sourceMappingURL=system-status.js.map