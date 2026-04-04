import { CHAR_UUIDS } from '../types.js';
export function createWifiStatusCharacteristic(bleno) {
    let statusValue = 0;
    let updateCallback = null;
    const characteristic = new bleno.Characteristic({
        uuid: CHAR_UUIDS.WIFI_STATUS,
        properties: ['read', 'notify'],
        onReadRequest: (_offset, callback) => {
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from([statusValue]));
        },
        onSubscribe: (maxValueSize, updateValueCallback) => {
            updateCallback = updateValueCallback;
        },
        onUnsubscribe: () => {
            updateCallback = null;
        },
    });
    return {
        characteristic,
        setStatus(status) {
            statusValue = status;
            if (updateCallback) {
                updateCallback(Buffer.from([status]));
            }
        },
    };
}
//# sourceMappingURL=wifi-status.js.map