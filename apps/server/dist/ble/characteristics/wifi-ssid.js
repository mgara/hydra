import { CHAR_UUIDS } from '../types.js';
export function createWifiSsidCharacteristic(bleno, getSsid, setSsid) {
    return new bleno.Characteristic({
        uuid: CHAR_UUIDS.WIFI_SSID,
        properties: ['read', 'write'],
        onReadRequest: (offset, callback) => {
            const data = Buffer.from(getSsid(), 'utf8');
            callback(bleno.Characteristic.RESULT_SUCCESS, data.subarray(offset));
        },
        onWriteRequest: (data, offset, withoutResponse, callback) => {
            setSsid(data.toString('utf8').replace(/\0/g, ''));
            callback(bleno.Characteristic.RESULT_SUCCESS);
        },
    });
}
//# sourceMappingURL=wifi-ssid.js.map