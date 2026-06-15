import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { getDb } from '../../db/index.js';

interface AuthBody {
  username: string;
  password: string;
}

const authBodySchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: { type: 'string', minLength: 3, maxLength: 50 },
    password: { type: 'string', minLength: 8 },
  },
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: AuthBody }>('/api/auth/register', {
    schema: { body: authBodySchema },
  }, async (req, reply) => {
    const { username, password } = req.body;
    const db = getDb();

    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE username = ?',
      args: [username],
    });
    if (existing.rows.length > 0) {
      return reply.status(409).send({ error: 'Username already taken' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await db.execute({
      sql: 'INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id',
      args: [username, hash],
    });

    const userId = Number(result.rows[0].id);
    const token = app.jwt.sign({ sub: userId, username });
    return reply.status(201).send({ token, username });
  });

  app.post<{ Body: AuthBody }>('/api/auth/login', {
    schema: { body: authBodySchema },
  }, async (req, reply) => {
    const { username, password } = req.body;
    const db = getDb();

    const result = await db.execute({
      sql: 'SELECT id, password_hash FROM users WHERE username = ?',
      args: [username],
    });
    if (result.rows.length === 0) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const row = result.rows[0];
    const valid = await bcrypt.compare(password, row.password_hash as string);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = app.jwt.sign({ sub: Number(row.id), username });
    return { token, username };
  });
}
