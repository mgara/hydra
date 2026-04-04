import { drawText, drawTextRight } from '../shared/font.js';
import { drawIcon, ICON_WIFI } from '../shared/icons.js';
export function renderNetwork(fb, state) {
    // Header
    drawText(fb, 0, 0, 'NETWORK');
    drawIcon(fb, 50, 0, ICON_WIFI);
    fb.hLine(0, 9, 128);
    let y = 13;
    const line = (label, value) => {
        drawText(fb, 0, y, label);
        drawTextRight(fb, 128, y, value);
        y += 10;
    };
    // IP address
    line('IP', state.wifiIp || '--');
    // SSID
    const ssid = state.wifiSsid.length > 12
        ? state.wifiSsid.substring(0, 11) + '.'
        : state.wifiSsid || '--';
    line('SSID', ssid);
    // Signal strength
    const rssiLabel = state.wifiRssi === 0 ? '--'
        : `${state.wifiRssi}dBm`;
    line('RSSI', rssiLabel);
    // Uptime
    line('UP', state.uptime || '--');
    // Firmware
    line('FW', state.firmwareVersion || '--');
}
//# sourceMappingURL=network.js.map