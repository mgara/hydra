import type { FastifyInstance } from 'fastify';
import type { SetupInput } from '../../types.js';
import { MAX_ZONES, MAX_ZONES_WITH_PER_ZONE_FLOW } from '../../config.js';
import { calculateGpioBudget } from '../../gpio/budget.js';
import * as db from '../../db/queries.js';

export function registerSetupRoutes(app: FastifyInstance, onSetupComplete?: () => Promise<void>): void {

  // GET /api/setup/status — check if setup is complete
  app.get('/api/setup/status', async () => {
    const config = await db.getSystemConfig();
    return {
      setupComplete: config?.setupComplete ?? false,
      config,
    };
  });

  // GET /api/setup/gpio-budget — preview GPIO budget for given params
  app.get<{
    Querystring: {
      zoneCount?: string;
      hasRainSensor?: string;
      perZoneFlow?: string;
    };
  }>('/api/setup/gpio-budget', async (req, reply) => {
    const zoneCount = parseInt(req.query.zoneCount || '0', 10);
    if (zoneCount < 1) {
      return reply.status(400).send({ error: 'zoneCount is required and must be >= 1' });
    }

    const input: SetupInput = {
      zoneCount,
      hasRainSensor: req.query.hasRainSensor === 'true',
      perZoneFlow: req.query.perZoneFlow === 'true',
    };

    const budget = calculateGpioBudget(input);
    return budget;
  });

  // POST /api/setup/reset — clear config and re-enter setup mode
  app.post('/api/setup/reset', async (_req, reply) => {
    await db.resetSetup();

    // Schedule transition to setup mode after response is sent
    // Import dynamically to avoid circular dependency
    setImmediate(async () => {
      try {
        const { transitionToSetup } = await import('../../index.js');
        await transitionToSetup();
      } catch (err) {
        console.error('[SETUP] Reset transition failed:', err);
      }
    });

    return reply.send({ success: true, message: 'Setup reset. Server is transitioning to setup mode.' });
  });

  // POST /api/setup — execute setup wizard
  app.post<{ Body: SetupInput }>('/api/setup', async (req, reply) => {
    // Check if already configured
    const existing = await db.getSystemConfig();
    if (existing?.setupComplete) {
      return reply.status(409).send({ error: 'Setup already complete. Reset first via POST /api/setup/reset.' });
    }

    const { zoneCount, hasRainSensor, hasScreen, moistureSensorCount, perZoneFlow } = req.body;

    // Validate zone count
    const maxZones = perZoneFlow ? MAX_ZONES_WITH_PER_ZONE_FLOW : MAX_ZONES;
    if (!zoneCount || zoneCount < 1 || zoneCount > maxZones) {
      return reply.status(400).send({
        error: `zoneCount must be between 1 and ${maxZones}${perZoneFlow ? ' (limited by per-zone flow sensors)' : ''}`,
      });
    }

    // Calculate GPIO budget
    const input: SetupInput = {
      zoneCount,
      hasRainSensor: hasRainSensor ?? false,
      hasScreen: hasScreen ?? false,
      moistureSensorCount: moistureSensorCount ?? 0,
      perZoneFlow: perZoneFlow ?? false,
    };

    const budget = calculateGpioBudget(input);
    if (!budget.valid) {
      return reply.status(400).send({
        error: `GPIO budget exceeded: ${budget.totalRequired} pins required, ${budget.totalAvailable} available`,
        budget,
      });
    }

    // Execute setup
    await db.executeSetup(input, budget.assignments);

    // Load the config we just wrote
    const config = await db.getSystemConfig();
    const assignments = await db.getGpioAssignments();

    // Schedule transition to operational mode after response is sent
    if (onSetupComplete) {
      setImmediate(() => {
        onSetupComplete().catch(err => console.error('[SETUP] Transition failed:', err));
      });
    }

    return reply.status(201).send({
      config,
      assignments,
      budget,
      message: 'Setup complete. Server is transitioning to operational mode.',
    });
  });
}
