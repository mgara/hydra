import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { registerAuthRoutes } from './routes/auth.js';
import { registerSettingsRoutes } from './routes/settings.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; username: string };
    user: { sub: number; username: string };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function createServer(): Promise<ReturnType<typeof Fastify>> {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is required');

  const app = Fastify({
    logger: process.env.NODE_ENV !== 'production'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  await registerAuthRoutes(app);
  await registerSettingsRoutes(app);

  return app;
}
