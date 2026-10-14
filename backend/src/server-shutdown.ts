import type { Server } from 'node:http';

export const SHUTDOWN_TIMEOUT_MS = 20_000;

/** Stop accepting traffic, drain in-flight requests, and then release the Prisma pool. */
export const createGracefulShutdown = (
  server: Server,
  disconnect: () => Promise<void>,
  logger: Pick<Console, 'log' | 'error'> = console,
  timeoutMs = SHUTDOWN_TIMEOUT_MS
) => {
  let started = false;
  let forceCloseTimer: ReturnType<typeof setTimeout> | undefined;

  return (signal: NodeJS.Signals): void => {
    if (started) {
      // A repeated termination signal indicates the operator/platform is no longer waiting for the drain.
      server.closeAllConnections();
      return;
    }
    started = true;
    logger.log(`${signal} received; draining HTTP requests before closing the database pool`);

    forceCloseTimer = setTimeout(() => {
      logger.error('HTTP drain exceeded the shutdown deadline; closing remaining connections');
      server.closeAllConnections();
    }, timeoutMs);
    forceCloseTimer.unref();

    server.close((error) => {
      if (forceCloseTimer) clearTimeout(forceCloseTimer);
      if (error) logger.error('HTTP server shutdown reported an error', { name: error.name });

      void disconnect()
        .then(() => logger.log('HTTP server and Prisma pool closed'))
        .catch((disconnectError: unknown) => {
          logger.error('Prisma pool shutdown failed', {
            errorType: disconnectError instanceof Error ? disconnectError.name : 'UnknownError',
          });
          process.exitCode = 1;
        });
    });

    server.closeIdleConnections();
  };
};
