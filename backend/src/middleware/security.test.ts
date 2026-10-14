import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../app';
import { AppError } from '../common/errors/app-error';
import { env } from '../config/env';
import { errorHandler } from './error.middleware';
import { createRateLimiter } from './security.middleware';

describe('HTTP hardening middleware', () => {
  it('sets defensive headers and hides Express fingerprinting', async () => {
    const response = await request(app).get('/api/definitely-missing');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('only emits CORS credentials for an allowlisted origin', async () => {
    const allowed = env.CORS_ORIGIN.split(',')[0].trim();
    const approved = await request(app).get('/api/health').set('Origin', allowed);
    const denied = await request(app).get('/api/health').set('Origin', 'https://evil.invalid');
    expect(approved.headers['access-control-allow-origin']).toBe(allowed);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns a safe message for malformed JSON', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"identifier":');
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('JSON không hợp lệ');
  });

  it('does not leak internal operational error messages', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const localApp = express();
    localApp.get('/fail', (_req, _res, next) => next(AppError.internal('database secret detail')));
    localApp.use(errorHandler);
    const response = await request(localApp).get('/fail');
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Internal server error');
    expect(JSON.stringify(response.body)).not.toContain('database secret detail');
    consoleSpy.mockRestore();
  });

  it('production logs error metadata without the raw message or stack', async () => {
    const originalEnvironment = env.NODE_ENV;
    env.NODE_ENV = 'production';
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const localApp = express();
      localApp.get('/fail', (_req, _res, next) => next(new Error('password=do-not-log;server=internal')));
      localApp.use(errorHandler);

      const response = await request(localApp).get('/fail');
      expect(response.status).toBe(500);
      expect(consoleSpy).toHaveBeenCalledWith('Unhandled server error:', { name: 'Error' });
      expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('do-not-log');
      expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain('internal');
    } finally {
      env.NODE_ENV = originalEnvironment;
      consoleSpy.mockRestore();
    }
  });

  it('rate limits repeated requests and returns Retry-After', async () => {
    const localApp = express();
    localApp.get('/limited', createRateLimiter({ windowMs: 60_000, max: 2, keyPrefix: 'test' }), (_req, res) => res.json({ ok: true }));
    expect((await request(localApp).get('/limited')).status).toBe(200);
    expect((await request(localApp).get('/limited')).status).toBe(200);
    const blocked = await request(localApp).get('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
