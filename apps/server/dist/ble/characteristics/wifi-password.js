import { CHAR_UUIDS } from '../types.js';
export function createWifiPasswordCharacteristic(bleno, onPassword) {
    return new bleno.Characteristic({
        uuid: CHAR_UUIDS.WIFI_PASSWORD,
        properties: ['write'], // Write only — never readable for security
        onWriteRequest: (data, _offset, _withoutResponse, callback) => {
            const password = data.toString('utf8').replace(/\0/g, '');
            onPassword(password);
            callback(bleno.Characteristic.RESULT_SUCCESS);
        },
    });
}
//# sourceMappingURL=wifi-password.js.map