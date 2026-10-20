import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RoomOffer } from './RoomOffer';
import type { RoomTypeWithAvailability } from '../../features/hotels/types';

const room: RoomTypeWithAvailability = {
  MaLoaiPhong: 5,
  TenLoaiPhong: 'Phòng Superior',
  SoGiuong: 1,
  SucChua: 2,
  DienTich: 24,
  LoaiGiuong: 'Giường đôi',
  MoTa: 'Phòng tiêu chuẩn ấm cúng với giường đôi.',
  HinhAnh: [
    { MaHinhAnhLoaiPhong: 1, URL: 'https://img.test/side.jpg', LaAnhDaiDien: false },
    { MaHinhAnhLoaiPhong: 2, URL: 'https://img.test/cover.jpg', LaAnhDaiDien: true },
  ],
  TienNghi: [
    { MaTienNghi: 1, TenTienNghi: 'Wi-Fi miễn phí', BieuTuong: null },
    { MaTienNghi: 2, TenTienNghi: 'Điều hòa nhiệt độ', BieuTuong: null },
    { MaTienNghi: 3, TenTienNghi: 'TV màn hình phẳng', BieuTuong: null },
    { MaTienNghi: 4, TenTienNghi: 'Máy sấy tóc', BieuTuong: null },
    { MaTienNghi: 5, TenTienNghi: 'Két sắt an toàn', BieuTuong: null },
  ],
  GiaTheoDem: 450000,
  TongTien: 450000,
  SoDem: 1,
  SoPhongConLai: 10,
  ConHang: true,
};

const open = async (props: Partial<Parameters<typeof RoomOffer>[0]> = {}) => {
  const onQuantityChange = vi.fn();
  render(<RoomOffer room={room} selectedQuantity={0} onQuantityChange={onQuantityChange} {...props} />);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Xem chi tiết phòng Phòng Superior' }));
  return { onQuantityChange, dialog: screen.getByRole('dialog', { name: 'Chi tiết Phòng Superior' }) };
};

describe('RoomOffer detail dialog', () => {
  it('is closed until "Xem chi tiết phòng" is clicked', () => {
    render(<RoomOffer room={room} selectedQuantity={0} onQuantityChange={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem chi tiết phòng Phòng Superior' })).toBeInTheDocument();
  });

  it('shows the room facts, the full description and every amenity, not only the first four', async () => {
    const { dialog } = await open();

    expect(within(dialog).getByText('24 m²')).toBeInTheDocument();
    expect(within(dialog).getByText('Giường đôi')).toBeInTheDocument();
    expect(within(dialog).getByText('Tối đa 2 khách')).toBeInTheDocument();
    expect(within(dialog).getByText('Phòng tiêu chuẩn ấm cúng với giường đôi.')).toBeInTheDocument();
    expect(within(dialog).getByText('Két sắt an toàn')).toBeInTheDocument();
    expect(within(dialog).getByText('/ phòng / đêm')).toBeInTheDocument();
    expect(within(dialog).getAllByText(/450\.000/)).toHaveLength(2);
    expect(within(dialog).getByText(/cho 1 đêm/)).toBeInTheDocument();
    expect(within(dialog).getByText('Còn 10 phòng')).toBeInTheDocument();
  });

  it('opens on the cover photo and switches photo from the thumbnails', async () => {
    const { dialog } = await open();
    expect(within(dialog).getByRole('img', { name: /Ảnh 1 \/ 2/ })).toHaveAttribute('src', 'https://img.test/cover.jpg');

    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Xem ảnh 2' }));

    expect(within(dialog).getByRole('img', { name: /Ảnh 2 \/ 2/ })).toHaveAttribute('src', 'https://img.test/side.jpg');
  });

  it('lets the guest choose the number of rooms from inside the dialog', async () => {
    const { onQuantityChange, dialog } = await open();

    await userEvent.setup().click(within(dialog).getByRole('button', { name: /^Tăng phòng Phòng Superior/ }));

    expect(onQuantityChange).toHaveBeenCalledWith(1);
  });

  it('closes from the close button and unmounts its content', async () => {
    const { dialog } = await open();

    await userEvent.setup().click(within(dialog).getByRole('button', { name: 'Đóng chi tiết phòng' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says so when the room has no description or photos', async () => {
    const { dialog } = await open({ room: { ...room, MoTa: null, HinhAnh: [], TienNghi: [] } });

    expect(within(dialog).getByText(/chưa cập nhật mô tả/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Chưa có thông tin tiện nghi.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Chưa có ảnh')).toBeInTheDocument();
  });
});
