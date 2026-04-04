import { drawText } from '../shared/font.js';
import { MENU_ITEMS } from '../types.js';
const ROW_HEIGHT = 12;
const LIST_START_Y = 12;
const HINT_Y = 54;
const VISIBLE_ROWS = Math.floor((HINT_Y - LIST_START_Y) / ROW_HEIGHT); // 3
// Full list: menu items + Back
const ALL_ITEMS = [...MENU_ITEMS, 'Back'];
export function renderMenu(fb, selectedIndex) {
    drawText(fb, 0, 0, 'MENU');
    fb.hLine(0, 9, 128);
    const total = ALL_ITEMS.length;
    // Calculate scroll offset to keep selection visible
    const scrollOffset = Math.max(0, Math.min(selectedIndex - Math.floor(VISIBLE_ROWS / 2), total - VISIBLE_ROWS));
    const visibleStart = Math.max(0, scrollOffset);
    const visibleEnd = Math.min(total, visibleStart + VISIBLE_ROWS);
    for (let i = visibleStart; i < visibleEnd; i++) {
        const y = LIST_START_Y + (i - visibleStart) * ROW_HEIGHT;
        const selected = i === selectedIndex;
        if (selected) {
            fb.fillRect(0, y, 128, ROW_HEIGHT);
            drawText(fb, 10, y + 2, ALL_ITEMS[i], true);
            drawText(fb, 2, y + 2, '>', true);
        }
        else {
            drawText(fb, 10, y + 2, ALL_ITEMS[i]);
        }
    }
    // Scroll indicators
    if (visibleStart > 0) {
        fb.setPixel(124, LIST_START_Y + 1);
        fb.setPixel(123, LIST_START_Y + 2);
        fb.setPixel(125, LIST_START_Y + 2);
    }
    if (visibleEnd < total) {
        const bottomY = LIST_START_Y + VISIBLE_ROWS * ROW_HEIGHT - 2;
        fb.setPixel(124, bottomY);
        fb.setPixel(123, bottomY - 1);
        fb.setPixel(125, bottomY - 1);
    }
    // Hint at bottom
    fb.hLine(0, HINT_Y, 128);
    drawText(fb, 0, 57, '^v:navigate  OK:select');
}
export const MENU_TOTAL_ITEMS = ALL_ITEMS.length;
//# sourceMappingURL=menu.js.map