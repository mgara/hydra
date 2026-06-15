import type { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';

interface JwtPayload {
  sub: number;
  username: string;
}

export async function registerSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const db = getDb();
    const { sub: userId } = req.user as JwtPayload;

    const result = await db.execute({
      sql: 'SELECT data FROM settings WHERE user_id = ?',
      args: [userId],
    });

    if (result.rows.length === 0) return { data: null };
    return { data: JSON.parse(result.rows[0].data as string) };
  });

  app.put<{ Body: { data: Record<string, unknown> } }>('/api/settings', {
    preHandler: [app.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['data'],
        properties: {
          data: { type: 'object' },
        },
      },
    },
  }, async (req, reply) => {
    const db = getDb();
    const { sub: userId } = req.user as JwtPayload;
    const data = JSON.stringify(req.body.data);

    await db.execute({
      sql: `INSERT INTO settings (user_id, data) VALUES (?, ?)
            ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = datetime('now')`,
      args: [userId, data],
    });

    return reply.status(204).send();
  });
}
