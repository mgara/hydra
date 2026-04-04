export declare class FrameBuffer {
    readonly width = 128;
    readonly height = 64;
    private pixels;
    private _dirty;
    constructor();
    get dirty(): boolean;
    clearDirty(): void;
    clear(): void;
    getPixel(x: number, y: number): boolean;
    setPixel(x: number, y: number, on?: boolean): void;
    hLine(x: number, y: number, w: number, on?: boolean): void;
    vLine(x: number, y: number, h: number, on?: boolean): void;
    rect(x: number, y: number, w: number, h: number, on?: boolean): void;
    fillRect(x: number, y: number, w: number, h: number, on?: boolean): void;
    line(x0: number, y0: number, x1: number, y1: number, on?: boolean): void;
    circle(cx: number, cy: number, r: number, on?: boolean): void;
    /** Draw a bitmap from coordinate array: [[x,y], ...] at offset */
    drawBitmap(ox: number, oy: number, coords: [number, number][]): void;
    /** Invert a rectangular region (for selection highlighting) */
    invertRect(x: number, y: number, w: number, h: number): void;
    /**
     * Convert to SSD1306 page-oriented format.
     * 8 pages × 128 columns = 1024 bytes.
     * Each byte represents 8 vertical pixels in a column (LSB = top).
     */
    flush(): Uint8Array;
    /** Raw pixel data — 128×64 as 0/1 per pixel (for simulator WebSocket) */
    getRawPixels(): Uint8Array;
}
//# sourceMappingURL=framebuffer.d.ts.map