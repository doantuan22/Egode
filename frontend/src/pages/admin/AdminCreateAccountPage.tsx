import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createAccount } from '../../features/admin/accounts/api';
import { useRoles } from '../../features/admin/accounts/hooks';
import { ApiError } from '../../services/apiClient';
import { Button } from '../../components/common/Button';

export default function AdminCreateAccountPage() {
  const nav = useNavigate();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  // Role ids are IDENTITY values that differ between databases — always resolve them from the API.
  const roles = useRoles();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    const d = new FormData(e.currentTarget);
    try {
      await createAccount({
        TenDangNhap: String(d.get('TenDangNhap')),
        Email: String(d.get('Email')),
        MatKhau: String(d.get('MatKhau')),
        HoTen: String(d.get('HoTen')),
        SoDienThoai: String(d.get('SoDienThoai')),
        MaVaiTro: Number(d.get('MaVaiTro')),
      });
      nav('/admin/accounts');
    } catch (x) {
      setError(x instanceof ApiError ? x.message : 'Không thể tạo tài khoản');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[600px] mx-auto w-full">
      <Link to="/admin/accounts" className="breadcrumb w-fit">
        <i className="ph ph-arrow-left"></i>
        <span>Quay lại danh sách</span>
      </Link>

      <div className="bg-white border border-border rounded-[16px] shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border bg-surface-secondary flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
            <i className="ph ph-user-plus text-[20px]"></i>
          </div>
          <div>
            <h3 className="text-lg font-bold text-heading">Thêm mới tài khoản</h3>
            <p className="text-xs text-ink-muted mt-0.5">Khởi tạo định danh người dùng và cấp quyền sử dụng hệ thống.</p>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div role="alert" className="mb-6 p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium flex items-start gap-2">
              <i className="ph-fill ph-warning-circle text-danger mt-0.5"></i>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="create-HoTen" className="text-xs font-semibold text-ink-sub block">Họ và tên <span className="text-danger" aria-hidden="true">*</span></label>
              <input id="create-HoTen" type="text" name="HoTen" required minLength={2} placeholder="Ví dụ: Hoàng Văn Nam" className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="create-TenDangNhap" className="text-xs font-semibold text-ink-sub block">Tên đăng nhập <span className="text-danger" aria-hidden="true">*</span></label>
                <input id="create-TenDangNhap" type="text" name="TenDangNhap" required minLength={3} pattern="[A-Za-z0-9_.]+" title="Chỉ gồm chữ không dấu, số, dấu chấm hoặc gạch dưới" placeholder="Ví dụ: hoangnam123" className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="create-Email" className="text-xs font-semibold text-ink-sub block">Địa chỉ Email <span className="text-danger" aria-hidden="true">*</span></label>
                <input id="create-Email" type="email" name="Email" required placeholder="nam.hoang@example.com" className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="create-SoDienThoai" className="text-xs font-semibold text-ink-sub block">Số điện thoại <span className="text-danger" aria-hidden="true">*</span></label>
                <input id="create-SoDienThoai" type="tel" name="SoDienThoai" required minLength={8} maxLength={20} placeholder="0912 345 890" className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="create-MaVaiTro" className="text-xs font-semibold text-ink-sub block">Vai trò hệ thống <span className="text-danger" aria-hidden="true">*</span></label>
                <select id="create-MaVaiTro" name="MaVaiTro" required defaultValue="" disabled={roles.isLoading || roles.isError} className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition">
                  <option value="" disabled>{roles.isLoading ? 'Đang tải vai trò...' : 'Chọn vai trò'}</option>
                  {roles.data?.map((role) => (
                    <option key={role.MaVaiTro} value={role.MaVaiTro}>{role.TenVaiTro}</option>
                  ))}
                </select>
                {roles.isError && <p role="alert" className="text-[11px] text-danger">Không tải được danh sách vai trò.</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="create-MatKhau" className="text-xs font-semibold text-ink-sub block">Mật khẩu ban đầu <span className="text-danger" aria-hidden="true">*</span></label>
              <input id="create-MatKhau" type="password" name="MatKhau" required minLength={8} maxLength={128} aria-describedby="create-MatKhau-hint" placeholder="••••••••••••" className="w-full px-3 py-2 bg-white border border-border rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition" />
              <span id="create-MatKhau-hint" className="text-[10px] text-ink-muted mt-1 block">Tối thiểu 8 ký tự. Hãy gửi mật khẩu này cho người dùng qua kênh riêng — hệ thống không tự gửi email.</span>
            </div>

            <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
              <Button asChild variant="ghost">
                <Link to="/admin/accounts">Hủy bỏ</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Đang tạo...' : 'Lưu tài khoản'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
