import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { createTestAccount, getRoleId } from '../../test/factories';
import { getPrismaClient } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { ROLE_NAMES } from '../../common/constants/roles';
import { ACCOUNT_STATUS } from '../../common/constants/account-status';
import { AccountsService } from './accounts.service';
import { AccountsRepository } from './accounts.repository';

/**
 * Bug #7 — an administrator may not lock, delete or demote themselves, and the system must always keep one
 * active administrator, even when two administrators act at the same moment.
 *
 * The shared test database also holds the real seeded administrators, so "the last admin" cannot be produced
 * there. The service tests therefore use a repository that counts "other active admins" inside a small set of
 * test accounts only; everything else (the locking, the transaction, the checks, the writes) is the real code.
 */
const ids: number[] = [];
const prisma = () => getPrismaClient();

const makeAccount = async (role: (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES] = ROLE_NAMES.ADMIN) => {
  const created = await createTestAccount({ role });
  ids.push(created.account.MaTaiKhoan);
  const token = (await request(app).post('/api/auth/login').send({ identifier: created.account.Email, MatKhau: created.plainPassword })).body.data.accessToken as string;
  return { id: created.account.MaTaiKhoan, token };
};
const row = (id: number) => prisma().tAI_KHOAN.findUnique({ where: { MaTaiKhoan: id } });
const as = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Repository whose "other active admins" are only the given test accounts. */
class ScopedAccountsRepository extends AccountsRepository {
  constructor(private readonly universe: number[]) {
    super();
  }
  override async countActiveAdministratorsExcept(tx: Prisma.TransactionClient, adminRoleId: number, exceptMaTaiKhoan: number, activeStatus: string) {
    return tx.tAI_KHOAN.count({
      where: { MaVaiTro: adminRoleId, TrangThai: activeStatus, MaTaiKhoan: { in: this.universe, not: exceptMaTaiKhoan } },
    });
  }
}
const serviceFor = (universe: number[]) => new AccountsService(new ScopedAccountsRepository(universe));

afterAll(async () => {
  await prisma().tAI_KHOAN.deleteMany({ where: { MaTaiKhoan: { in: ids } } });
});

describe('an administrator cannot take admin powers from themselves (HTTP)', () => {
  it('cannot lock themselves: 400, still active, token still works', async () => {
    const admin = await makeAccount();
    const res = await request(app).post(`/api/admin/accounts/${admin.id}/lock`).set(as(admin.token));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/tự khóa/);
    expect((await row(admin.id))!.TrangThai).toBe(ACCOUNT_STATUS.ACTIVE);
    expect((await request(app).get('/api/admin/accounts').set(as(admin.token))).status).toBe(200);
  });

  it('cannot delete themselves: 400, the account still exists', async () => {
    const admin = await makeAccount();
    const res = await request(app).delete(`/api/admin/accounts/${admin.id}`).set(as(admin.token));
    expect(res.status).toBe(400);
    expect(await row(admin.id)).not.toBeNull();
  });

  it('cannot demote themselves: 400, the role is unchanged', async () => {
    const admin = await makeAccount();
    const before = (await row(admin.id))!.MaVaiTro;
    const res = await request(app).patch(`/api/admin/accounts/${admin.id}`).set(as(admin.token)).send({ MaVaiTro: await getRoleId(ROLE_NAMES.CUSTOMER) });
    expect(res.status).toBe(400);
    expect((await row(admin.id))!.MaVaiTro).toBe(before);
  });

  it('can still edit their own profile fields and "change" their role to the one they already have', async () => {
    const admin = await makeAccount();
    const ok = await request(app).patch(`/api/admin/accounts/${admin.id}`).set(as(admin.token)).send({ HoTen: 'Renamed Admin', MaVaiTro: await getRoleId(ROLE_NAMES.ADMIN) });
    expect(ok.status).toBe(200);
    expect((await row(admin.id))!.HoTen).toBe('Renamed Admin');
  });

  it('can lock, demote and delete OTHER accounts while other admins remain', async () => {
    const actor = await makeAccount();
    const lockMe = await makeAccount();
    const demoteMe = await makeAccount();
    const deleteMe = await makeAccount();
    const customer = await makeAccount(ROLE_NAMES.CUSTOMER);

    expect((await request(app).post(`/api/admin/accounts/${lockMe.id}/lock`).set(as(actor.token))).status).toBe(200);
    expect((await request(app).patch(`/api/admin/accounts/${demoteMe.id}`).set(as(actor.token)).send({ MaVaiTro: await getRoleId(ROLE_NAMES.CUSTOMER) })).status).toBe(200);
    expect((await request(app).delete(`/api/admin/accounts/${deleteMe.id}`).set(as(actor.token))).status).toBe(200);
    expect((await request(app).post(`/api/admin/accounts/${customer.id}/lock`).set(as(actor.token))).status).toBe(200);
    expect((await row(lockMe.id))!.TrangThai).toBe(ACCOUNT_STATUS.LOCKED);
    expect((await row(demoteMe.id))!.MaVaiTro).toBe(await getRoleId(ROLE_NAMES.CUSTOMER));
    expect(await row(deleteMe.id)).toBeNull();
  });
});

describe('the last active administrator cannot be removed (service, scoped to test admins)', () => {
  it('lock / delete / demote of the only active admin are all refused with 409 and change nothing', async () => {
    const [only, actor] = [await makeAccount(), await makeAccount()];
    const service = serviceFor([only.id]);
    const customerRole = await getRoleId(ROLE_NAMES.CUSTOMER);

    await expect(service.lock(only.id, actor.id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.safeDelete(only.id, actor.id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.update(only.id, actor.id, { MaVaiTro: customerRole })).rejects.toMatchObject({ statusCode: 409 });

    const after = (await row(only.id))!;
    expect(after.TrangThai).toBe(ACCOUNT_STATUS.ACTIVE);
    expect(after.MaVaiTro).toBe(await getRoleId(ROLE_NAMES.ADMIN));
  });

  it('with two admins, one can go; the other then becomes the last and is protected', async () => {
    const [a, b, actor] = [await makeAccount(), await makeAccount(), await makeAccount()];
    const service = serviceFor([a.id, b.id]);

    await expect(service.lock(a.id, actor.id)).resolves.toMatchObject({ TrangThai: ACCOUNT_STATUS.LOCKED });
    await expect(service.lock(b.id, actor.id)).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.safeDelete(b.id, actor.id)).rejects.toMatchObject({ statusCode: 409 });
    expect((await row(b.id))!.TrangThai).toBe(ACCOUNT_STATUS.ACTIVE);
  });

  it('an admin that is already locked does not count as an administrator that is left', async () => {
    const [a, b, actor] = [await makeAccount(), await makeAccount(), await makeAccount()];
    await prisma().tAI_KHOAN.update({ where: { MaTaiKhoan: b.id }, data: { TrangThai: ACCOUNT_STATUS.LOCKED } });
    await expect(serviceFor([a.id, b.id]).lock(a.id, actor.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('removing a non-admin never touches the admin rule', async () => {
    const [only, actor, customer] = [await makeAccount(), await makeAccount(), await makeAccount(ROLE_NAMES.CUSTOMER)];
    await expect(serviceFor([only.id]).lock(customer.id, actor.id)).resolves.toMatchObject({ TrangThai: ACCOUNT_STATUS.LOCKED });
  });
});

describe('two administrators acting at the same time cannot remove the last admins together', () => {
  const rounds: Array<[string, (s: AccountsService, target: number, actor: number) => Promise<unknown>]> = [
    ['lock', (s, t, a) => s.lock(t, a)],
    ['delete', (s, t, a) => s.safeDelete(t, a)],
  ];

  it.each(rounds)('two admins (A, B) each %s the other at once: exactly one succeeds, one admin survives', async (_name, act) => {
    for (let round = 0; round < 3; round++) {
      const [a, b] = [await makeAccount(), await makeAccount()];
      const service = serviceFor([a.id, b.id]);

      const results = await Promise.allSettled([act(service, a.id, b.id), act(service, b.id, a.id)]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')!;
      expect(failed.reason.statusCode).toBe(409);
      const survivors = (await Promise.all([row(a.id), row(b.id)])).filter((r) => r && r.TrangThai === ACCOUNT_STATUS.ACTIVE);
      expect(survivors).toHaveLength(1);
    }
  });

  it('a lock and a demote of the two remaining admins at once: exactly one succeeds', async () => {
    const [a, b] = [await makeAccount(), await makeAccount()];
    const service = serviceFor([a.id, b.id]);
    const customerRole = await getRoleId(ROLE_NAMES.CUSTOMER);

    const results = await Promise.allSettled([service.lock(a.id, b.id), service.update(b.id, a.id, { MaVaiTro: customerRole })]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const stillAdmins = (await Promise.all([row(a.id), row(b.id)])).filter((r) => r && r.TrangThai === ACCOUNT_STATUS.ACTIVE && r.MaVaiTro !== customerRole);
    expect(stillAdmins).toHaveLength(1);
  });
});
