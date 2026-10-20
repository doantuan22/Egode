import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../services/apiClient';
import {
  createAdminAmenity,
  deleteAdminAmenity,
  listAdminAmenities,
  updateAdminAmenity,
  type AdminAmenity,
} from '../../features/admin/hotels/api';
import { useConfirm, useFeedback } from '../../components/common/FeedbackProvider';
import { PageHeader } from '../../components/common/PageHeader';
import { DataTable, type Column } from '../../components/common/DataTable';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Icon } from '../../components/common/Icon';

const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Thao tác thất bại, vui lòng thử lại');

export default function AdminAmenitiesPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { notify } = useFeedback();
  const [editing, setEditing] = useState<AdminAmenity | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');

  const query = useQuery({ queryKey: ['admin', 'hotels', 'amenities'], queryFn: listAdminAmenities });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'hotels', 'amenities'] });
    // Bộ lọc công khai và bộ chọn của chủ khách sạn dùng chung danh mục
    void queryClient.invalidateQueries({ queryKey: ['amenities'] });
  };
  const resetForm = () => {
    setEditing(null);
    setName('');
    setIcon('');
  };

  const save = useMutation({
    mutationFn: (payload: { TenTienNghi: string; BieuTuong: string | null }) =>
      editing ? updateAdminAmenity(editing.MaTienNghi, payload) : createAdminAmenity(payload),
    onSuccess: () => {
      notify({ title: editing ? 'Đã cập nhật tiện nghi' : 'Đã thêm tiện nghi', tone: 'success' });
      resetForm();
      refresh();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteAdminAmenity(id),
    onSuccess: (_data, id) => {
      notify({ title: 'Đã xóa tiện nghi', tone: 'success' });
      if (editing?.MaTienNghi === id) resetForm();
      refresh();
    },
    onError: (error) => {
      notify({ title: 'Không thể xóa tiện nghi', description: errorMessage(error), tone: 'error' });
      refresh();
    },
  });

  const startEdit = (amenity: AdminAmenity) => {
    save.reset();
    setEditing(amenity);
    setName(amenity.TenTienNghi);
    setIcon(amenity.BieuTuong ?? '');
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate({ TenTienNghi: name.trim(), BieuTuong: icon.trim() || null });
  };

  const onDelete = async (amenity: AdminAmenity) => {
    if (amenity.SoKhachSan + amenity.SoLoaiPhong > 0) {
      notify({
        title: 'Tiện nghi đang được sử dụng',
        description: `"${amenity.TenTienNghi}" đang gắn với ${amenity.SoKhachSan} khách sạn và ${amenity.SoLoaiPhong} loại phòng. Hãy gỡ khỏi các cơ sở trước khi xóa.`,
        tone: 'warning',
      });
      return;
    }
    const ok = await confirm({
      title: 'Xóa tiện nghi?',
      description: `Tiện nghi "${amenity.TenTienNghi}" sẽ bị xóa khỏi danh mục.`,
      confirmLabel: 'Xóa',
      variant: 'danger',
    });
    if (ok) remove.mutate(amenity.MaTienNghi);
  };

  const columns: Column<AdminAmenity>[] = [
    {
      key: 'name',
      header: 'Tên tiện nghi',
      cell: (amenity) => (
        <>
          <div className="font-bold text-heading">{amenity.TenTienNghi}</div>
          <div className="mt-0.5 font-mono text-[11px] text-ink-muted">#{amenity.MaTienNghi}</div>
        </>
      ),
    },
    { key: 'icon', header: 'Biểu tượng', cell: (amenity) => <span className="font-mono text-xs text-ink-sub">{amenity.BieuTuong ?? '—'}</span> },
    { key: 'hotels', header: 'Khách sạn', align: 'center', cell: (amenity) => amenity.SoKhachSan },
    { key: 'roomTypes', header: 'Loại phòng', align: 'center', cell: (amenity) => amenity.SoLoaiPhong },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'center',
      cell: (amenity) => (
        <div className="flex items-center justify-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => startEdit(amenity)} aria-label={`Sửa tiện nghi ${amenity.TenTienNghi}`}>
            <Icon name="pencil-simple" /> Sửa
          </Button>
          <Button type="button" size="sm" variant="danger-outline" onClick={() => void onDelete(amenity)} disabled={remove.isPending} aria-label={`Xóa tiện nghi ${amenity.TenTienNghi}`}>
            <Icon name="trash" /> Xóa
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page-shell max-w-[1200px] mx-auto w-full">
      <Link to="/admin/hotels" className="breadcrumb w-fit">
        <Icon name="arrow-left" />
        <span>Quay lại danh sách khách sạn</span>
      </Link>
      <PageHeader title="Quản lý tiện nghi" description="Danh mục tiện nghi dùng chung cho khách sạn và loại phòng; chủ khách sạn chọn từ danh mục này." />

      <form onSubmit={onSubmit} className="rounded-2xl border border-border bg-white p-5 space-y-4" aria-label={editing ? 'Sửa tiện nghi' : 'Thêm tiện nghi'}>
        <h2 className="text-sm font-bold text-heading">{editing ? `Sửa tiện nghi #${editing.MaTienNghi}` : 'Thêm tiện nghi mới'}</h2>
        {save.isError && (
          <div role="alert" className="p-3 bg-danger-light border border-danger/30 rounded-xl text-danger-ink text-sm font-medium">
            {errorMessage(save.error)}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Tên tiện nghi" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={150} placeholder="Ví dụ: Hồ bơi vô cực" />
          <Input label="Mã biểu tượng" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={255} placeholder="Ví dụ: pool" hint="Không bắt buộc." />
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          {editing && (
            <Button type="button" variant="ghost" onClick={resetForm} disabled={save.isPending}>Hủy sửa</Button>
          )}
          <Button type="submit" loading={save.isPending} disabled={name.trim().length < 2}>
            <Icon name={editing ? 'floppy-disk' : 'plus'} /> {editing ? 'Lưu thay đổi' : 'Thêm tiện nghi'}
          </Button>
        </div>
      </form>

      <DataTable
        caption="Danh mục tiện nghi"
        columns={columns}
        rows={query.data}
        getRowKey={(amenity) => amenity.MaTienNghi}
        isLoading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        emptyTitle="Chưa có tiện nghi nào"
        emptyDescription="Thêm tiện nghi đầu tiên bằng biểu mẫu phía trên."
        emptyIcon="list-checks"
      />
    </div>
  );
}
