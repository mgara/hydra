import { EventEmitter } from 'node:events';
import { execSync } from 'node:child_process';
import { IS_PRODUCTION } from './config.js';
const DEBOUNCE_MS = 50;
/**
 * Hardware power button driver.
 * Short press (<2s) = reboot, Long press (>=2s) = poweroff.
 * Active LOW with internal pull-up — same wiring as OLED buttons.
 */
export class PowerButton extends EventEmitter {
    gpioPin;
    longPressMs;
    gpio = null;
    pressStart = 0;
    lastEventTime = 0;
    constructor(gpioPin, longPressMs) {
        super();
        this.gpioPin = gpioPin;
        this.longPressMs = longPressMs;
    }
    async init() {
        try {
            const pigpio = await import('pigpio');
            const Gpio = pigpio.Gpio;
            this.gpio = new Gpio(this.gpioPin, {
                mode: Gpio.INPUT,
                pullUpDown: Gpio.PUD_UP,
                alert: true,
            });
            this.gpio.on('alert', (level) => {
                const now = Date.now();
                if (now - this.lastEventTime < DEBOUNCE_MS)
                    return;
                this.lastEventTime = now;
                if (level === 0) {
                    // Button pressed (active LOW)
                    this.pressStart = now;
                }
                else if (level === 1 && this.pressStart > 0) {
                    // Button released
                    const held = now - this.pressStart;
                    this.pressStart = 0;
                    if (held >= this.longPressMs) {
                        this.handlePoweroff();
                    }
                    else {
                        this.handleReboot();
                    }
                }
            });
            console.log(`[POWER] Button on GPIO ${this.gpioPin} — short=reboot, long(>${this.longPressMs}ms)=poweroff`);
        }
        catch {
            console.log('[POWER] pigpio not available — power button disabled');
        }
    }
    handleReboot() {
        console.log('[POWER] Short press → reboot');
        this.emit('reboot');
        if (this.isOnPi()) {
            setTimeout(() => execSync('sudo reboot'), 500);
        }
        else {
            console.log('[POWER] Reboot ignored — not running on Pi');
        }
    }
    handlePoweroff() {
        console.log('[POWER] Long press → poweroff');
        this.emit('poweroff');
        if (this.isOnPi()) {
            setTimeout(() => execSync('sudo poweroff'), 500);
        }
        else {
            console.log('[POWER] Poweroff ignored — not running on Pi');
        }
    }
    isOnPi() {
        return IS_PRODUCTION && process.platform === 'linux' && (process.arch === 'arm' || process.arch === 'arm64');
    }
    shutdown() {
        this.gpio = null;
        console.log('[POWER] Button shutdown');
    }
}
//# sourceMappingURL=power-button.js.map