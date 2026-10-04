import type { UseQueryResult } from '@tanstack/react-query';
import type { RoomTypeWithAvailability } from '../../../features/hotels/types';
import { formatDateRangeVi } from '../../../lib/utils';
import { ApiError } from '../../../services/apiClient';
import { EmptyState } from '../../common/EmptyState';
import { Icon } from '../../common/Icon';
import { PageSpinner } from '../../common/PageSpinner';
import { RoomOffer } from '../RoomOffer';
import { TravelSearchBar, type TravelSearchCriteria } from '../TravelSearchBar';

interface RoomListProps {
  search: TravelSearchCriteria;
  onSearch: (values: TravelSearchCriteria) => void;
  roomsQuery: UseQueryResult<RoomTypeWithAvailability[]>;
  /** Rooms chosen so far: room type id -> quantity. */
  selectedRooms: Record<number, number>;
  onQuantityChange: (roomTypeId: number, quantity: number, available: number) => void;
}

/** "Loại phòng & Giá": the stay editor and one offer per room type. */
export function RoomList({ search, onSearch, roomsQuery, selectedRooms, onQuantityChange }: RoomListProps) {
  return (
    <section id="loai-phong" className="pt-2 scroll-mt-36">
      <div className="mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-ink tracking-tight flex items-center gap-2">
          <Icon name="bed" size={24} className="text-primary" />
          Các loại phòng sẵn có
        </h2>
        <p className="mt-1 text-sm text-ink-muted">{formatDateRangeVi(search.checkIn, search.checkOut, ' → ')} · {search.guests} khách</p>
      </div>

      <TravelSearchBar variant="stay" currentSearch={search} onSearch={onSearch} loading={roomsQuery.isFetching} />

      {roomsQuery.isLoading ? (
        <PageSpinner className="py-10" />
      ) : roomsQuery.isError ? (
        <div role="alert" className="rounded-lg bg-danger-light px-4 py-3 text-sm text-danger-ink">{roomsQuery.error instanceof ApiError && roomsQuery.error.statusCode === 400 ? roomsQuery.error.message : 'Không thể tải danh sách phòng'}</div>
      ) : roomsQuery.data && roomsQuery.data.length === 0 ? (
        <EmptyState icon="bed" title="Không có loại phòng phù hợp." />
      ) : (
        <div className="space-y-6">
          {roomsQuery.data?.map((room) => (
            <RoomOffer
              key={room.MaLoaiPhong}
              room={room}
              selectedQuantity={selectedRooms[room.MaLoaiPhong] ?? 0}
              onQuantityChange={(quantity) => onQuantityChange(room.MaLoaiPhong, quantity, room.SoPhongConLai)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
