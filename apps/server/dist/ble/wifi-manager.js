import { EventEmitter } from 'node:events';
import { execSync, exec } from 'node:child_process';
import os from 'node:os';
export class WifiManager extends EventEmitter {
    status = 0;
    getStatus() {
        return this.status;
    }
    getIpAddress() {
        const interfaces = os.networkInterfaces();
        for (const nets of Object.values(interfaces)) {
            if (!nets)
                continue;
            for (const net of nets) {
                if (net.family === 'IPv4' && !net.internal)
                    return net.address;
            }
        }
        return '';
    }
    getCurrentNetwork() {
        try {
            if (process.platform === 'linux') {
                const raw = execSync('iwgetid -r', { timeout: 3000, encoding: 'utf8' });
                return raw.trim();
            }
            else if (process.platform === 'darwin') {
                const raw = execSync('/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -I', { timeout: 3000, encoding: 'utf8' });
                const match = raw.match(/\sSSID:\s*(.+)/);
                return match?.[1]?.trim() ?? '';
            }
        }
        catch {
            // no wifi
        }
        return '';
    }
    async connect(ssid, password) {
        this.status = 1; // connecting
        this.emit('status-change', this.status);
        console.log(`[WIFI] Connecting to "${ssid}"...`);
        try {
            if (process.platform === 'linux') {
                await this.connectLinux(ssid, password);
            }
            else {
                // Dev: simulate connection delay
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log(`[WIFI] Dev mode — simulating connection to "${ssid}"`);
            }
            // Verify connection
            const ip = this.getIpAddress();
            if (ip) {
                this.status = 2; // connected
                console.log(`[WIFI] Connected to "${ssid}" — IP: ${ip}`);
            }
            else {
                this.status = 3; // failed
                console.log(`[WIFI] Failed to get IP after connecting to "${ssid}"`);
            }
        }
        catch (err) {
            const msg = err?.message || String(err);
            if (msg.includes('Secrets were required') || msg.includes('psk')) {
                this.status = 4; // wrong password
                console.log(`[WIFI] Wrong password for "${ssid}"`);
            }
            else if (msg.includes('No network')) {
                this.status = 5; // not found
                console.log(`[WIFI] Network "${ssid}" not found`);
            }
            else {
                this.status = 3; // generic failure
                console.log(`[WIFI] Connection failed: ${msg}`);
            }
        }
        this.emit('status-change', this.status);
        return this.status;
    }
    connectLinux(ssid, password) {
        return new Promise((resolve, reject) => {
            // Use nmcli (NetworkManager) — most common on modern Raspberry Pi OS
            const cmd = `nmcli device wifi connect "${ssid.replace(/"/g, '\\"')}" password "${password.replace(/"/g, '\\"')}"`;
            exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr || err.message));
                }
                else {
                    resolve();
                }
            });
        });
    }
    disconnect() {
        this.status = 0;
        this.emit('status-change', this.status);
    }
}
//# sourceMappingURL=wifi-manager.js.map