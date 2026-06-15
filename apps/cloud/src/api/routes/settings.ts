import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';

interface JwtPayload {
  sub: number;
  username: string;
}

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  // List all backup keys with timestamps
  app.get('/api/data', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const db = getDb();
    const { sub: userId } = req.user as JwtPayload;
    const result = await db.execute({
      sql: 'SELECT key, updated_at FROM data WHERE user_id = ? ORDER BY key',
      args: [userId],
    });
    return result.rows.map((r) => ({ key: r.key, updatedAt: r.updated_at }));
  });

  // Get one backup key
  app.get<{ Params: { key: string } }>('/api/data/:key', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const db = getDb();
    const { sub: userId } = req.user as JwtPayload;
    const result = await db.execute({
      sql: 'SELECT value, updated_at FROM data WHERE user_id = ? AND key = ?',
      args: [userId, req.params.key],
    });
    if (result.rows.length === 0) return reply.status(404).send({ error: 'Not found' });
    return {
      key: req.params.key,
      data: JSON.parse(result.rows[0].value as string),
      updatedAt: result.rows[0].updated_at,
    };
  });

  // Save one backup key
  app.put<{ Params: { key: string }; Body: { data: unknown } }>('/api/data/:key', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['data'],
        properties: { data: {} },
      },
    },
  }, async (req, reply) => {
    const db = getDb();
    const { sub: userId } = req.user as JwtPayload;
    await db.execute({
      sql: `INSERT INTO data (user_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      args: [userId, req.params.key, JSON.stringify(req.body.data)],
    });
    return reply.status(204).send();
  });
}
