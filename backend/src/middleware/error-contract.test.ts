import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import type { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import app from '../app';
import { errorHandler } from './error.middleware';
import { createRateLimiter } from './security.middleware';
import { createTestAccount, deleteTestAccount } from '../test/factories';
import { ROLE_NAMES } from '../common/constants/roles';
import { AppError } from '../common/errors/app-error';
import { ERROR_CODES, codeForStatus } from '../common/errors/error-codes';

/**
 * Bug #11 — one error shape for the whole API:  { success:false, message, code, details? }
 *   validation → code VALIDATION_ERROR, details [{ field, message }]
 * Nothing else (`errors`, `error`, stacks, SQL, internals) is part of a response.
 */
const SHAPE_KEYS = ['success', 'message', 'code', 'details'];
const expectOnlyContractKeys = (body: object) => {
  for (const key of Object.keys(body)) expect(SHAPE_KEYS).toContain(key);
  expect((body as { success: boolean }).success).toBe(false);
  expect(typeof (body as { message: string }).message).toBe('string');
  expect(typeof (body as { code: string }).code).toBe('string');
};

afterEach(() => vi.restoreAllMocks());

describe('error contract over HTTP', () => {
  it('validation: 400, VALIDATION_ERROR, details = [{ field, message }] — and no legacy "errors" key', async () => {
    const res = await request(app).post('/api/auth/register').send({ TenDangNhap: 'a', Email: 'not-an-email', MatKhau: '1' });

    expect(res.status).toBe(400);
    expectOnlyContractKeys(res.body);
    expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.details.length).toBeGreaterThanOrEqual(3);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['TenDangNhap', 'Email', 'MatKhau']));
    for (const d of res.body.details) {
      expect(Object.keys(d).sort()).toEqual(['field', 'message']);
      expect(typeof d.message).toBe('string');
    }
  });

  it('validation of query and params uses the same shape (field = parameter name)', async () => {
    const res = await request(app).get('/api/hotels/1/reviews').query({ limit: 500 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.details).toEqual([expect.objectContaining({ field: 'limit' })]);
  });

  it('401: UNAUTHORIZED, no details', async () => {
    const res = await request(app).get('/api/profile/me');
    expect(res.status).toBe(401);
    expectOnlyContractKeys(res.body);
    expect(res.body.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(res.body.details).toBeUndefined();
  });

  it('403: FORBIDDEN', async () => {
    const customer = await createTestAccount({ role: ROLE_NAMES.CUSTOMER });
    try {
      const token = (await request(app).post('/api/auth/login').send({ identifier: customer.account.Email, MatKhau: customer.plainPassword })).body.data.accessToken;
      const res = await request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expectOnlyContractKeys(res.body);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    } finally {
      await deleteTestAccount(customer.account.MaTaiKhoan);
    }
  });

  it('404: unknown route and unknown resource both carry NOT_FOUND', async () => {
    const route = await request(app).get('/api/this-route-does-not-exist');
    expect(route.status).toBe(404);
    expectOnlyContractKeys(route.body);
    expect(route.body.code).toBe(ERROR_CODES.NOT_FOUND);

    const resource = await request(app).get('/api/hotels/999999999');
    expect(resource.status).toBe(404);
    expectOnlyContractKeys(resource.body);
    expect(resource.body.code).toBe(ERROR_CODES.NOT_FOUND);
  });

  it('malformed JSON: 400 INVALID_JSON', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"identifier": ');
    expect(res.status).toBe(400);
    expectOnlyContractKeys(res.body);
    expect(res.body.code).toBe(ERROR_CODES.INVALID_JSON);
  });

  it('oversized body: 413 PAYLOAD_TOO_LARGE', async () => {
    const res = await request(app).post('/api/auth/login').send({ identifier: 'x'.repeat(11 * 1024 * 1024), MatKhau: 'x' });
    expect(res.status).toBe(413);
    expectOnlyContractKeys(res.body);
    expect(res.body.code).toBe(ERROR_CODES.PAYLOAD_TOO_LARGE);
  });
});

describe('error handler (unit)', () => {
  const run = (error: unknown) => {
    const captured: { status?: number; body?: Record<string, unknown> } = {};
    const res = {
      status(code: number) { captured.status = code; return this; },
      json(body: Record<string, unknown>) { captured.body = body; return this; },
    } as unknown as Response;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(error as Error, {} as Request, res, () => undefined);
    return captured;
  };

  it('AppError keeps its message, status, a status-derived code, and its details when it is a client error', () => {
    const { status, body } = run(AppError.conflict('Hết phòng', [{ field: 'NgayApDung:2030-01-01', message: 'Đã có 3 phòng được đặt' }]));
    expect(status).toBe(409);
    expect(body).toEqual({ success: false, message: 'Hết phòng', code: 'CONFLICT', details: [{ field: 'NgayApDung:2030-01-01', message: 'Đã có 3 phòng được đặt' }] });
  });

  it.each([
    [AppError.badRequest('x'), 400, 'BAD_REQUEST'],
    [AppError.unauthorized('x'), 401, 'UNAUTHORIZED'],
    [AppError.forbidden('x'), 403, 'FORBIDDEN'],
    [AppError.notFound('x'), 404, 'NOT_FOUND'],
  ])('status %# maps to its code', (error, expectedStatus, expectedCode) => {
    const { status, body } = run(error);
    expect(status).toBe(expectedStatus);
    expect(body!.code).toBe(expectedCode);
    expect(body).not.toHaveProperty('details');
  });

  it('ZodError → VALIDATION_ERROR with nested paths dotted', () => {
    const parsed = z.object({ rooms: z.array(z.object({ soLuong: z.number().min(1) })) }).safeParse({ rooms: [{ soLuong: 0 }] });
    expect(parsed.success).toBe(false);
    const { status, body } = run((parsed as { error: ZodError }).error);
    expect(status).toBe(400);
    expect(body!.code).toBe('VALIDATION_ERROR');
    expect(body!.details).toEqual([{ field: 'rooms.0.soLuong', message: expect.any(String) }]);
  });

  it('an unexpected error never leaks its message, stack or type: generic message + INTERNAL_ERROR', () => {
    const leaky = new Error('connect ECONNREFUSED 10.0.0.5:1433 (password=hunter2)');
    const { status, body } = run(leaky);
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|hunter2|stack|at /);
  });

  it('a 5xx AppError hides its details and message too', () => {
    const { status, body } = run(new AppError('db exploded: SELECT * FROM TAI_KHOAN', 500, { sql: 'SELECT 1' }));
    expect(status).toBe(500);
    expect(body).toEqual({ success: false, message: 'Internal server error', code: 'INTERNAL_ERROR' });
  });

  it('codeForStatus covers the statuses the API uses', () => {
    expect([400, 401, 403, 404, 409, 413, 429, 500, 503].map(codeForStatus)).toEqual([
      'BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'PAYLOAD_TOO_LARGE', 'TOO_MANY_REQUESTS', 'INTERNAL_ERROR', 'INTERNAL_ERROR',
    ]);
  });
});

describe('rate limiter response follows the contract', () => {
  it('429 carries TOO_MANY_REQUESTS', () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyPrefix: 'contract-test' });
    const captured: { status?: number; body?: Record<string, unknown> } = {};
    const res = {
      setHeader: () => undefined,
      status(code: number) { captured.status = code; return this; },
      json(body: Record<string, unknown>) { captured.body = body; return this; },
    } as unknown as Response;
    const req = { ip: '203.0.113.9', socket: {} } as unknown as Request;
    limiter(req, res, () => undefined);
    limiter(req, res, () => undefined);
    expect(captured.status).toBe(429);
    expect(captured.body).toMatchObject({ success: false, code: 'TOO_MANY_REQUESTS' });
  });
});
