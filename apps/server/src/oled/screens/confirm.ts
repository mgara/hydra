import type { FrameBuffer } from '../shared/framebuffer.js';
import { drawText, drawTextRight } from '../shared/font.js';
import type { SettingsAction } from '../types.js';

const ACTION_LABELS: Record<SettingsAction, { title: string; desc: string }> = {
  'stop-all': { title: 'STOP ALL ZONES', desc: 'Close all valves now' },
  'reset': { title: 'RESTART SERVER', desc: 'Reboot controller' },
  'shutdown': { title: 'SHUTDOWN', desc: 'Power off controller' },
};

export function renderConfirm(
  fb: FrameBuffer,
  action: SettingsAction,
  yesSelected: boolean,
): void {
  const { title, desc } = ACTION_LABELS[action];

  drawText(fb, 0, 0, 'CONFIRM');
  fb.hLine(0, 9, 128);

  // Action name + description
  drawText(fb, 0, 14, title);
  drawText(fb, 0, 26, desc);

  // Yes / No buttons
  const btnY = 40;
  if (yesSelected) {
    fb.fillRect(0, btnY - 1, 60, 12);
    drawText(fb, 6, btnY, 'YES', true);
    drawText(fb, 70, btnY, 'NO');
  } else {
    drawText(fb, 6, btnY, 'YES');
    fb.fillRect(64, btnY - 1, 60, 12);
    drawText(fb, 70, btnY, 'NO', true);
  }

  fb.hLine(0, 54, 128);
  drawText(fb, 0, 57, '^v:yes/no  OK:confirm');
}
