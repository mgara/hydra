import { CHAR_UUIDS } from '../types.js';
export function createFirmwareVersionCharacteristic(bleno, version) {
    return new bleno.Characteristic({
        uuid: CHAR_UUIDS.FIRMWARE_VERSION,
        properties: ['read'],
        onReadRequest: (_offset, callback) => {
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(version, 'utf8'));
        },
    });
}
//# sourceMappingURL=firmware-version.js.map