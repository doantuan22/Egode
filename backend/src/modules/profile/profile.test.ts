import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, deleteTestAccount } from '../../test/factories';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';

const createdAccountIds: number[] = [];
afterAll(async () => {
  await Promise.all(createdAccountIds.map((id) => deleteTestAccount(id)));
});

const loginAndGetToken = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ identifier: email, MatKhau: password });
  return res.body.data.accessToken as string;
};

describe('GET /api/profile/me', () => {
  it("returns the caller's own profile", async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.MaTaiKhoan).toBe(account.MaTaiKhoan);
    expect(res.body.data).not.toHaveProperty('MatKhau');
  });

  it('DDI-01 (resolved): GET /me works when NgaySinh/GioiTinh/AnhDaiDien are NULL end-to-end', async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const reg = await request(app).post('/api/auth/register').send({
      TenDangNhap: `nullprofile_${suffix}`,
      Email: `nullprofile_${suffix}@example.com`,
      MatKhau: 'Test@12345',
      HoTen: 'Null Profile Fields',
      SoDienThoai: '0900000099',
      // Cố ý bỏ NgaySinh và GioiTinh
    });
    expect(reg.status).toBe(201);
    createdAccountIds.push(reg.body.data.account.MaTaiKhoan);

    const res = await request(app)
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.NgaySinh).toBeNull();
    expect(res.body.data.GioiTinh).toBeNull();
    expect(res.body.data.AnhDaiDien).toBeNull();
  });
});

describe('PATCH /api/profile/me', () => {
  it('updates whitelisted profile fields', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app)
      .patch('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ HoTen: 'Updated Name', SoDienThoai: '0987654321', NgaySinh: '1990-01-01', GioiTinh: 'Nữ' });

    expect(res.status).toBe(200);
    expect(res.body.data.HoTen).toBe('Updated Name');
    expect(res.body.data.SoDienThoai).toBe('0987654321');
  });

  it('cannot change role or account status through the profile endpoint (mass-assignment guard)', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    const res = await request(app)
      .patch('/api/profile/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        HoTen: 'Still Me',
        MaVaiTro: 999,
        TrangThai: ACCOUNT_STATUS.LOCKED,
        NgayTao: '2000-01-01',
      });

    // Trường không được phép bị bỏ qua, không bị áp dụng
    expect(res.status).toBe(200);
    expect(res.body.data.MaVaiTro).toBe(account.MaVaiTro);
    expect(res.body.data.TrangThai).toBe(account.TrangThai);

    const stillWorks = await loginAndGetToken(account.Email, plainPassword);
    expect(stillWorks).toBeTypeOf('string');
  });

  it('rejects an unauthenticated update', async () => {
    const res = await request(app).patch('/api/profile/me').send({ HoTen: 'Nobody' });
    expect(res.status).toBe(401);
  });

  it('DDI-01 (resolved): PATCH /me can fill in NgaySinh/GioiTinh later for an account that registered without them', async () => {
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const reg = await request(app).post('/api/auth/register').send({
      TenDangNhap: `fillinlater_${suffix}`,
      Email: `fillinlater_${suffix}@example.com`,
      MatKhau: 'Test@12345',
      HoTen: 'Fill In Later',
      SoDienThoai: '0900000098',
    });
    expect(reg.status).toBe(201);
    createdAccountIds.push(reg.body.data.account.MaTaiKhoan);

    const res = await request(app)
      .patch('/api/profile/me')
      .set('Authorization', `Bearer ${reg.body.data.accessToken}`)
      .send({ HoTen: 'Fill In Later', SoDienThoai: '0900000098', NgaySinh: '1992-08-08', GioiTinh: 'Khác' });

    expect(res.status).toBe(200);
    expect(res.body.data.NgaySinh).toContain('1992-08-08');
    expect(res.body.data.GioiTinh).toBe('Khác');
  });
});

describe('SoDienThoai validation is the same for register and PATCH /api/profile/me (BUG-009)', () => {
  const VALID: Array<[string, string]> = [
    ['0901234567', '0901234567'],
    ['+84901234567', '+84901234567'],
    [' 0901234567 ', '0901234567'],
    ['12345678', '12345678'],
    ['123456789012345', '123456789012345'],
  ];
  const INVALID = [
    'abcdefgh',
    'not-a-phone-number',
    '09012abc567',
    '1234567',
    '1234567890123456',
    '+' + '1'.repeat(16),
    '090 123 4567',
    '++84901234567',
    '84+901234567',
    '',
    '   ',
  ];

  const patchPhone = async (token: string, SoDienThoai: unknown) =>
    request(app).patch('/api/profile/me').set('Authorization', `Bearer ${token}`).send({ SoDienThoai });

  it('accepts valid numbers on update (trimmed) and persists them', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);

    for (const [input, stored] of VALID) {
      const res = await patchPhone(token, input);
      expect(res.status, JSON.stringify(input)).toBe(200);
      expect(res.body.data.SoDienThoai, JSON.stringify(input)).toBe(stored);
    }
  });

  it('rejects invalid numbers on update with 400 and leaves the stored number untouched', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);
    const before = (await request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`)).body.data.SoDienThoai;

    for (const input of INVALID) {
      const res = await patchPhone(token, input);
      expect(res.status, JSON.stringify(input)).toBe(400);
    }
    const after = (await request(app).get('/api/profile/me').set('Authorization', `Bearer ${token}`)).body.data.SoDienThoai;
    expect(after).toBe(before);
  });

  it('a non-string SoDienThoai is rejected on update', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);
    expect((await patchPhone(token, 901234567)).status).toBe(400);
  });

  it('omitting SoDienThoai on update is still fine (partial update)', async () => {
    const { account, plainPassword } = await createTestAccount();
    createdAccountIds.push(account.MaTaiKhoan);
    const token = await loginAndGetToken(account.Email, plainPassword);
    const res = await request(app).patch('/api/profile/me').set('Authorization', `Bearer ${token}`).send({ HoTen: 'Only Name Changes' });
    expect(res.status).toBe(200);
  });

  it('registration applies the exact same rule (valid trimmed, invalid 400)', async () => {
    const register = (SoDienThoai: string) => {
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      return request(app).post('/api/auth/register').send({
        TenDangNhap: `phone_${suffix}`,
        Email: `phone_${suffix}@example.com`,
        MatKhau: 'Test@12345',
        HoTen: 'Phone Rule',
        SoDienThoai,
      });
    };

    for (const [input, stored] of VALID) {
      const res = await register(input);
      expect(res.status, JSON.stringify(input)).toBe(201);
      expect(res.body.data.account.SoDienThoai, JSON.stringify(input)).toBe(stored);
      createdAccountIds.push(res.body.data.account.MaTaiKhoan);
    }
    for (const input of INVALID) {
      expect((await register(input)).status, JSON.stringify(input)).toBe(400);
    }
  });
});
