import Zeroconf from 'react-native-zeroconf';

const zeroconf = new Zeroconf();

export interface HydraService {
  name: string;
  host: string;
  ip: string;
  port: number;
}

/**
 * Scan for _hydra._tcp services on the local network.
 * Resolves with the first service found, or rejects after timeoutMs.
 */
export function discoverHydra(timeoutMs = 5000): Promise<HydraService> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      zeroconf.stop();
      zeroconf.removeAllListeners();
      reject(new Error('No Hydra server found'));
    }, timeoutMs);

    zeroconf.on('resolved', (service: any) => {
      clearTimeout(timer);
      zeroconf.stop();
      zeroconf.removeAllListeners();
      const ip = service.addresses?.find((a: string) => a.includes('.'));
      resolve({
        name: service.name,
        host: service.host,
        ip: ip ?? service.host,
        port: service.port,
      });
    });

    zeroconf.on('error', (err: any) => {
      clearTimeout(timer);
      zeroconf.stop();
      zeroconf.removeAllListeners();
      reject(err);
    });

    zeroconf.scan('hydra', 'tcp', 'local.');
  });
}

export function stopDiscovery(): void {
  try {
    zeroconf.stop();
    zeroconf.removeAllListeners();
  } catch { /* ignore */ }
}
