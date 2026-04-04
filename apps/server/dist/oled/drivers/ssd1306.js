import { EventEmitter } from 'node:events';
const SSD1306_COMMANDS = {
    DISPLAY_OFF: 0xAE,
    DISPLAY_ON: 0xAF,
    SET_MUX_RATIO: 0xA8,
    SET_DISPLAY_OFFSET: 0xD3,
    SET_START_LINE: 0x40,
    SET_SEGMENT_REMAP: 0xA1,
    SET_COM_SCAN_DEC: 0xC8,
    SET_COM_PINS: 0xDA,
    SET_CONTRAST: 0x81,
    DISPLAY_FROM_RAM: 0xA4,
    NORMAL_DISPLAY: 0xA6,
    SET_CLOCK_DIV: 0xD5,
    ENABLE_CHARGE_PUMP: 0x8D,
    SET_MEMORY_MODE: 0x20,
    SET_COLUMN_ADDR: 0x21,
    SET_PAGE_ADDR: 0x22,
};
export class SSD1306Driver extends EventEmitter {
    i2cBus = null;
    address;
    busNumber;
    constructor(address = 0x3C, busNumber = 1) {
        super();
        this.address = address;
        this.busNumber = busNumber;
    }
    async init() {
        try {
            // @ts-ignore — i2c-bus is an optional dependency (only on Raspberry Pi)
            const i2c = await import('i2c-bus');
            this.i2cBus = i2c.openSync(this.busNumber);
        }
        catch (err) {
            console.error('[OLED] Failed to open I2C bus — is i2c-bus installed?', err);
            this.emit('error', err);
            return;
        }
        try {
            this.sendCommands([
                SSD1306_COMMANDS.DISPLAY_OFF,
                SSD1306_COMMANDS.SET_MUX_RATIO, 63, // 64 lines
                SSD1306_COMMANDS.SET_DISPLAY_OFFSET, 0,
                SSD1306_COMMANDS.SET_START_LINE, // 0x40 = start line 0
                SSD1306_COMMANDS.SET_SEGMENT_REMAP, // 0xA1 = column 127 mapped to SEG0
                SSD1306_COMMANDS.SET_COM_SCAN_DEC, // 0xC8 = scan from COM63 to COM0
                SSD1306_COMMANDS.SET_COM_PINS, 0x12, // alternative COM pins, no remap
                SSD1306_COMMANDS.SET_CONTRAST, 0xCF,
                SSD1306_COMMANDS.DISPLAY_FROM_RAM, // 0xA4 = display from RAM
                SSD1306_COMMANDS.NORMAL_DISPLAY, // 0xA6 = non-inverted
                SSD1306_COMMANDS.SET_CLOCK_DIV, 0x80, // default osc freq
                SSD1306_COMMANDS.ENABLE_CHARGE_PUMP, 0x14, // enable charge pump
                SSD1306_COMMANDS.SET_MEMORY_MODE, 0x00, // horizontal addressing
                SSD1306_COMMANDS.DISPLAY_ON,
            ]);
            console.log(`[OLED] SSD1306 initialized on I2C bus ${this.busNumber} @ 0x${this.address.toString(16)}`);
        }
        catch (err) {
            console.error('[OLED] SSD1306 init failed:', err);
            this.emit('error', err);
        }
    }
    writeBuffer(buffer) {
        if (!this.i2cBus)
            return;
        try {
            // Set column and page address to full screen
            this.sendCommands([
                SSD1306_COMMANDS.SET_COLUMN_ADDR, 0, 127,
                SSD1306_COMMANDS.SET_PAGE_ADDR, 0, 7,
            ]);
            // Write pixel data (prefix with 0x40 data control byte)
            const data = Buffer.alloc(buffer.length + 1);
            data[0] = 0x40; // Co=0, D/C#=1 (data)
            Buffer.from(buffer).copy(data, 1);
            this.i2cBus.i2cWriteSync(this.address, data.length, data);
        }
        catch (err) {
            this.emit('error', err);
        }
    }
    displayOn() {
        this.sendCommand(SSD1306_COMMANDS.DISPLAY_ON);
    }
    displayOff() {
        this.sendCommand(SSD1306_COMMANDS.DISPLAY_OFF);
    }
    setContrast(value) {
        this.sendCommands([SSD1306_COMMANDS.SET_CONTRAST, value & 0xFF]);
    }
    close() {
        if (this.i2cBus) {
            try {
                this.sendCommand(SSD1306_COMMANDS.DISPLAY_OFF);
                this.i2cBus.closeSync();
            }
            catch {
                // ignore close errors
            }
            this.i2cBus = null;
        }
        console.log('[OLED] SSD1306 driver closed');
    }
    sendCommand(cmd) {
        if (!this.i2cBus)
            return;
        try {
            const buf = Buffer.from([0x00, cmd]); // Co=0, D/C#=0 (command)
            this.i2cBus.i2cWriteSync(this.address, buf.length, buf);
        }
        catch (err) {
            this.emit('error', err);
        }
    }
    sendCommands(cmds) {
        for (const cmd of cmds) {
            this.sendCommand(cmd);
        }
    }
}
//# sourceMappingURL=ssd1306.js.map