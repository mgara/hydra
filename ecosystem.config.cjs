// Load .env file so PM2 picks up the same vars as dev mode
const { readFileSync } = require('fs');
const { resolve } = require('path');

const dotenv = {};
try {
  const envPath = resolve(__dirname, '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w]+)\s*=\s*'?(.*?)'?\s*$/);
    if (match && !match[1].startsWith('#')) {
      dotenv[match[1]] = match[2];
    }
  }
} catch { /* no .env file — use process.env only */ }

const env = (key, fallback = '') => process.env[key] || dotenv[key] || fallback;

module.exports = {
  apps: [
    {
      name: 'hydra',
      script: 'dist/index.js',
      cwd: '/home/pi/hydra/apps/server',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        MATTER_ENABLED: env('MATTER_ENABLED', 'true'),
        TURSO_TOKEN: env('TURSO_TOKEN'),
        TURSO_URL: env('TURSO_URL'),
        MQTT_BROKER: env('MQTT_BROKER'),
        MQTT_USER: env('MQTT_USER'),
        MQTT_PASS: env('MQTT_PASS'),
        OLED_ENABLED: env('OLED_ENABLED', 'false'),
      },
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      watch: false,
    },
  ],
};
