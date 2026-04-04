import { EventEmitter } from 'node:events';
interface ButtonPinConfig {
    upGpio: number | null;
    downGpio: number | null;
    confirmGpio: number | null;
}
export declare class ButtonDriver extends EventEmitter {
    private pins;
    private gpios;
    private lastEventTime;
    private stdinListener;
    constructor(pins: ButtonPinConfig);
    init(): Promise<void>;
    private handleGpioEdge;
    private initStdinFallback;
    private emitAction;
    shutdown(): void;
}
export {};
//# sourceMappingURL=button.d.ts.map