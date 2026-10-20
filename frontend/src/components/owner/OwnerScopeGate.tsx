import { OwnerHotelContextSelector } from './OwnerHotelContext';
import type { useScopedHotels } from './useScopedHotels';

/** Đầu trang chủ khách sạn gồm bộ chọn khách sạn và trạng thái phạm vi */
export function OwnerScopeGate({ scope, prompt }: { scope: ReturnType<typeof useScopedHotels>; prompt: string }) {
  const mustChoose =
    !scope.hotelsQuery.isLoading && !scope.hotelsQuery.error && !scope.invalidHotelId && !scope.hotelId && scope.hotels.length > 1;
  return (
    <>
      <OwnerHotelContextSelector hotels={scope.hotels} hotelId={scope.hotelId} onChange={scope.selectHotel} />
      {scope.state}
      {mustChoose && <div className="owner-scope-state">{prompt}</div>}
    </>
  );
}
