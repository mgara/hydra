const WIDTH = 128;
const HEIGHT = 64;
const PAGES = HEIGHT / 8; // 8 pages for SSD1306
export class FrameBuffer {
    width = WIDTH;
    height = HEIGHT;
    pixels;
    _dirty = true;
    constructor() {
        this.pixels = new Uint8Array(WIDTH * HEIGHT);
    }
    get dirty() { return this._dirty; }
    clearDirty() { this._dirty = false; }
    clear() {
        this.pixels.fill(0);
        this._dirty = true;
    }
    getPixel(x, y) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT)
            return false;
        return this.pixels[y * WIDTH + x] === 1;
    }
    setPixel(x, y, on = true) {
        if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT)
            return;
        const idx = y * WIDTH + x;
        const val = on ? 1 : 0;
        if (this.pixels[idx] !== val) {
            this.pixels[idx] = val;
            this._dirty = true;
        }
    }
    // ── Drawing Primitives ──────────────────────────────────
    hLine(x, y, w, on = true) {
        for (let i = 0; i < w; i++)
            this.setPixel(x + i, y, on);
    }
    vLine(x, y, h, on = true) {
        for (let i = 0; i < h; i++)
            this.setPixel(x, y + i, on);
    }
    rect(x, y, w, h, on = true) {
        this.hLine(x, y, w, on);
        this.hLine(x, y + h - 1, w, on);
        this.vLine(x, y, h, on);
        this.vLine(x + w - 1, y, h, on);
    }
    fillRect(x, y, w, h, on = true) {
        for (let row = 0; row < h; row++) {
            this.hLine(x, y + row, w, on);
        }
    }
    line(x0, y0, x1, y1, on = true) {
        // Bresenham's line algorithm
        let dx = Math.abs(x1 - x0);
        let dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (;;) {
            this.setPixel(x0, y0, on);
            if (x0 === x1 && y0 === y1)
                break;
            const e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }
    circle(cx, cy, r, on = true) {
        // Midpoint circle algorithm
        let x = r;
        let y = 0;
        let err = 1 - r;
        while (x >= y) {
            this.setPixel(cx + x, cy + y, on);
            this.setPixel(cx + y, cy + x, on);
            this.setPixel(cx - y, cy + x, on);
            this.setPixel(cx - x, cy + y, on);
            this.setPixel(cx - x, cy - y, on);
            this.setPixel(cx - y, cy - x, on);
            this.setPixel(cx + y, cy - x, on);
            this.setPixel(cx + x, cy - y, on);
            y++;
            if (err < 0) {
                err += 2 * y + 1;
            }
            else {
                x--;
                err += 2 * (y - x) + 1;
            }
        }
    }
    /** Draw a bitmap from coordinate array: [[x,y], ...] at offset */
    drawBitmap(ox, oy, coords) {
        for (const [x, y] of coords) {
            this.setPixel(ox + x, oy + y);
        }
    }
    /** Invert a rectangular region (for selection highlighting) */
    invertRect(x, y, w, h) {
        for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
                const px = x + col;
                const py = y + row;
                if (px >= 0 && px < WIDTH && py >= 0 && py < HEIGHT) {
                    const idx = py * WIDTH + px;
                    this.pixels[idx] = this.pixels[idx] ? 0 : 1;
                    this._dirty = true;
                }
            }
        }
    }
    // ── Output Conversions ──────────────────────────────────
    /**
     * Convert to SSD1306 page-oriented format.
     * 8 pages × 128 columns = 1024 bytes.
     * Each byte represents 8 vertical pixels in a column (LSB = top).
     */
    flush() {
        const buf = new Uint8Array(PAGES * WIDTH);
        for (let page = 0; page < PAGES; page++) {
            for (let col = 0; col < WIDTH; col++) {
                let byte = 0;
                for (let bit = 0; bit < 8; bit++) {
                    if (this.pixels[(page * 8 + bit) * WIDTH + col]) {
                        byte |= (1 << bit);
                    }
                }
                buf[page * WIDTH + col] = byte;
            }
        }
        return buf;
    }
    /** Raw pixel data — 128×64 as 0/1 per pixel (for simulator WebSocket) */
    getRawPixels() {
        return new Uint8Array(this.pixels);
    }
}
//# sourceMappingURL=framebuffer.js.map