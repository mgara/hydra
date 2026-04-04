import { DisplayManager } from './display-manager.js';
import { SSD1306Driver } from './drivers/ssd1306.js';
import { SimulatorDriver } from './drivers/simulator.js';
import type { DisplayConfig, OledDriver } from './types.js';

export { DisplayManager } from './display-manager.js';
export type { HydraDisplayState, ScreenName, DisplayConfig } from './types.js';

export async function createDisplay(config: DisplayConfig): Promise<DisplayManager> {
  let driver: OledDriver;

  if (config.driver === 'ssd1306') {
    driver = new SSD1306Driver(config.i2cAddress ?? 0x3C, config.i2cBus ?? 1);
  } else {
    if (!config.fastify) {
      throw new Error('Simulator driver requires a Fastify instance');
    }
    driver = new SimulatorDriver(config.fastify);
  }

  const display = new DisplayManager(
    driver,
    {
      upGpio: config.buttonUpGpio ?? null,
      downGpio: config.buttonDownGpio ?? null,
      confirmGpio: config.buttonConfirmGpio ?? null,
    },
    config.sleepTimeout ?? 10 * 60 * 1000,
  );

  await display.init();
  return display;
}
