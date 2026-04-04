import type { FrameBuffer } from '../shared/framebuffer.js';
import { drawText, drawTextCenter } from '../shared/font.js';
import { drawIcon, ICON_ALERT } from '../shared/icons.js';
import type { HydraDisplayState } from '../types.js';

export function renderError(fb: FrameBuffer, state: HydraDisplayState): void {
  const error = state.activeError;

  // Large alert icon centered
  drawIcon(fb, 56, 2, ICON_ALERT);

  fb.hLine(0, 14, 128);

  if (error) {
    // Error message — wrap if needed (21 chars per line max)
    const msg = error.message;
    if (msg.length <= 21) {
      drawTextCenter(fb, 20, msg);
    } else {
      // Simple word-wrap across 2-3 lines
      const words = msg.split(' ');
      let line = '';
      let y = 20;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (test.length > 21) {
          drawTextCenter(fb, y, line);
          y += 10;
          line = word;
          if (y > 45) break;
        } else {
          line = test;
        }
      }
      if (line) {
        drawTextCenter(fb, y, line);
      }
    }

    // Timestamp at bottom
    drawTextCenter(fb, 54, error.timestamp);
  } else {
    drawTextCenter(fb, 28, 'SYSTEM ERROR');
  }
}
