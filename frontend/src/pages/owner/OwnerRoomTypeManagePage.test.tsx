import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OwnerRoomTypeManagePage from './OwnerRoomTypeManagePage';
import { FeedbackProvider } from '../../components/common/FeedbackProvider';
import {
  useDeactivateRoomType,
  useDeleteRoomTypeImage,
  useReactivateRoomType,
  useReplaceRoomTypeAmenities,
  useRoomType,
  useSetPrimaryRoomTypeImage,
  useUpdateRoomType,
  useUploadRoomTypeImage,
} from '../../features/owner/hooks';
import { useAmenities } from '../../features/amenities/hooks';
import { ApiError } from '../../services/apiClient';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/owner/hooks');
vi.mock('../../features/amenities/hooks');

const roomType = (TrangThai: string) => ({
  MaLoaiPhong: 11,
  MaKhachSan: 1,
  TenLoaiPhong: 'Phòng Superior',
  SoGiuong: 1,
  SucChua: 2,
  DienTich: 24,
  LoaiGiuong: 'Giường đôi',
  MoTa: null,
  TrangThai,
  HINH_ANH_LOAI_PHONG: [],
  LOAI_PHONG_TIEN_NGHI: [],
});

const idleMutation = (mutate = vi.fn()) => ({ mutate, mutateAsync: vi.fn(), isPending: false, isError: false, error: null, reset: vi.fn() });
const deactivate = vi.fn();
const reactivate = vi.fn();

beforeEach(() => {
  deactivate.mockReset();
  reactivate.mockReset();
  vi.mocked(useAmenities).mockReturnValue({ isLoading: false, data: [] } as unknown as ReturnType<typeof useAmenities>);
  vi.mocked(useUpdateRoomType).mockReturnValue(idleMutation() as unknown as ReturnType<typeof useUpdateRoomType>);
  vi.mocked(useDeactivateRoomType).mockReturnValue(idleMutation(deactivate) as unknown as ReturnType<typeof useDeactivateRoomType>);
  vi.mocked(useReactivateRoomType).mockReturnValue(idleMutation(reactivate) as unknown as ReturnType<typeof useReactivateRoomType>);
  vi.mocked(useReplaceRoomTypeAmenities).mockReturnValue(idleMutation() as unknown as ReturnType<typeof useReplaceRoomTypeAmenities>);
  vi.mocked(useUploadRoomTypeImage).mockReturnValue(idleMutation() as unknown as ReturnType<typeof useUploadRoomTypeImage>);
  vi.mocked(useDeleteRoomTypeImage).mockReturnValue(idleMutation() as unknown as ReturnType<typeof useDeleteRoomTypeImage>);
  vi.mocked(useSetPrimaryRoomTypeImage).mockReturnValue(idleMutation() as unknown as ReturnType<typeof useSetPrimaryRoomTypeImage>);
});

const open = (TrangThai: string) => {
  vi.mocked(useRoomType).mockReturnValue({ isLoading: false, isError: false, data: roomType(TrangThai) } as unknown as ReturnType<typeof useRoomType>);
  renderWithProviders(
    <Routes>
      <Route path="/owner/room-types/:roomTypeId" element={<FeedbackProvider><OwnerRoomTypeManagePage /></FeedbackProvider>} />
    </Routes>,
    { route: '/owner/room-types/11' }
  );
};

describe('OwnerRoomTypeManagePage – stop / resume selling', () => {
  it('an active room type offers "Ngừng bán" and not "Mở bán lại"', () => {
    open('Hoạt động');

    expect(screen.getByRole('button', { name: 'Ngừng bán' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở bán lại' })).not.toBeInTheDocument();
  });

  it('a discontinued room type offers "Mở bán lại" and not "Ngừng bán"', () => {
    open('Ngừng bán');

    expect(screen.getByRole('button', { name: 'Mở bán lại' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ngừng bán' })).not.toBeInTheDocument();
  });

  it('"Mở bán lại" asks for confirmation, then reactivates', async () => {
    open('Ngừng bán');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Mở bán lại' }));
    expect(reactivate).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Mở bán lại' }));

    expect(reactivate).toHaveBeenCalledTimes(1);
    expect(deactivate).not.toHaveBeenCalled();
  });

  it('shows the server message when stopping sales is refused because of open bookings', () => {
    vi.mocked(useDeactivateRoomType).mockReturnValue({
      ...idleMutation(deactivate),
      isError: true,
      error: new ApiError('Không thể ngừng bán khi loại phòng còn 2 đơn đặt phòng chưa hoàn tất', 409),
    } as unknown as ReturnType<typeof useDeactivateRoomType>);

    open('Hoạt động');

    expect(screen.getByRole('alert')).toHaveTextContent('Không thể ngừng bán khi loại phòng còn 2 đơn đặt phòng chưa hoàn tất');
  });
});
