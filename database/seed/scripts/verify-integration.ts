import path from 'node:path';
import { readFileSync } from 'node:fs';
import { prisma } from '../../../backend/src/config/prisma';
import { verifyPassword } from '../../../backend/src/common/utils/password';

async function verify() {
  console.log('=== RUNNING PRODUCTION BOOTSTRAP INTEGRATION VERIFICATION ===\n');
  const results: Record<string, { status: 'PASS' | 'FAIL'; details?: any }> = {};

  try {
    // Kiểm tra tài khoản
    const admins = await prisma.tAI_KHOAN.findMany({
      where: { VAI_TRO: { TenVaiTro: 'Quản trị hệ thống' } },
      select: { MaTaiKhoan: true, TenDangNhap: true, Email: true, MatKhau: true, TrangThai: true },
    });
    const targetAdmins = admins.filter((a) => a.TenDangNhap.startsWith('admin.'));
    const adminPassMap: Record<string, string> = {
      'admin.nguyen': 'Admin#Egode2026@Tuan',
      'admin.hoang': 'Admin#Egode2026@Linh',
      'admin.tran': 'Admin#Egode2026@Khai',
      'admin.le': 'Admin#Egode2026@Trang',
    };
    const adminPasswordsOk = await Promise.all(
      targetAdmins.map((a) => verifyPassword(adminPassMap[a.TenDangNhap], a.MatKhau))
    );
    const allAdminPassOk = adminPasswordsOk.every(Boolean);

    results['1. Admin Accounts'] = {
      status: targetAdmins.length === 4 && allAdminPassOk ? 'PASS' : 'FAIL',
      details: { count: targetAdmins.length, usernames: targetAdmins.map((a) => a.TenDangNhap), passwordsVerified: allAdminPassOk },
    };

    // Kiểm tra chủ khách sạn và hồ sơ đối tác
    const owners = await prisma.tAI_KHOAN.findMany({
      where: { TenDangNhap: { startsWith: 'owner.' } },
      include: { HO_SO_DOI_TAC_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN: true },
    });
    const approvedPartners = owners.filter(
      (o) => o.HO_SO_DOI_TAC_HO_SO_DOI_TAC_MaTaiKhoanToTAI_KHOAN.some((p) => p.TrangThaiDuyet === 'Đã duyệt')
    );

    results['2. Hotel Owners & Approved Profiles'] = {
      status: owners.length === 10 && approvedPartners.length === 10 ? 'PASS' : 'FAIL',
      details: { ownersCount: owners.length, approvedPartnersCount: approvedPartners.length },
    };

    // Kiểm tra khách hàng
    const customers = await prisma.tAI_KHOAN.findMany({
      where: { TenDangNhap: { startsWith: 'khach.' } },
    });
    results['3. Verified Customers'] = {
      status: customers.length === 6 ? 'PASS' : 'FAIL',
      details: { count: customers.length, usernames: customers.map((c) => c.TenDangNhap) },
    };

    // Kiểm tra 30 khách sạn thật
    const hotels = await prisma.kHACH_SAN.findMany({
      where: { TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { TenDangNhap: { startsWith: 'owner.' } } },
      include: {
        DIA_PHUONG: true,
        HINH_ANH_KHACH_SAN: true,
        KHACH_SAN_TIEN_NGHI: true,
        LOAI_PHONG: {
          include: {
            HINH_ANH_LOAI_PHONG: true,
            LOAI_PHONG_TIEN_NGHI: true,
            QUY_PHONG_GIA: {
              where: { NgayApDung: { gte: new Date() } },
              take: 5,
            },
          },
        },
      },
    });

    const byCity: Record<string, number> = {};
    for (const h of hotels) {
      byCity[h.DIA_PHUONG.TenThanhPho] = (byCity[h.DIA_PHUONG.TenThanhPho] || 0) + 1;
    }

    const allHaveImages = hotels.every((h) => h.HINH_ANH_KHACH_SAN.length >= 1);
    const allHaveAmenities = hotels.every((h) => h.KHACH_SAN_TIEN_NGHI.length >= 3);
    const allHaveRooms = hotels.every((h) => h.LOAI_PHONG.length === 3);

    results['4. 30 Real Hotels Distribution & Relations'] = {
      status: hotels.length === 30 && allHaveImages && allHaveAmenities && allHaveRooms ? 'PASS' : 'FAIL',
      details: { totalHotels: hotels.length, byCity, allHaveImages, allHaveAmenities, allHaveRooms },
    };

    // Kiểm tra 90 loại phòng và ảnh
    const totalRooms = hotels.reduce((sum, h) => sum + h.LOAI_PHONG.length, 0);
    const roomsWithImages = hotels.every((h) => h.LOAI_PHONG.every((r) => r.HINH_ANH_LOAI_PHONG.length >= 1));
    const roomsWithAmenities = hotels.every((h) => h.LOAI_PHONG.every((r) => r.LOAI_PHONG_TIEN_NGHI.length >= 3));

    results['5. Room Types & Room Media'] = {
      status: totalRooms === 90 && roomsWithImages && roomsWithAmenities ? 'PASS' : 'FAIL',
      details: { totalRooms, roomsWithImages, roomsWithAmenities },
    };

    // Kiểm tra giá và tồn kho theo lịch
    const futureRatesCount = await prisma.qUY_PHONG_GIA.count({
      where: {
        LOAI_PHONG: {
          KHACH_SAN: {
            TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { TenDangNhap: { startsWith: 'owner.' } },
          },
        },
        NgayApDung: { gte: new Date() },
      },
    });

    const sampleRate = await prisma.qUY_PHONG_GIA.findFirst({
      where: {
        LOAI_PHONG: {
          KHACH_SAN: {
            TAI_KHOAN_KHACH_SAN_MaTaiKhoanSoHuuToTAI_KHOAN: { TenDangNhap: { startsWith: 'owner.' } },
          },
        },
        NgayApDung: { gte: new Date() },
      },
    });

    results['6. Rate Calendar (90 Days Rolling)'] = {
      status: futureRatesCount >= 8000 && sampleRate && Number(sampleRate.GiaPhong) > 0 ? 'PASS' : 'FAIL',
      details: { futureRatesCount, samplePrice: sampleRate?.GiaPhong, sampleQuantity: sampleRate?.SoLuongPhong },
    };

    // Kiểm tra ảnh truy cập được qua HTTP HEAD
    const sampleUrls = [
      hotels[0]?.HINH_ANH_KHACH_SAN[0]?.URL,
      hotels[10]?.HINH_ANH_KHACH_SAN[0]?.URL,
      hotels[20]?.HINH_ANH_KHACH_SAN[0]?.URL,
      hotels[0]?.LOAI_PHONG[0]?.HINH_ANH_LOAI_PHONG[0]?.URL,
    ].filter(Boolean) as string[];

    const imageHttpChecks = await Promise.all(
      sampleUrls.map(async (u) => {
        try {
          const res = await fetch(u, { method: 'HEAD' });
          return res.ok;
        } catch {
          return false;
        }
      })
    );
    const allImagesLive = imageHttpChecks.every(Boolean);

    results['7. Cloudinary Media Live HTTP Check'] = {
      status: allImagesLive ? 'PASS' : 'FAIL',
      details: { checkedCount: sampleUrls.length, allLive: allImagesLive },
    };

    // Kiểm tra không có từ cấm trong dữ liệu hiển thị
    const forbidden = ['demo', 'test', 'sample', 'fake', 'mock', 'lorem ipsum'];
    const dirtyHotels = hotels.filter((h) =>
      forbidden.some((w) => h.TenKhachSan.toLowerCase().includes(w) || (h.MoTa || '').toLowerCase().includes(w))
    );
    const dirtyAccounts = [
      ...targetAdmins.filter((a) => forbidden.some((w) => a.TenDangNhap.toLowerCase().includes(w))),
      ...owners.filter((o) => forbidden.some((w) => o.TenDangNhap.toLowerCase().includes(w))),
      ...customers.filter((c) => forbidden.some((w) => c.TenDangNhap.toLowerCase().includes(w))),
    ];

    results['8. Zero Forbidden Words (Demo/Test/Fake/Mock/Lorem)'] = {
      status: dirtyHotels.length === 0 && dirtyAccounts.length === 0 ? 'PASS' : 'FAIL',
      details: { dirtyHotels: dirtyHotels.length, dirtyAccounts: dirtyAccounts.length },
    };

    // In tổng kết kết quả
    console.log('SUMMARY TABLE:');
    for (const [name, res] of Object.entries(results)) {
      console.log(`[${res.status}] ${name}`);
      console.log('    ', JSON.stringify(res.details));
    }
  } catch (err: any) {
    console.error('Verification error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
