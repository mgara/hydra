import { drawText, drawTextRight, CELL_WIDTH } from '../shared/font.js';
import { drawIcon, ICON_WIFI, ICON_FLOW } from '../shared/icons.js';
export function renderDashboard(fb, state) {
    // ── Header: HYDRA + time ──────────────────────────
    drawText(fb, 0, 0, 'HYDRA');
    drawTextRight(fb, 128, 0, state.time);
    fb.hLine(0, 9, 128);
    // ── Active zones ──────────────────────────────────
    const activeZones = state.zones.filter(z => z.active);
    if (activeZones.length > 0) {
        drawText(fb, 0, 12, 'ACTIVE:');
        let y = 12;
        for (let i = 0; i < Math.min(activeZones.length, 3); i++) {
            const z = activeZones[i];
            const name = z.name.length > 12 ? z.name.substring(0, 11) + '.' : z.name;
            drawTextRight(fb, 128, y, name);
            y += 10;
        }
        if (activeZones.length > 3) {
            drawText(fb, 0, y, `+${activeZones.length - 3} more`);
        }
    }
    else {
        drawText(fb, 0, 14, 'All zones idle');
    }
    // ── Next scheduled run ────────────────────────────
    if (state.nextRun && activeZones.length === 0) {
        const y = 26;
        drawText(fb, 0, y, 'NEXT:');
        drawText(fb, 6 * CELL_WIDTH, y, state.nextRun.time);
        const zoneStr = state.nextRun.zones.length > 2
            ? `Z${state.nextRun.zones[0]},${state.nextRun.zones[1]}+${state.nextRun.zones.length - 2}`
            : state.nextRun.zones.map(z => `Z${z}`).join(',');
        drawTextRight(fb, 128, y, zoneStr);
    }
    // ── Bottom status bar ─────────────────────────────
    fb.hLine(0, 54, 128);
    // WiFi indicator
    if (state.wifiStatus === 'connected') {
        drawIcon(fb, 0, 56, ICON_WIFI);
    }
    else {
        drawText(fb, 0, 57, 'NoWi');
    }
    // Flow rate
    if (state.flowRate > 0.05) {
        drawIcon(fb, 50, 57, ICON_FLOW);
        drawText(fb, 60, 57, `${state.flowRate.toFixed(1)}`);
    }
    // System state
    const systemLabel = activeZones.length > 0 ? 'RUN'
        : state.activeError ? 'ERR'
            : 'IDLE';
    drawTextRight(fb, 128, 57, systemLabel);
}
//# sourceMappingURL=dashboard.js.map