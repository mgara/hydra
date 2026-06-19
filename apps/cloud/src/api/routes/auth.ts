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
    const sql = getDb();

    const [existing] = await sql`SELECT id FROM users WHERE username = ${username}`;
    if (existing) return reply.status(409).send({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 12);
    const rows = await sql`
      INSERT INTO users (username, password_hash) VALUES (${username}, ${hash}) RETURNING id
    `;
    const token = app.jwt.sign({ sub: rows[0].id as number, username });
    return reply.status(201).send({ token, username });
  });

  app.post<{ Body: AuthBody }>('/api/auth/login', {
    schema: { body: authBodySchema },
  }, async (req, reply) => {
    const { username, password } = req.body;
    const sql = getDb();

    const [row] = await sql`SELECT id, password_hash FROM users WHERE username = ${username}`;
    if (!row) return reply.status(401).send({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, row.password_hash as string);
    if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign({ sub: row.id as number, username });
    return { token, username };
  });
}
