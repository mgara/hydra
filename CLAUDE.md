# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Root (all apps via Nx)
```bash
yarn dev              # Run all apps in dev mode
yarn build            # Build all apps
yarn lint             # Lint all apps
yarn deploy           # Deploy via scripts/deploy.sh
```

### Server (`apps/server`)
```bash
yarn dev:server       # tsx watch with .env
yarn build            # tsc compile to dist/
# Lint: tsc --noEmit (no test suite)
```

### Web (`apps/web`)
```bash
yarn dev:web          # Vite dev server
yarn build            # Vite production build
```

### Mobile (`apps/mobile`)
```bash
yarn dev:mobile           # expo start
yarn dev:mobile:ios       # expo run:ios
yarn dev:mobile:android   # expo run:android
# Lint: eslint src/
```

## Architecture

### Monorepo layout
Three Yarn workspaces under `apps/`: `server` (Fastify/Node.js), `web` (React/Vite), `mobile` (React Native/Expo). Nx orchestrates cross-app tasks.

### Provisioning & discovery flow
The controller (Raspberry Pi) boots into one of two modes:

1. **Setup mode** — SQLite has no config. A minimal Fastify server listens and waits for WiFi credentials. BLE GATT peripheral is active (via `@abandonware/bleno`, Linux/Pi only), advertising as `HYDRA-{MAC_SUFFIX}` on service UUID `48594452-4100-0001-0000-000000000000`.
2. **Operational mode** — Full server: GPIO, zone scheduler, OLED, MQTT, Matter bridge, mDNS advertising (`_hydra._tcp`), and BLE (for re-provisioning).

Mobile setup flow: BLE scan → write SSID + password → controller connects to WiFi → notifies IP via BLE → mobile discovers controller via mDNS → HTTP API from then on.

### BLE GATT profile (server ↔ mobile)
Defined in `apps/server/src/ble/` (server-side implementation) and mirrored as constants in `apps/mobile/src/lib/ble.ts`. Key characteristics:

| Characteristic | UUID suffix | R/W/N | Purpose |
|---|---|---|---|
| WIFI_SSID | `...0001` | R+W | Pending/current SSID |
| WIFI_PASSWORD | `...0002` | W | Password (write triggers connect) |
| WIFI_STATUS | `...0003` | R+N | `WifiStatusCode` 0–5 |
| IP_ADDRESS | `...0004` | R+N | Device IP once connected |
| DEVICE_NAME | `...0005` | R+W | Friendly name (max 32 chars) |
| ZONE_COUNT | `...0006` | R+N | Number of zones |
| ZONE_NAMES | `...0007` | R+W | JSON string array |
| SYSTEM_STATUS | `...0008` | R+N | JSON `{uptime,wifiRssi,activeZones,flowRate,firmware}` |
| FIRMWARE_VERSION | `...0009` | R | Version string |
| FACTORY_RESET | `...000a` | W | Write `"RESET"` to trigger |
| CLOUD_TOKEN | `...000b` | W | Cloud sync token |

Writing `WIFI_PASSWORD` triggers the async connect sequence. Status is notified on `WIFI_STATUS`; IP is notified on `IP_ADDRESS` once connected.

### Server modules (`apps/server/src/`)
- `ble/` — GATT peripheral manager + 11 characteristic files + `wifi-manager.ts` (nmcli on Linux, simulated on macOS)
- `gpio/` — Relay/valve control (pigpio, optional)
- `zones/` — Irrigation zone manager
- `scheduler/` — node-cron irrigation schedules
- `flow/` — Pulse-based flow rate monitor
- `oled/` — SSD1306 I2C display driver (optional)
- `mqtt/` — Zigbee soil sensor client
- `matter/` — Matter bridge (optional, disabled by default)
- `mdns/` — bonjour-service advertising (`_hydra._tcp`)
- `db/` — SQLite via `@libsql/client`
- `api/` — Fastify HTTP + WebSocket routes

Optional deps (`pigpio`, `@abandonware/bleno`, `i2c-bus`) are Linux/Pi-only and gracefully skipped when absent.

### Mobile app (`apps/mobile/src/`)
- `app/setup/index.tsx` — Onboarding: BLE provisioning → mDNS discovery → connects to HTTP API
- `app/(tabs)/` — Dashboard, zones, settings (file-based routing via expo-router)
- `lib/ble.ts` — UUID constants + `WifiStatusCode` labels (no native BLE impl here)
- `lib/discovery.ts` — mDNS scan via `react-native-zeroconf` for `_hydra._tcp`
- `lib/api.ts` — HTTP client; base URL set at runtime after discovery

### Environment variables (server)
`BLE_ENABLED` (default true), `OLED_ENABLED`, `MATTER_ENABLED` (default false), `DB_PATH`, `PORT` (default 3000), `MQTT_BROKER/USER/PASS`, `WEATHER_LAT/LON`.
