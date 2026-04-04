import { drawText, drawTextCenter } from '../shared/font.js';
import { drawIcon, ICON_BLUETOOTH, ICON_CHECK, ICON_WIFI } from '../shared/icons.js';
export function renderSetup(fb, state) {
    // Header
    drawTextCenter(fb, 0, 'HYDRA SETUP');
    fb.hLine(0, 9, 128);
    if (!state.bleConnected && state.wifiStatus !== 'connected') {
        // Waiting for BLE connection
        drawIcon(fb, 58, 16, ICON_BLUETOOTH);
        drawTextCenter(fb, 28, 'Connect via BLE');
        drawTextCenter(fb, 40, `Device: ${state.bleDeviceName}`);
        if (state.bleAdvertising) {
            drawTextCenter(fb, 54, 'Searching...');
        }
        return;
    }
    if (state.bleConnected && state.wifiStatus === 'not-configured') {
        // BLE connected, waiting for WiFi creds
        drawIcon(fb, 2, 14, ICON_CHECK);
        drawText(fb, 12, 14, 'BLE Connected');
        drawTextCenter(fb, 30, 'Waiting for WiFi...');
        return;
    }
    if (state.wifiStatus === 'connecting') {
        // Connecting to WiFi
        drawIcon(fb, 2, 14, ICON_CHECK);
        drawText(fb, 12, 14, 'BLE Connected');
        drawIcon(fb, 2, 26, ICON_WIFI);
        drawText(fb, 14, 26, 'Connecting...');
        if (state.wifiSsid) {
            drawText(fb, 14, 38, state.wifiSsid.substring(0, 17));
        }
        return;
    }
    if (state.wifiStatus === 'connected') {
        // Success!
        drawIcon(fb, 2, 14, ICON_CHECK);
        drawText(fb, 12, 14, 'BLE Connected');
        drawIcon(fb, 2, 26, ICON_CHECK);
        drawText(fb, 12, 26, 'WiFi Connected');
        drawText(fb, 2, 40, `IP: ${state.wifiIp}`);
        drawTextCenter(fb, 54, 'Setup complete!');
        return;
    }
    // WiFi failed
    drawIcon(fb, 2, 14, ICON_CHECK);
    drawText(fb, 12, 14, 'BLE Connected');
    drawText(fb, 2, 28, 'WiFi Failed');
    if (state.wifiStatus === 'disconnected') {
        drawText(fb, 2, 40, 'Check credentials');
    }
    drawTextCenter(fb, 54, 'Retry from app');
}
//# sourceMappingURL=setup.js.map