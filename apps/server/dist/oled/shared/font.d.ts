import type { FrameBuffer } from './framebuffer.js';
declare const CHAR_HEIGHT = 7;
declare const CELL_WIDTH: number;
export declare function drawChar(fb: FrameBuffer, x: number, y: number, ch: string, invert?: boolean): void;
export declare function drawText(fb: FrameBuffer, x: number, y: number, text: string, invert?: boolean): void;
export declare function textWidth(text: string): number;
export declare function drawTextRight(fb: FrameBuffer, x: number, y: number, text: string): void;
export declare function drawTextCenter(fb: FrameBuffer, y: number, text: string): void;
export { CELL_WIDTH, CHAR_HEIGHT };
//# sourceMappingURL=font.d.ts.map