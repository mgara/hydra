import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';

interface JwtPayload {
  sub: number;
  username: string;
}

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/data', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const sql = getDb();
    const { sub: userId } = req.user as JwtPayload;
    const rows = await sql`SELECT key, updated_at FROM data WHERE user_id = ${userId} ORDER BY key`;
    return rows.map((r) => ({ key: r.key, updatedAt: r.updated_at }));
  });

  app.get<{ Params: { key: string } }>('/api/data/:key', {
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const sql = getDb();
    const { sub: userId } = req.user as JwtPayload;
    const [row] = await sql`
      SELECT value, updated_at FROM data WHERE user_id = ${userId} AND key = ${req.params.key}
    `;
    if (!row) return reply.status(404).send({ error: 'Not found' });
    return { key: req.params.key, data: row.value, updatedAt: row.updated_at };
  });

  app.put<{ Params: { key: string }; Body: { data: unknown } }>('/api/data/:key', {
    preHandler: [app.authenticate],
    schema: {
      body: { type: 'object', required: ['data'], properties: { data: {} } },
    },
  }, async (req, reply) => {
    const sql = getDb();
    const { sub: userId } = req.user as JwtPayload;
    const jsonValue = JSON.stringify(req.body.data);
    await sql`
      INSERT INTO data (user_id, key, value)
      VALUES (${userId}, ${req.params.key}, ${jsonValue}::jsonb)
      ON CONFLICT (user_id, key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return reply.status(204).send();
  });
}
