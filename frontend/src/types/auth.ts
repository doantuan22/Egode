export type Gender = 'Nam' | 'Nữ' | 'Khác';

export interface Account {
  MaTaiKhoan: number;
  MaVaiTro: number;
  TenDangNhap: string;
  Email: string;
  HoTen: string;
  SoDienThoai: string;
  // DDI-01 (resolved): nullable in the baseline — not collected at registration.
  NgaySinh: string | null;
  GioiTinh: Gender | null;
  AnhDaiDien: string | null;
  TrangThai: string;
  NgayTao: string;
  NgayCapNhat: string;
  /** Present on admin account responses. */
  VAI_TRO?: { TenVaiTro: string };
}

export interface Role {
  MaVaiTro: number;
  TenVaiTro: string;
  MoTa: string;
}

export interface AuthResult {
  account: Account;
  accessToken: string;
}

export interface RegisterPayload {
  TenDangNhap: string;
  Email: string;
  MatKhau: string;
  HoTen: string;
  SoDienThoai: string;
  NgaySinh?: string;
  GioiTinh?: Gender;
}

export interface LoginPayload {
  identifier: string;
  MatKhau: string;
}

export interface UpdateProfilePayload {
  HoTen?: string;
  SoDienThoai?: string;
  NgaySinh?: string;
  GioiTinh?: Gender;
  AnhDaiDien?: string;
}

export interface ChangePasswordPayload {
  MatKhauCu: string;
  MatKhauMoi: string;
}

export interface ForgotPasswordPayload {
  Email: string;
}

export interface ResetPasswordPayload {
  token: string;
  MatKhauMoi: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AccountListQuery {
  page?: number;
  limit?: number;
  search?: string;
  TrangThai?: string;
  MaVaiTro?: number;
}

export interface UpdateAccountPayload {
  TenDangNhap?: string;
  Email?: string;
  HoTen?: string;
  SoDienThoai?: string;
  NgaySinh?: string;
  GioiTinh?: Gender;
  AnhDaiDien?: string;
  MaVaiTro?: number;
}

export interface PartnerApplication {
  MaHoSoDoiTac: number;
  MaTaiKhoan: number;
  SoCCCD: string;
  SoGiayPhepKinhDoanh: string;
  MaSoThue: string;
  TepGiayTo: string;
  TrangThaiDuyet: 'Chờ duyệt' | 'Đã duyệt' | 'Từ chối';
  LyDoTuChoi: string | null;
  NgayNop: string;
  NgayDuyet: string | null;
  MaTaiKhoanDuyet: number | null;
}

export interface ApplyPartnerPayload {
  SoCCCD: string;
  SoGiayPhepKinhDoanh: string;
  MaSoThue: string;
  TepGiayTo: string;
}
