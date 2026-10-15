import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import app from '../../app';
import { createHealthRouter } from './health.routes';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

const appWithHealthRepository = (checkDatabase: () => Promise<{ connected: boolean; message: string }>, timeoutMs = 5_000) => {
  const healthService = new HealthService({ checkDatabase } as unknown as HealthRepository, timeoutMs);
  const testApp = express();
  testApp.use('/api', createHealthRouter(healthService));
  return testApp;
};

describe('GET /api/health', () => {
  it('should return 200 OK with success response', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Hotel Booking API is running');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'ok');
  });

  it('should return 200 OK for root GET /health (cloud hosting probe)', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Hotel Booking API is running');
    expect(res.body.data).toHaveProperty('status', 'ok');
  });

  it('should return 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/unknown-endpoint-404');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.message).toContain('Route not found');
  });

  it('readiness returns 200 when the database is connected', async () => {
    const readinessApp = appWithHealthRepository(async () => ({ connected: true, message: 'Database connected' }));
    const res = await request(readinessApp).get('/api/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database.status).toBe('connected');
  });

  it('readiness returns 503 when the database is disconnected', async () => {
    const readinessApp = appWithHealthRepository(async () => ({ connected: false, message: 'Database unavailable' }));
    const res = await request(readinessApp).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.details.database.status).toBe('disconnected');
  });

  it('readiness returns 503 on a database probe timeout', async () => {
    const readinessApp = appWithHealthRepository(() => new Promise<{ connected: boolean; message: string }>(() => undefined), 5);
    const res = await request(readinessApp).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.details.database.details).toBe('Database unavailable');
  });

  it('readiness returns 503 on an exception without exposing connection details', async () => {
    const readinessApp = appWithHealthRepository(async () => {
      throw new Error('login=private;password=secret;server=internal');
    });
    const res = await request(readinessApp).get('/api/health/ready');

    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('private');
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(JSON.stringify(res.body)).not.toContain('internal');
  });

  it('liveness stays healthy without querying the database', async () => {
    let databaseChecks = 0;
    const liveApp = appWithHealthRepository(async () => {
      databaseChecks += 1;
      return { connected: false, message: 'Database unavailable' };
    });
    const res = await request(liveApp).get('/api/health/live');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.database.status).toBe('not_checked');
    expect(databaseChecks).toBe(0);
  });

  it('legacy ?db=true now uses readiness status while the bare endpoint remains liveness', async () => {
    const readinessApp = appWithHealthRepository(async () => ({ connected: false, message: 'Database unavailable' }));

    expect((await request(readinessApp).get('/api/health?db=true')).status).toBe(503);
    expect((await request(readinessApp).get('/api/health')).status).toBe(200);
  });

  it('should serve openapi specification', async () => {
    const res = await request(app).get('/api/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('openapi', '3.0.3');
    expect(res.body.info).toHaveProperty('title', 'Hotel Booking Platform API');
  });
});
