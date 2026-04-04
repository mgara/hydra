import { IS_PRODUCTION, FLOW_SENSOR_PULSES_PER_GALLON } from '../config.js';
import type { GpioPinConfig } from '../types.js';
import { EventEmitter } from 'node:events';

// ── GPIO Interface ──────────────────────────────────────

export interface GpioController extends EventEmitter {
  init(pinConfig: GpioPinConfig): Promise<void>;
  shutdown(): void;

  // Relay outputs (active LOW)
  openValve(pin: number): void;
  closeValve(pin: number): void;
  isValveOpen(pin: number): boolean;

  // Master valve
  openMaster(): void;
  closeMaster(): void;
  isMasterOpen(): boolean;

  // Sensors
  isRainDetected(): boolean;
  getFlowPulseCount(): number;
  resetFlowPulseCount(): void;
  getFlowGpm(): number;
}

// ── Real GPIO (pigpio on Raspberry Pi) ──────────────────

class PiGpioController extends EventEmitter implements GpioController {
  private GpioClass: any = null;
  private outputs = new Map<number, any>();
  private rainSensor: any = null;
  private flowSensor: any = null;
  private flowPulseCount = 0;
  private lastFlowTime = Date.now();
  private lastFlowPulses = 0;
  private masterPin = 0;
  private rainPin: number | null = null;

  async init(pinConfig: GpioPinConfig): Promise<void> {
    const pigpio = await import('pigpio');
    this.GpioClass = pigpio.Gpio;

    this.masterPin = pinConfig.masterValvePin;
    this.rainPin = pinConfig.rainSensorPin;

    // Initialize output pins (zone valves + master)
    const outputPins = [
      pinConfig.masterValvePin,
      ...Object.values(pinConfig.zoneValvePins),
    ];

    for (const pin of outputPins) {
      const gpio = new this.GpioClass(pin, { mode: this.GpioClass.OUTPUT });
      gpio.digitalWrite(1); // HIGH = relay OFF (active LOW)
      this.outputs.set(pin, gpio);
    }

    // Rain sensor (digital input, pull-up) — optional
    if (pinConfig.rainSensorPin != null) {
      this.rainSensor = new this.GpioClass(pinConfig.rainSensorPin, {
        mode: this.GpioClass.INPUT,
        pullUpDown: this.GpioClass.PUD_UP,
        alert: true,
      });
      this.rainSensor.on('alert', (level: number) => {
        this.emit('rain', level === 0); // LOW = rain detected
      });
    }

    // Master flow sensor (pulse input)
    this.flowSensor = new this.GpioClass(pinConfig.masterFlowPin, {
      mode: this.GpioClass.INPUT,
      pullUpDown: this.GpioClass.PUD_UP,
      alert: true,
    });
    this.flowSensor.on('alert', (level: number) => {
      if (level === 1) { // rising edge
        this.flowPulseCount++;
        this.emit('flow:pulse', this.flowPulseCount);
      }
    });

    // Per-zone flow sensors
    for (const [zone, pin] of Object.entries(pinConfig.zoneFlowPins)) {
      const flowGpio = new this.GpioClass(pin, {
        mode: this.GpioClass.INPUT,
        pullUpDown: this.GpioClass.PUD_UP,
        alert: true,
      });
      flowGpio.on('alert', (level: number) => {
        if (level === 1) {
          this.emit(`flow:zone:${zone}`, pin);
        }
      });
    }

    console.log(`[GPIO] Initialized pigpio — ${outputPins.length} outputs, master pin ${this.masterPin}`);
  }

  shutdown(): void {
    for (const [, gpio] of this.outputs) {
      gpio.digitalWrite(1); // OFF
    }
    console.log('[GPIO] All valves closed, shutting down');
  }

  openValve(pin: number): void {
    this.outputs.get(pin)?.digitalWrite(0); // LOW = relay ON
  }

  closeValve(pin: number): void {
    this.outputs.get(pin)?.digitalWrite(1); // HIGH = relay OFF
  }

  isValveOpen(pin: number): boolean {
    return this.outputs.get(pin)?.digitalRead() === 0;
  }

  openMaster(): void { this.openValve(this.masterPin); }
  closeMaster(): void { this.closeValve(this.masterPin); }
  isMasterOpen(): boolean { return this.isValveOpen(this.masterPin); }

  isRainDetected(): boolean {
    return this.rainSensor?.digitalRead() === 0;
  }

  getFlowPulseCount(): number { return this.flowPulseCount; }
  resetFlowPulseCount(): void { this.flowPulseCount = 0; }

  getFlowGpm(): number {
    const now = Date.now();
    const elapsedMinutes = (now - this.lastFlowTime) / 60000;
    if (elapsedMinutes < 0.05) return 0;
    const pulses = this.flowPulseCount - this.lastFlowPulses;
    const gallons = pulses / FLOW_SENSOR_PULSES_PER_GALLON;
    this.lastFlowTime = now;
    this.lastFlowPulses = this.flowPulseCount;
    return Math.round((gallons / elapsedMinutes) * 100) / 100;
  }
}

// ── Mock GPIO (for Mac/dev) ─────────────────────────────

class MockGpioController extends EventEmitter implements GpioController {
  private pinStates = new Map<number, boolean>();
  private flowPulseCount = 0;
  private mockFlowInterval: ReturnType<typeof setInterval> | null = null;
  private mockRainState = false;
  private masterPin = 0;
  private mockLeakMode = false;
  private mockNoFlowMode = false;

  async init(pinConfig: GpioPinConfig): Promise<void> {
    this.masterPin = pinConfig.masterValvePin;

    const allPins = [
      pinConfig.masterValvePin,
      ...Object.values(pinConfig.zoneValvePins),
    ];
    for (const pin of allPins) {
      this.pinStates.set(pin, false);
    }

    // Simulate flow pulses when any zone is running (or leak mode)
    this.mockFlowInterval = setInterval(() => {
      if (this.mockNoFlowMode) return; // suppress all flow

      const anyOpen = [...this.pinStates.entries()].some(
        ([pin, open]) => open && pin !== this.masterPin
      );
      if ((anyOpen && this.isMasterOpen()) || this.mockLeakMode) {
        this.flowPulseCount += Math.floor(FLOW_SENSOR_PULSES_PER_GALLON / 15);
        this.emit('flow:pulse', this.flowPulseCount);
      }
    }, 1000);

    console.log(`[GPIO] Mock mode initialized — ${allPins.length} pins, master pin ${this.masterPin}`);
  }

  shutdown(): void {
    if (this.mockFlowInterval) clearInterval(this.mockFlowInterval);
    this.pinStates.clear();
    console.log('[GPIO] Mock controller shutdown');
  }

  openValve(pin: number): void {
    this.pinStates.set(pin, true);
    console.log(`[GPIO:MOCK] Valve pin ${pin} OPENED`);
  }

  closeValve(pin: number): void {
    this.pinStates.set(pin, false);
    console.log(`[GPIO:MOCK] Valve pin ${pin} CLOSED`);
  }

  isValveOpen(pin: number): boolean {
    return this.pinStates.get(pin) ?? false;
  }

  openMaster(): void { this.openValve(this.masterPin); }
  closeMaster(): void { this.closeValve(this.masterPin); }
  isMasterOpen(): boolean { return this.isValveOpen(this.masterPin); }

  isRainDetected(): boolean { return this.mockRainState; }

  /** For testing: simulate rain sensor trigger */
  setMockRain(detected: boolean): void {
    this.mockRainState = detected;
    this.emit('rain', detected);
  }

  getFlowPulseCount(): number { return this.flowPulseCount; }
  resetFlowPulseCount(): void { this.flowPulseCount = 0; }

  getFlowGpm(): number {
    if (this.mockNoFlowMode) return 0;

    const anyOpen = [...this.pinStates.entries()].some(
      ([pin, open]) => open && pin !== this.masterPin
    );
    if ((anyOpen && this.isMasterOpen()) || this.mockLeakMode) {
      return 3.8 + Math.random() * 1.2;
    }
    return 0;
  }

  /** Simulate a leak (flow with no active zones) */
  simulateLeak(enabled: boolean): void {
    this.mockLeakMode = enabled;
    console.log(`[GPIO:MOCK] Leak simulation ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  /** Simulate no-flow condition (suppress all flow pulses) */
  simulateNoFlow(enabled: boolean): void {
    this.mockNoFlowMode = enabled;
    console.log(`[GPIO:MOCK] No-flow simulation ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }
}

// ── Factory ─────────────────────────────────────────────

export function createGpioController(): GpioController {
  return IS_PRODUCTION ? new PiGpioController() : new MockGpioController();
}
