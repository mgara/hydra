import type { FrameBuffer } from './framebuffer.js';

// Icons are defined as [x,y] coordinate arrays relative to top-left origin
// All icons are designed for roughly 8×8 or 10×10 pixel bounding boxes

export const ICON_WATER_DROP: [number, number][] = [
  [3, 0],
  [2, 1], [3, 1], [4, 1],
  [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 5], [5, 5], [6, 5],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [2, 7], [3, 7], [4, 7],
];

export const ICON_WIFI: [number, number][] = [
  // 3 arcs + dot
  [4, 0], [5, 0], [6, 0], [7, 0], [8, 0],
  [2, 1], [3, 1], [9, 1], [10, 1],
  [1, 2], [11, 2],
  [4, 3], [5, 3], [6, 3], [7, 3], [8, 3],
  [3, 4], [9, 4],
  [5, 5], [6, 5], [7, 5],
  [6, 7],
];

export const ICON_BLUETOOTH: [number, number][] = [
  [3, 0], [4, 0],
  [3, 1], [5, 1],
  [0, 2], [1, 2], [3, 2], [4, 2], [6, 2],
  [2, 3], [3, 3], [5, 3],
  [3, 4], [4, 4],
  [2, 5], [3, 5], [5, 5],
  [0, 6], [1, 6], [3, 6], [4, 6], [6, 6],
  [3, 7], [5, 7],
  [3, 8], [4, 8],
];

export const ICON_ALERT: [number, number][] = [
  [4, 0],
  [3, 1], [4, 1], [5, 1],
  [3, 2], [4, 2], [5, 2],
  [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [1, 5], [2, 5], [3, 5], [5, 5], [6, 5], [7, 5],
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 6],
  [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7], [8, 7],
  // exclamation mark inside
  // (clear center column in rows 3-5, dot at row 6 handled by filled triangle)
];

export const ICON_CHECK: [number, number][] = [
  [6, 0],
  [5, 1], [6, 1],
  [4, 2], [5, 2],
  [0, 3], [3, 3], [4, 3],
  [0, 4], [1, 4], [2, 4], [3, 4],
  [1, 5], [2, 5],
];

export const ICON_FLOW: [number, number][] = [
  // Right-pointing flow arrows
  [0, 1], [1, 1], [2, 1], [3, 1], [4, 0], [5, 1], [4, 2],
  [0, 5], [1, 5], [2, 5], [3, 5], [4, 4], [5, 5], [4, 6],
];

export const ICON_LOCK: [number, number][] = [
  [2, 0], [3, 0], [4, 0],
  [1, 1], [5, 1],
  [1, 2], [5, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [0, 5], [1, 5], [3, 5], [5, 5], [6, 5],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
];

export function drawIcon(fb: FrameBuffer, x: number, y: number, icon: [number, number][]): void {
  fb.drawBitmap(x, y, icon);
}
