import { CHAR_UUIDS } from '../types.js';
export function createDeviceNameCharacteristic(bleno, getName, setName) {
    return new bleno.Characteristic({
        uuid: CHAR_UUIDS.DEVICE_NAME,
        properties: ['read', 'write'],
        onReadRequest: (_offset, callback) => {
            callback(bleno.Characteristic.RESULT_SUCCESS, Buffer.from(getName(), 'utf8'));
        },
        onWriteRequest: (data, _offset, _withoutResponse, callback) => {
            setName(data.toString('utf8').replace(/\0/g, '').substring(0, 32));
            callback(bleno.Characteristic.RESULT_SUCCESS);
        },
    });
}
//# sourceMappingURL=device-name.js.map