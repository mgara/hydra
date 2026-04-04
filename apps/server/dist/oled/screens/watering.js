import { drawText, drawTextCenter, drawTextRight, CELL_WIDTH } from '../shared/font.js';
import { drawIcon, ICON_WATER_DROP } from '../shared/icons.js';
export function renderWatering(fb, state) {
    const w = state.activeWatering;
    if (!w) {
        drawTextCenter(fb, 28, 'No active watering');
        return;
    }
    // Zone name prominently
    drawIcon(fb, 0, 0, ICON_WATER_DROP);
    const name = w.zoneName.length > 16 ? w.zoneName.substring(0, 15) + '.' : w.zoneName;
    drawText(fb, 10, 1, name);
    fb.hLine(0, 10, 128);
    // Large countdown timer
    drawTextCenter(fb, 16, w.remaining);
    // Progress bar
    const barY = 28;
    const barW = 120;
    const barX = 4;
    fb.rect(barX, barY, barW, 6);
    if (w.total > 0) {
        const progress = Math.min(w.elapsed / w.total, 1);
        const fillW = Math.max(1, Math.round((barW - 2) * progress));
        fb.fillRect(barX + 1, barY + 1, fillW, 4);
    }
    // Elapsed / Total
    const elapsedMin = Math.floor(w.elapsed / 60);
    const elapsedSec = w.elapsed % 60;
    const totalMin = Math.floor(w.total / 60);
    const totalSec = w.total % 60;
    const elapsedStr = `${elapsedMin}:${String(elapsedSec).padStart(2, '0')}`;
    const totalStr = `${totalMin}:${String(totalSec).padStart(2, '0')}`;
    drawText(fb, barX, barY + 8, elapsedStr);
    drawTextRight(fb, barX + barW, barY + 8, totalStr);
    // Flow rate
    drawText(fb, 0, 46, 'Flow:');
    drawText(fb, 6 * CELL_WIDTH, 46, `${w.flowRate.toFixed(1)} GPM`);
    // Next zone
    if (w.nextZone) {
        drawText(fb, 0, 56, 'Next:');
        const nextName = w.nextZone.length > 15 ? w.nextZone.substring(0, 14) + '.' : w.nextZone;
        drawText(fb, 6 * CELL_WIDTH, 56, nextName);
    }
}
//# sourceMappingURL=watering.js.map