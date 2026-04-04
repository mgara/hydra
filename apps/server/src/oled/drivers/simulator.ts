import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { EventEmitter } from 'node:events';
import type { OledDriver, ButtonAction } from '../types.js';

const SIMULATOR_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HYDRA OLED Simulator</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #ccc;
    font-family: 'SF Mono', 'Fira Code', monospace;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 24px;
  }
  h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 4px; color: #666; }
  .oled-frame {
    background: #111;
    border: 2px solid #222;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 0 40px rgba(180, 220, 255, 0.03), inset 0 0 20px rgba(0,0,0,0.5);
  }
  canvas {
    image-rendering: pixelated;
    display: block;
    border: 1px solid #1a1a1a;
  }
  .controls {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .phys-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 35%, #333, #1a1a1a 60%, #111);
    border: 2px solid #444;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
    transition: box-shadow 0.1s, transform 0.1s, border-color 0.15s;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #666;
  }
  .phys-btn:hover { border-color: #00D1FF; color: #00D1FF; }
  .phys-btn.pressed {
    transform: scale(0.93);
    box-shadow: 0 1px 4px rgba(0,0,0,0.8), inset 0 2px 4px rgba(0,0,0,0.4);
    border-color: #00D1FF;
  }
  .btn-group {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .btn-label {
    font-size: 9px;
    color: #444;
    text-transform: uppercase;
    letter-spacing: 2px;
    text-align: center;
    margin-top: 6px;
  }
  button {
    background: #1a1a1a;
    color: #aaa;
    border: 1px solid #333;
    border-radius: 6px;
    padding: 10px 20px;
    font-family: inherit;
    font-size: 12px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 2px;
    transition: all 0.15s;
  }
  button:hover { background: #252525; color: #fff; border-color: #00D1FF; }
  button:active { background: #00D1FF; color: #000; }
  button.zone-btn { font-size: 10px; padding: 6px 12px; }
  .status { font-size: 11px; color: #444; }
  .section-label { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 3px; margin-top: 8px; }
</style>
</head>
<body>
  <h1>HYDRA OLED Simulator</h1>
  <div class="oled-frame">
    <canvas id="oled" width="512" height="256"></canvas>
  </div>
  <div class="btn-group">
    <div>
      <div class="phys-btn" id="btn-up">&#9650;</div>
      <div class="btn-label">Up</div>
    </div>
    <div>
      <div class="phys-btn" id="btn-confirm">OK</div>
      <div class="btn-label">OK</div>
    </div>
    <div>
      <div class="phys-btn" id="btn-down">&#9660;</div>
      <div class="btn-label">Down</div>
    </div>
  </div>
  <div class="section-label">Zone Toggles</div>
  <div class="controls" id="zone-btns"></div>
  <div class="status" id="status">Connecting...</div>
<script>
const canvas = document.getElementById('oled');
const ctx = canvas.getContext('2d');
const W = 128, H = 64, SCALE = 4;
const PIXEL_COLOR = '#B4DCFF';

let ws;
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(proto + '://' + location.host + '/oled/ws');
  ws.binaryType = 'arraybuffer';
  ws.onopen = () => {
    document.getElementById('status').textContent = 'Connected';
  };
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      renderFrame(new Uint8Array(e.data));
    } else {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'zones') {
          renderZoneButtons(msg.data);
        }
      } catch {}
    }
  };
  ws.onclose = () => {
    document.getElementById('status').textContent = 'Disconnected — reconnecting...';
    setTimeout(connect, 2000);
  };
}

function renderFrame(pixels) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = PIXEL_COLOR;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (pixels[y * W + x]) {
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }
  }
}

function renderZoneButtons(zones) {
  const container = document.getElementById('zone-btns');
  container.innerHTML = '';
  for (const z of zones) {
    const btn = document.createElement('button');
    btn.className = 'zone-btn';
    btn.textContent = 'Z' + z.id + (z.active ? ' ON' : ' OFF');
    btn.style.borderColor = z.active ? '#00D1FF' : '#333';
    btn.onclick = () => send('zone-toggle', z.id);
    container.appendChild(btn);
  }
}

function send(action, zoneId) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'button', action, zoneId }));
  }
}

connect();

// ── 3-Button Controls ──────────────────────────────
function wireButton(id, action) {
  const el = document.getElementById(id);
  function press() { el.classList.add('pressed'); send(action); }
  function release() { el.classList.remove('pressed'); }
  el.addEventListener('mousedown', (e) => { e.preventDefault(); press(); });
  el.addEventListener('mouseup', release);
  el.addEventListener('mouseleave', release);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); press(); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); release(); });
  el.addEventListener('touchcancel', release);
}

wireButton('btn-up', 'up');
wireButton('btn-down', 'down');
wireButton('btn-confirm', 'confirm');

// Keyboard: Arrow Up/Down + Enter
document.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'ArrowUp') send('up');
  else if (e.key === 'ArrowDown') send('down');
  else if (e.key === 'Enter') send('confirm');
});
</script>
</body>
</html>`;

export class SimulatorDriver extends EventEmitter implements OledDriver {
  private clients = new Set<WebSocket>();
  private displayEnabled = true;
  private fastify: FastifyInstance;
  private zoneData: Array<{ id: number; active: boolean }> = [];

  constructor(fastify: FastifyInstance) {
    super();
    this.fastify = fastify;
  }

  async init(): Promise<void> {
    const app = this.fastify;

    // Serve simulator HTML
    app.get('/oled', async (_req, reply) => {
      return reply.type('text/html').send(SIMULATOR_HTML);
    });

    // WebSocket for live pixel data + button input
    app.get('/oled/ws', { websocket: true }, (socket) => {
      this.clients.add(socket);
      console.log(`[OLED:SIM] Client connected (${this.clients.size})`);

      // Send current zone data
      if (this.zoneData.length > 0) {
        socket.send(JSON.stringify({ type: 'zones', data: this.zoneData }));
      }

      socket.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'button') {
            if (msg.action === 'zone-toggle' && msg.zoneId) {
              this.emit('zone-toggle', msg.zoneId);
            } else {
              this.emit('button', msg.action as ButtonAction);
            }
          }
        } catch {
          // ignore malformed messages
        }
      });

      socket.on('close', () => {
        this.clients.delete(socket);
        console.log(`[OLED:SIM] Client disconnected (${this.clients.size})`);
      });
    });

    console.log('[OLED:SIM] Simulator plugin registered at /oled');
  }

  writeBuffer(buffer: Uint8Array): void {
    if (!this.displayEnabled) return;

    // Convert SSD1306 page format back to raw pixels for the canvas
    const pixels = new Uint8Array(128 * 64);
    for (let page = 0; page < 8; page++) {
      for (let col = 0; col < 128; col++) {
        const byte = buffer[page * 128 + col];
        for (let bit = 0; bit < 8; bit++) {
          if (byte & (1 << bit)) {
            pixels[(page * 8 + bit) * 128 + col] = 1;
          }
        }
      }
    }

    const payload = Buffer.from(pixels);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  displayOn(): void {
    this.displayEnabled = true;
  }

  displayOff(): void {
    this.displayEnabled = false;
    // Send blank frame
    const blank = new Uint8Array(128 * 64);
    const payload = Buffer.from(blank);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  setContrast(_value: number): void {
    // No-op for simulator
  }

  close(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    console.log('[OLED:SIM] Simulator closed');
  }

  /** Send zone state to connected simulator clients */
  updateZones(zones: Array<{ id: number; active: boolean }>): void {
    this.zoneData = zones;
    const payload = JSON.stringify({ type: 'zones', data: zones });
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }
}

export default async function simulatorPlugin(fastify: FastifyInstance) {
  // This is registered as a Fastify plugin — the SimulatorDriver class
  // manages its own route registration in init()
}
