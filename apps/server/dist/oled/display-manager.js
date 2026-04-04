import { EventEmitter } from 'node:events';
import { FrameBuffer } from './shared/framebuffer.js';
import { renderDashboard, renderZoneControl, zoneControlTotal, renderNetwork, renderWatering, renderSetup, renderError, renderMenu, renderSettingsMenu, renderConfirm, MENU_TOTAL_ITEMS, SETTINGS_TOTAL_ITEMS, } from './screens/index.js';
import { MENU_ITEMS, SETTINGS_ITEMS } from './types.js';
import { ButtonDriver } from './drivers/button.js';
import { SimulatorDriver } from './drivers/simulator.js';
const DEFAULT_STATE = {
    time: '--:--',
    uptime: '--',
    firmwareVersion: '3.0.0',
    wifiStatus: 'not-configured',
    wifiSsid: '',
    wifiIp: '',
    wifiRssi: 0,
    bleAdvertising: false,
    bleConnected: false,
    bleDeviceName: 'HYDRA-0000',
    zones: [],
    masterValveActive: false,
    nextRun: null,
    activeWatering: null,
    flowRate: 0,
    rainDetected: false,
    activeError: null,
};
export class DisplayManager extends EventEmitter {
    fb;
    driver;
    button;
    state;
    currentScreen = 'dashboard';
    sleeping = false;
    sleepTimeout;
    sleepTimer = null;
    renderInterval = null;
    // Navigation state
    menuIndex = 0;
    settingsIndex = 0;
    confirmAction = 'stop-all';
    confirmYes = false;
    zoneControlIndex = 0;
    constructor(driver, buttonPins, sleepTimeout = 10 * 60 * 1000) {
        super();
        this.fb = new FrameBuffer();
        this.driver = driver;
        this.button = new ButtonDriver(buttonPins);
        this.state = { ...DEFAULT_STATE };
        this.sleepTimeout = sleepTimeout;
    }
    async init() {
        await this.driver.init();
        await this.button.init();
        // Wire button events to state machine
        this.button.on('action', (action) => {
            this.handleButton(action);
        });
        // Wire simulator events
        if (this.driver instanceof SimulatorDriver) {
            this.driver.on('button', (action) => {
                this.handleButton(action);
            });
            this.driver.on('zone-toggle', (zoneId) => {
                this.emit('zone-toggle', zoneId);
            });
        }
        // Start render loop (200ms = 5fps)
        this.renderInterval = setInterval(() => this.renderLoop(), 200);
        this.render();
        this.resetSleepTimer();
        console.log('[DISPLAY] DisplayManager initialized');
    }
    shutdown() {
        if (this.renderInterval)
            clearInterval(this.renderInterval);
        if (this.sleepTimer)
            clearTimeout(this.sleepTimer);
        this.button.shutdown();
        this.driver.close();
        console.log('[DISPLAY] DisplayManager shutdown');
    }
    // ── Public API ──────────────────────────────────────
    updateState(partial) {
        Object.assign(this.state, partial);
        // Auto-switch to watering screen when irrigation starts
        if (partial.activeWatering && this.currentScreen === 'dashboard') {
            this.showScreen('watering');
        }
        // Auto-switch back to dashboard when watering ends
        if (partial.activeWatering === null && this.currentScreen === 'watering') {
            this.showScreen('dashboard');
        }
        // Auto-show error screen on critical errors
        if (partial.activeError && this.currentScreen !== 'error') {
            this.wake();
            this.showScreen('error');
        }
        // Update simulator zone buttons
        if (partial.zones && this.driver instanceof SimulatorDriver) {
            this.driver.updateZones(this.state.zones.map(z => ({ id: z.id, active: z.active })));
        }
    }
    showScreen(screen) {
        if (this.currentScreen !== screen) {
            this.currentScreen = screen;
            this.render();
            this.emit('screen-change', screen);
        }
    }
    getScreen() {
        return this.currentScreen;
    }
    // ── Button State Machine ────────────────────────────
    handleButton(action) {
        // Any press wakes the display
        if (this.sleeping) {
            this.wake();
            this.showScreen('dashboard');
            return;
        }
        this.resetSleepTimer();
        switch (this.currentScreen) {
            case 'dashboard':
                if (action === 'confirm') {
                    this.menuIndex = 0;
                    this.showScreen('menu');
                }
                // UP/DOWN on dashboard → no-op (status screen)
                break;
            case 'menu':
                if (action === 'up') {
                    this.menuIndex = (this.menuIndex - 1 + MENU_TOTAL_ITEMS) % MENU_TOTAL_ITEMS;
                    this.render();
                }
                else if (action === 'down') {
                    this.menuIndex = (this.menuIndex + 1) % MENU_TOTAL_ITEMS;
                    this.render();
                }
                else if (action === 'confirm') {
                    this.selectMenuItem();
                }
                break;
            case 'network':
                if (action === 'confirm') {
                    this.menuIndex = 0;
                    this.showScreen('menu');
                }
                break;
            case 'settings':
                if (action === 'up') {
                    this.settingsIndex = (this.settingsIndex - 1 + SETTINGS_TOTAL_ITEMS) % SETTINGS_TOTAL_ITEMS;
                    this.render();
                }
                else if (action === 'down') {
                    this.settingsIndex = (this.settingsIndex + 1) % SETTINGS_TOTAL_ITEMS;
                    this.render();
                }
                else if (action === 'confirm') {
                    // Last item is "Back"
                    if (this.settingsIndex >= SETTINGS_ITEMS.length) {
                        this.menuIndex = 0;
                        this.showScreen('menu');
                    }
                    else {
                        this.confirmAction = SETTINGS_ITEMS[this.settingsIndex].action;
                        this.confirmYes = false;
                        this.showScreen('confirm');
                    }
                }
                break;
            case 'confirm':
                if (action === 'up' || action === 'down') {
                    this.confirmYes = !this.confirmYes;
                    this.render();
                }
                else if (action === 'confirm') {
                    if (this.confirmYes) {
                        this.executeAction(this.confirmAction);
                    }
                    this.showScreen('settings');
                }
                break;
            case 'zone-control': {
                const zcTotal = zoneControlTotal(this.state.zones.length);
                if (action === 'up') {
                    this.zoneControlIndex = (this.zoneControlIndex - 1 + zcTotal) % zcTotal;
                    this.render();
                }
                else if (action === 'down') {
                    this.zoneControlIndex = (this.zoneControlIndex + 1) % zcTotal;
                    this.render();
                }
                else if (action === 'confirm') {
                    if (this.zoneControlIndex >= this.state.zones.length) {
                        // "Back" selected
                        this.menuIndex = 0;
                        this.showScreen('menu');
                    }
                    else {
                        const zone = this.state.zones[this.zoneControlIndex];
                        if (zone) {
                            this.emit('zone-toggle', zone.id);
                        }
                    }
                }
                break;
            }
            case 'watering':
                if (action === 'confirm') {
                    this.menuIndex = 0;
                    this.showScreen('menu');
                }
                break;
            case 'error':
                if (action === 'confirm') {
                    this.showScreen('dashboard');
                }
                break;
        }
    }
    selectMenuItem() {
        // Last item is "Back" → return to dashboard
        if (this.menuIndex >= MENU_ITEMS.length) {
            this.showScreen('dashboard');
            return;
        }
        switch (this.menuIndex) {
            case 0: // System Status
                this.showScreen('dashboard');
                break;
            case 1: // Zone Control
                this.zoneControlIndex = 0;
                this.showScreen('zone-control');
                break;
            case 2: // Network
                this.showScreen('network');
                break;
            case 3: // Settings
                this.settingsIndex = 0;
                this.showScreen('settings');
                break;
        }
    }
    executeAction(action) {
        console.log(`[DISPLAY] Action confirmed: ${action}`);
        this.emit('action', action);
    }
    // ── Sleep / Wake ────────────────────────────────────
    resetSleepTimer() {
        if (this.sleepTimer)
            clearTimeout(this.sleepTimer);
        this.sleepTimer = setTimeout(() => this.sleep(), this.sleepTimeout);
    }
    sleep() {
        if (this.sleeping)
            return;
        this.sleeping = true;
        this.driver.displayOff();
        this.emit('sleep');
        console.log('[DISPLAY] Sleep');
    }
    wake() {
        if (!this.sleeping)
            return;
        this.sleeping = false;
        this.driver.displayOn();
        this.resetSleepTimer();
        this.emit('wake');
        console.log('[DISPLAY] Wake');
    }
    // ── Rendering ───────────────────────────────────────
    renderLoop() {
        if (!this.sleeping) {
            this.render();
        }
    }
    render() {
        this.fb.clear();
        switch (this.currentScreen) {
            case 'dashboard':
                renderDashboard(this.fb, this.state);
                break;
            case 'menu':
                renderMenu(this.fb, this.menuIndex);
                break;
            case 'zone-control':
                renderZoneControl(this.fb, this.state, this.zoneControlIndex);
                break;
            case 'network':
                renderNetwork(this.fb, this.state);
                break;
            case 'settings':
                renderSettingsMenu(this.fb, this.settingsIndex);
                break;
            case 'confirm':
                renderConfirm(this.fb, this.confirmAction, this.confirmYes);
                break;
            case 'watering':
                renderWatering(this.fb, this.state);
                break;
            case 'setup':
                renderSetup(this.fb, this.state);
                break;
            case 'error':
                renderError(this.fb, this.state);
                break;
        }
        const ssd1306Buffer = this.fb.flush();
        this.driver.writeBuffer(ssd1306Buffer);
        this.fb.clearDirty();
    }
}
//# sourceMappingURL=display-manager.js.map