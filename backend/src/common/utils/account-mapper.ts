import type { TAI_KHOAN } from '../../generated/prisma/client';

export interface SafeAccount {
  MaTaiKhoan: number;
  MaVaiTro: number;
  TenDangNhap: string;
  Email: string;
  HoTen: string;
  SoDienThoai: string;
  NgaySinh: Date | null;
  GioiTinh: string | null;
  AnhDaiDien: string | null;
  TrangThai: string;
  NgayTao: Date;
  NgayCapNhat: Date;
  /** Đối tác có hồ sơ đang chờ duyệt */
  DangChoDuyetDoiTac?: boolean;
  /** Hồ sơ đối tác gần nhất bị từ chối */
  HoSoDoiTacBiTuChoi?: boolean;
}

/** Loại bỏ mật khẩu băm trước khi trả về API */
export const toSafeAccount = (account: TAI_KHOAN): SafeAccount => {
  const safe: Partial<TAI_KHOAN> = { ...account };
  delete safe.MatKhau;
  return safe as SafeAccount;
};
