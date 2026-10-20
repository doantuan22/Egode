import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../app';

describe('GET /api/cancellation-policies', () => {
  it('lists active cancellation policies with their tiers, publicly', async () => {
    const res = await request(app).get('/api/cancellation-policies');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      expect(res.body.data[0]).toHaveProperty('MaChinhSachHuy');
      expect(res.body.data[0]).toHaveProperty('CHI_TIET_CHINH_SACH_HUY');
      // Chính sách cấp hệ thống, không gắn đơn hay khách sạn
      expect(res.body.data[0]).not.toHaveProperty('MaDatPhong');
      expect(res.body.data[0]).not.toHaveProperty('MaKhachSan');
    }
  });
});

describe('GET /api/cancellation-policies/:id', () => {
  it('returns 404 for a non-existent policy', async () => {
    const res = await request(app).get('/api/cancellation-policies/999999999');
    expect(res.status).toBe(404);
  });
});
