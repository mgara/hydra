import { EventEmitter } from 'node:events';
const DEBOUNCE_MS = 50;
export class ButtonDriver extends EventEmitter {
    pins;
    gpios = [];
    lastEventTime = { up: 0, down: 0, confirm: 0 };
    stdinListener = null;
    constructor(pins) {
        super();
        this.pins = pins;
    }
    async init() {
        const pinMap = [
            { gpio: this.pins.upGpio, action: 'up' },
            { gpio: this.pins.downGpio, action: 'down' },
            { gpio: this.pins.confirmGpio, action: 'confirm' },
        ];
        let gpioAvailable = false;
        for (const { gpio, action } of pinMap) {
            if (gpio == null)
                continue;
            try {
                const pigpio = await import('pigpio');
                const Gpio = pigpio.Gpio;
                const pin = new Gpio(gpio, {
                    mode: Gpio.INPUT,
                    pullUpDown: Gpio.PUD_UP,
                    alert: true,
                });
                pin.on('alert', (level) => {
                    this.handleGpioEdge(level, action);
                });
                this.gpios.push({ pin, action });
                gpioAvailable = true;
                console.log(`[BUTTON] GPIO ${gpio} → ${action} (pull-up, active LOW)`);
            }
            catch {
                break; // pigpio not available, fall back to stdin
            }
        }
        if (!gpioAvailable) {
            console.log('[BUTTON] pigpio not available, falling back to stdin');
            this.initStdinFallback();
        }
    }
    handleGpioEdge(level, action) {
        const now = Date.now();
        if (now - this.lastEventTime[action] < DEBOUNCE_MS)
            return;
        this.lastEventTime[action] = now;
        // Active LOW: emit on press (level 0)
        if (level === 0) {
            this.emitAction(action);
        }
    }
    initStdinFallback() {
        if (!process.stdin.isTTY) {
            console.log('[BUTTON] No TTY available, button input disabled');
            return;
        }
        process.stdin.setRawMode(true);
        process.stdin.resume();
        this.stdinListener = (data) => {
            const key = data[0];
            // Ctrl+C to exit
            if (key === 3) {
                process.exit(0);
            }
            // Arrow up or 'k'
            if (key === 107 || (data.length === 3 && data[0] === 27 && data[1] === 91 && data[2] === 65)) {
                this.emitAction('up');
            }
            // Arrow down or 'j'
            if (key === 106 || (data.length === 3 && data[0] === 27 && data[1] === 91 && data[2] === 66)) {
                this.emitAction('down');
            }
            // Enter = confirm
            if (key === 13 || key === 10) {
                this.emitAction('confirm');
            }
        };
        process.stdin.on('data', this.stdinListener);
        console.log('[BUTTON] Stdin mode: ↑/k=up, ↓/j=down, Enter=confirm');
    }
    emitAction(action) {
        console.log(`[BUTTON] ${action}`);
        this.emit(action);
        this.emit('action', action);
    }
    shutdown() {
        if (this.stdinListener) {
            process.stdin.removeListener('data', this.stdinListener);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            process.stdin.pause();
        }
        console.log('[BUTTON] Driver shutdown');
    }
}
//# sourceMappingURL=button.js.map