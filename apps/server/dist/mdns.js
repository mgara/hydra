import { Bonjour } from 'bonjour-service';
import os from 'node:os';
let instance = null;
export function startMdns(port) {
    instance = new Bonjour();
    instance.publish({
        name: `hydra-${os.hostname()}`,
        type: 'hydra',
        port,
        txt: { version: '3.0.0' },
    });
    console.log(`[MDNS] Advertising _hydra._tcp on port ${port}`);
}
export function stopMdns() {
    if (instance) {
        instance.unpublishAll();
        instance.destroy();
        instance = null;
        console.log('[MDNS] Stopped');
    }
}
//# sourceMappingURL=mdns.js.map