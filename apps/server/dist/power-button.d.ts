import { EventEmitter } from 'node:events';
/**
 * Hardware power button driver.
 * Short press (<2s) = reboot, Long press (>=2s) = poweroff.
 * Active LOW with internal pull-up — same wiring as OLED buttons.
 */
export declare class PowerButton extends EventEmitter {
    private gpioPin;
    private longPressMs;
    private gpio;
    private pressStart;
    private lastEventTime;
    constructor(gpioPin: number, longPressMs: number);
    init(): Promise<void>;
    private handleReboot;
    private handlePoweroff;
    private isOnPi;
    shutdown(): void;
}
//# sourceMappingURL=power-button.d.ts.map