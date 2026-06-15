import { initDb } from './db/index.js';
import { createServer } from './api/server.js';

const PORT = Number(process.env.CLOUD_PORT ?? 4000);

await initDb();
const app = await createServer();
await app.listen({ port: PORT, host: '0.0.0.0' });
