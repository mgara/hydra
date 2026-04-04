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
        MATTER_ENABLED: 'true',
        TURSO_TOKEN: process.env.TURSO_TOKEN || '',
        TURSO_URL: process.env.TURSO_URL || '',
        MQTT_BROKER: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
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
