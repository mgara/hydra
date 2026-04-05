import type { FastifyInstance } from 'fastify';
import type { GpioController } from '../../gpio/controller.js';
import type { FlowMonitor } from '../../flow/monitor.js';
import { IS_PRODUCTION } from '../../config.js';
import * as db from '../../db/queries.js';

export function registerFlowRoutes(
  app: FastifyInstance,
  flowMonitor: FlowMonitor,
  gpio: GpioController,
): void {

  // GET /api/flow/current — live snapshot
  app.get('/api/flow/current', async () => {
    const settings = flowMonitor.getSettings();
    return {
      gpm: Math.round(gpio.getFlowGpm() * 100) / 100,
      totalPulses: gpio.getFlowPulseCount(),
      monitoringEnabled: settings.flowMonitoringEnabled,
      safetyEnabled: settings.flowSafetyEnabled,
    };
  });

  // GET /api/flow/readings — time-series history
  app.get<{ Querystring: { since?: string; zone?: string; limit?: string } }>(
    '/api/flow/readings',
    async (req) => {
      return await db.getFlowReadings({
        since: req.query.since,
        zone: req.query.zone ? parseInt(req.query.zone, 10) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
      });
    },
  );

  // GET /api/flow/settings — flow safety settings
  app.get('/api/flow/settings', async () => {
    return await db.getFlowSettings();
  });

  // PUT /api/flow/settings — update flow safety settings
  app.put<{ Body: Record<string, string> }>('/api/flow/settings', async (req) => {
    const keyMap: Record<string, string> = {
      flowMonitoringEnabled: 'flow_monitoring_enabled',
      flowSafetyEnabled: 'flow_safety_enabled',
      flowLeakDetectDelaySeconds: 'flow_leak_detect_delay_seconds',
      flowNoFlowTimeoutSeconds: 'flow_no_flow_timeout_seconds',
      flowMaxGpm: 'flow_max_gpm',
      flowExpectedGpm: 'flow_expected_gpm',
      flowReadingIntervalSeconds: 'flow_reading_interval_seconds',
    };

    const updates: [string, string][] = [];
    for (const [camelKey, value] of Object.entries(req.body)) {
      const dbKey = keyMap[camelKey];
      if (dbKey) {
        updates.push([dbKey, String(value)]);
      }
    }

    // Write + read in a single batch
    const all = await db.setSettingsAndReadAll(updates);

    // Reload settings in the monitor
    await flowMonitor.reloadSettings();

    return {
      flowMonitoringEnabled: all.flow_monitoring_enabled !== 'false',
      flowSafetyEnabled: all.flow_safety_enabled !== 'false',
      flowLeakDetectDelaySeconds: parseInt(all.flow_leak_detect_delay_seconds || '30', 10),
      flowNoFlowTimeoutSeconds: parseInt(all.flow_no_flow_timeout_seconds || '60', 10),
      flowMaxGpm: parseFloat(all.flow_max_gpm || '15'),
      flowExpectedGpm: parseFloat(all.flow_expected_gpm || '5'),
      flowReadingIntervalSeconds: parseInt(all.flow_reading_interval_seconds || '5', 10),
    };
  });

  // Dev-only simulation endpoints
  if (!IS_PRODUCTION) {
    app.post('/api/dev/simulate-leak', async () => {
      (gpio as any).simulateLeak?.(true);
      return { success: true, message: 'Leak simulation enabled' };
    });

    app.post('/api/dev/simulate-no-flow', async () => {
      (gpio as any).simulateNoFlow?.(true);
      return { success: true, message: 'No-flow simulation enabled' };
    });

    app.post('/api/dev/simulate-reset', async () => {
      (gpio as any).simulateLeak?.(false);
      (gpio as any).simulateNoFlow?.(false);
      return { success: true, message: 'Simulations reset' };
    });
  }
}
