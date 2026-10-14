import app from './app';
import { env } from './config/env';
import { disconnectPrisma } from './config/prisma';
import { createGracefulShutdown } from './server-shutdown';

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Hotel Booking API listening on port ${env.PORT}`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
});

const shutdown = createGracefulShutdown(server, disconnectPrisma);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default server;
