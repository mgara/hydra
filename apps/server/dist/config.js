export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const SERVER_PORT = parseInt(process.env.PORT || '3000', 10);
export const SERVER_HOST = IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1';
export const DB_PATH = process.env.DB_PATH || './hydra.db';
// Open-Meteo API (free, no key required)
export const WEATHER_LAT = parseFloat(process.env.WEATHER_LAT || '34.0522');
export const WEATHER_LON = parseFloat(process.env.WEATHER_LON || '-118.2437');
export const RAIN_SKIP_THRESHOLD = parseFloat(process.env.RAIN_SKIP_THRESHOLD || '40'); // precipitation probability %
// Available GPIO pool (BCM, excluding reserved pins):
// GPIO2/3 (I2C), GPIO7-11 (SPI), GPIO12/13 (PWM)
// GPIO 19/20/26 reserved for OLED buttons (up/down/confirm)
export const AVAILABLE_GPIO_POOL = [
    4, 5, 6, 14, 15, 16, 17, 18, 23, 24, 25, 27,
];
export const MAX_ZONES = 10;
export const MAX_ZONES_WITH_PER_ZONE_FLOW = 5;
// Matter Smart Home Integration
export const MATTER_ENABLED = process.env.MATTER_ENABLED === 'true';
export const MATTER_PORT = parseInt(process.env.MATTER_PORT || '5540', 10);
export const MATTER_PASSCODE = parseInt(process.env.MATTER_PASSCODE || '20202021', 10);
export const MATTER_DISCRIMINATOR = parseInt(process.env.MATTER_DISCRIMINATOR || '3840', 10);
export const MATTER_STORAGE_PATH = process.env.MATTER_STORAGE_PATH || './data/matter';
export const DEFAULT_RUN_MINUTES = 15;
export const MAX_RUN_MINUTES = 120;
export const FLOW_SENSOR_PULSES_PER_GALLON = 450; // calibrate for your sensor
// OLED Display
export const OLED_ENABLED = process.env.OLED_ENABLED === 'false' ? false : (process.env.HYDRA_SIM === '1' || IS_PRODUCTION);
export const OLED_DRIVER = (process.env.HYDRA_SIM === '1' ? 'simulator' : IS_PRODUCTION ? 'ssd1306' : 'simulator');
export const OLED_I2C_ADDRESS = parseInt(process.env.OLED_I2C_ADDRESS || '0x3C', 16);
export const OLED_I2C_BUS = parseInt(process.env.OLED_I2C_BUS || '1', 10);
export const OLED_BUTTON_UP_GPIO = process.env.OLED_BUTTON_UP_GPIO ? parseInt(process.env.OLED_BUTTON_UP_GPIO, 10) : 19;
export const OLED_BUTTON_DOWN_GPIO = process.env.OLED_BUTTON_DOWN_GPIO ? parseInt(process.env.OLED_BUTTON_DOWN_GPIO, 10) : 20;
export const OLED_BUTTON_CONFIRM_GPIO = process.env.OLED_BUTTON_CONFIRM_GPIO ? parseInt(process.env.OLED_BUTTON_CONFIRM_GPIO, 10) : 26;
export const OLED_SLEEP_TIMEOUT = parseInt(process.env.OLED_SLEEP_TIMEOUT || String(10 * 60 * 1000), 10);
// BLE Provisioning
export const BLE_ENABLED = process.env.BLE_ENABLED !== 'false'; // enabled by default
// MQTT (Zigbee2MQTT soil sensors)
export const MQTT_BROKER = process.env.MQTT_BROKER || ''; // e.g. mqtt://localhost:1883
export const MQTT_USER = process.env.MQTT_USER || '';
export const MQTT_PASS = process.env.MQTT_PASS || '';
export const MQTT_BASE_TOPIC = process.env.MQTT_BASE_TOPIC || 'zigbee2mqtt';
//# sourceMappingURL=config.js.map