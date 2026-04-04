import { CHAR_UUIDS } from '../types.js';
export function createIpAddressCharacteristic(bleno, getIp) {
    let updateCallback = null;
    const characteristic = new bleno.Characteristic({
        uuid: CHAR_UUIDS.IP_ADDRESS,
        properties: ['read', 'notify'],
        onReadRequest: (_offset, callback) => {
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(getIp(), 'utf8'));
        },
        onSubscribe: (_maxValueSize, updateValueCallback) => {
            updateCallback = updateValueCallback;
        },
        onUnsubscribe: () => { updateCallback = null; },
    });
    return {
        characteristic,
        notifyIp(ip) {
            if (updateCallback) {
                updateCallback(Buffer.from(ip, 'utf8'));
            }
        },
    };
}
//# sourceMappingURL=ip-address.js.map