import { CHAR_UUIDS } from '../types.js';
export function createFactoryResetCharacteristic(bleno, onReset) {
    return new bleno.Characteristic({
        uuid: CHAR_UUIDS.FACTORY_RESET,
        properties: ['write'], // Write only
        onWriteRequest: async (data, _offset, _withoutResponse, callback) => {
            const value = data.toString('utf8').trim();
            if (value === 'RESET') {
                callback(bleno.Characteristic.RESULT_SUCCESS);
                // Execute reset after responding
                setTimeout(() => onReset(), 500);
            }
            else {
                callback(bleno.Characteristic.RESULT_UNLIKELY_ERROR);
            }
        },
    });
}
//# sourceMappingURL=factory-reset.js.map