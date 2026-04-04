import { CHAR_UUIDS } from '../types.js';
export function createZoneNamesCharacteristic(bleno, getNames, setNames) {
    return new bleno.Characteristic({
        uuid: CHAR_UUIDS.ZONE_NAMES,
        properties: ['read', 'write'],
        onReadRequest: (_offset, callback) => {
            const json = JSON.stringify(getNames());
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(json, 'utf8'));
        },
        onWriteRequest: (data, _offset, _withoutResponse, callback) => {
            try {
                const names = JSON.parse(data.toString('utf8'));
                if (Array.isArray(names) && names.every((n) => typeof n === 'string')) {
                    setNames(names);
                    callback(bleno.Characteristic.RESULT_SUCCESS);
                }
                else {
                    callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
                }
            }
            catch {
                callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
            }
        },
    });
}
//# sourceMappingURL=zone-names.js.map