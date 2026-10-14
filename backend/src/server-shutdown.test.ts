import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createGracefulShutdown } from './server-shutdown';

const fakeServer = () => {
  let onClosed: ((error?: Error) => void) | undefined;
  const server = {
    close: vi.fn((callback: (error?: Error) => void) => { onClosed = callback; }),
    closeAllConnections: vi.fn(),
    closeIdleConnections: vi.fn(),
  } as unknown as Server;
  return { server, close: (error?: Error) => onClosed?.(error) };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('createGracefulShutdown', () => {
  it('stops new requests, drains idle connections, then disconnects Prisma once', async () => {
    const { server, close } = fakeServer();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const logger = { log: vi.fn(), error: vi.fn() };
    const shutdown = createGracefulShutdown(server, disconnect, logger);

    shutdown('SIGTERM');
    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();

    close();
    await Promise.resolve();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenLastCalledWith('HTTP server and Prisma pool closed');
  });

  it('force-closes remaining connections after the shutdown deadline', () => {
    vi.useFakeTimers();
    const { server } = fakeServer();
    const logger = { log: vi.fn(), error: vi.fn() };
    const shutdown = createGracefulShutdown(server, vi.fn().mockResolvedValue(undefined), logger, 10);

    shutdown('SIGTERM');
    vi.advanceTimersByTime(10);

    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith('HTTP drain exceeded the shutdown deadline; closing remaining connections');
  });

  it('a repeated signal closes active connections immediately without starting another disconnect', () => {
    const { server } = fakeServer();
    const disconnect = vi.fn().mockResolvedValue(undefined);
    const shutdown = createGracefulShutdown(server, disconnect, { log: vi.fn(), error: vi.fn() });

    shutdown('SIGTERM');
    shutdown('SIGINT');

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });
});
