import type { FrameBuffer } from '../shared/framebuffer.js';
import { drawText, drawTextRight } from '../shared/font.js';
import type { HydraDisplayState } from '../types.js';

const VISIBLE_ROWS = 6;
const ROW_HEIGHT = 9;
const LIST_START_Y = 11;

export function renderZoneControl(
  fb: FrameBuffer,
  state: HydraDisplayState,
  selectedIndex: number,
): void {
  // Header
  drawText(fb, 0, 0, 'ZONE CONTROL');
  fb.hLine(0, 9, 128);

  const zones = state.zones;
  if (zones.length === 0) {
    drawText(fb, 0, 20, 'No zones');
    return;
  }

  // Total items = zones + Back
  const totalItems = zones.length + 1;
  const backIndex = zones.length;

  // Calculate scroll offset
  const scrollOffset = Math.max(0, Math.min(
    selectedIndex - Math.floor(VISIBLE_ROWS / 2),
    totalItems - VISIBLE_ROWS,
  ));
  const visibleStart = Math.max(0, scrollOffset);
  const visibleEnd = Math.min(totalItems, visibleStart + VISIBLE_ROWS);

  for (let i = visibleStart; i < visibleEnd; i++) {
    const y = LIST_START_Y + (i - visibleStart) * ROW_HEIGHT;
    const isSelected = i === selectedIndex;

    if (i === backIndex) {
      // "Back" item
      drawText(fb, 2, y + 1, 'Back');
    } else {
      const z = zones[i];
      const num = `${z.id}`;
      const name = z.name.length > 14 ? z.name.substring(0, 13) + '.' : z.name;
      const status = z.active ? 'ON' : 'OFF';

      drawText(fb, 2, y + 1, num);
      drawText(fb, 14, y + 1, name);
      drawTextRight(fb, 126, y + 1, status);
    }

    if (isSelected) {
      fb.invertRect(0, y, 128, ROW_HEIGHT);
    }
  }

  // Scroll indicators
  if (visibleStart > 0) {
    fb.setPixel(124, 11);
    fb.setPixel(123, 12); fb.setPixel(125, 12);
  }
  if (visibleEnd < totalItems) {
    const bottomY = LIST_START_Y + VISIBLE_ROWS * ROW_HEIGHT - 2;
    fb.setPixel(124, bottomY);
    fb.setPixel(123, bottomY - 1); fb.setPixel(125, bottomY - 1);
  }
}

/** Total items including Back */
export function zoneControlTotal(zoneCount: number): number {
  return zoneCount + 1;
}
