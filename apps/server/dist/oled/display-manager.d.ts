import { EventEmitter } from 'node:events';
import type { HydraDisplayState, ScreenName, OledDriver } from './types.js';
export declare class DisplayManager extends EventEmitter {
    private fb;
    private driver;
    private button;
    private state;
    private currentScreen;
    private sleeping;
    private sleepTimeout;
    private sleepTimer;
    private renderInterval;
    private menuIndex;
    private settingsIndex;
    private confirmAction;
    private confirmYes;
    private zoneControlIndex;
    constructor(driver: OledDriver, buttonPins: {
        upGpio: number | null;
        downGpio: number | null;
        confirmGpio: number | null;
    }, sleepTimeout?: number);
    init(): Promise<void>;
    shutdown(): void;
    updateState(partial: Partial<HydraDisplayState>): void;
    showScreen(screen: ScreenName): void;
    getScreen(): ScreenName;
    private handleButton;
    private selectMenuItem;
    private executeAction;
    private resetSleepTimer;
    private sleep;
    private wake;
    private renderLoop;
    private render;
}
//# sourceMappingURL=display-manager.d.ts.map