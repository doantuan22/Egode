import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testUtils';
import { TravelSearchBar } from './TravelSearchBar';
import { addDaysToDateKey, businessToday } from '../../lib/stayDates';

vi.mock('../../features/locations/hooks', () => ({
  useLocations: () => ({ data: [{ TenThanhPho: 'Hà Nội' }, { TenThanhPho: 'Đà Nẵng' }] }),
}));

// Stay dates must be today-or-later and within the booking window, so every date here is relative to Vietnam's today.
const today = businessToday();
const inDays = (days: number) => addDaysToDateKey(today, days);
/** A day of next month (always fully selectable and shown first when the calendar opens on a date of that month). */
const dayOfNextMonth = (day: number) => {
  const [year, month] = today.split('-').map(Number);
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  return `${next.y}-${String(next.m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};
const display = (key: string) => key.split('-').reverse().join('/');

describe('TravelSearchBar', () => {
  const currentSearch = { location: 'Hà Nội', checkIn: inDays(10), checkOut: inDays(12), guests: 2 };
  let onSearch: ReturnType<typeof vi.fn>;

  beforeEach(() => { onSearch = vi.fn(); });

  it('keeps edits as draft until explicit search and submits the selected destination', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TravelSearchBar currentSearch={currentSearch} onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: /Điểm đến Hà Nội/i }));
    const destination = screen.getByRole('combobox', { name: 'Điểm đến' });
    await user.clear(destination);
    await user.type(destination, 'Đà');
    await user.click(await screen.findByRole('option', { name: 'Đà Nẵng' }));

    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Điểm đến Đà Nẵng/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
    expect(onSearch).toHaveBeenCalledWith({ ...currentSearch, location: 'Đà Nẵng' });
  });

  it('rejects an incomplete stay and leaves committed search unchanged', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TravelSearchBar currentSearch={{ ...currentSearch, checkOut: '' }} onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Vui lòng chọn ngày trả phòng');
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('picks check-in and check-out from the calendar and submits them as YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    const [checkIn, checkOut] = [dayOfNextMonth(10), dayOfNextMonth(14)];
    renderWithProviders(<TravelSearchBar currentSearch={{ ...currentSearch, checkIn: dayOfNextMonth(1), checkOut: dayOfNextMonth(3) }} onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: /Ngày lưu trú/i }));
    await user.click(document.querySelector(`[data-day="${checkIn}"] button`) as HTMLElement);
    await user.click(document.querySelector(`[data-day="${checkOut}"] button`) as HTMLElement);

    expect(screen.getByText(display(checkIn))).toBeInTheDocument();
    expect(screen.getByText(display(checkOut))).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
    expect(onSearch).toHaveBeenCalledWith({ ...currentSearch, checkIn, checkOut });
  });

  it('keeps a typed custom destination in draft when switching editors', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TravelSearchBar currentSearch={currentSearch} onSearch={onSearch} />);
    await user.click(screen.getByRole('button', { name: /Điểm đến Hà Nội/i }));
    await user.clear(screen.getByRole('combobox', { name: 'Điểm đến' }));
    await user.type(screen.getByRole('combobox', { name: 'Điểm đến' }), 'Địa điểm riêng');
    await user.click(screen.getByRole('button', { name: /Ngày lưu trú/i }));
    expect(screen.getByRole('button', { name: /Điểm đến Địa điểm riêng/i })).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('keeps guest adjustments local until submit and preserves the 1–50 limit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TravelSearchBar currentSearch={currentSearch} onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: /Số khách 2 khách/i }));
    await user.click(screen.getByRole('button', { name: 'Tăng khách' }));
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText('3', { selector: 'output' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
    expect(onSearch).toHaveBeenCalledWith({ ...currentSearch, guests: 3 });
  });

  it('does not allow the guest count to exceed 50', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TravelSearchBar currentSearch={{ ...currentSearch, guests: 50 }} onSearch={onSearch} />);
    await user.click(screen.getByRole('button', { name: /Số khách 50 khách/i }));
    expect(screen.getByRole('button', { name: 'Tăng khách' })).toBeDisabled();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('uses the stay variant without editing the fixed hotel destination', async () => {
    const user = userEvent.setup();
    const staySearch = { checkIn: inDays(10), checkOut: inDays(12), guests: 2 };
    renderWithProviders(<TravelSearchBar variant="stay" currentSearch={staySearch} onSearch={onSearch} />);
    expect(screen.queryByRole('button', { name: /Điểm đến/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Kiểm tra phòng/i }));
    expect(onSearch).toHaveBeenCalledWith(staySearch);
  });

  describe('stay-date rule (same as the backend)', () => {
    it('does not let a past day be picked as check-in, and tells the visitor when the form holds one', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TravelSearchBar currentSearch={{ ...currentSearch, checkIn: inDays(-3), checkOut: inDays(-1) }} onSearch={onSearch} />);

      await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Ngày nhận phòng không được trước hôm nay');
      expect(onSearch).not.toHaveBeenCalled();
    });

    it('rejects a stay longer than 30 nights and a check-out that is not after check-in', async () => {
      const user = userEvent.setup();
      const { unmount } = renderWithProviders(<TravelSearchBar currentSearch={{ ...currentSearch, checkIn: inDays(2), checkOut: inDays(33) }} onSearch={onSearch} />);
      await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Mỗi lần đặt tối đa 30 đêm');
      unmount();

      renderWithProviders(<TravelSearchBar currentSearch={{ ...currentSearch, checkIn: inDays(5), checkOut: inDays(5) }} onSearch={onSearch} />);
      await user.click(screen.getByRole('button', { name: /Tìm kiếm/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Ngày trả phòng phải sau ngày nhận phòng');
      expect(onSearch).not.toHaveBeenCalled();
    });

    it('applies to the stay variant too (no exemption on the hotel page)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<TravelSearchBar variant="stay" currentSearch={{ checkIn: inDays(-2), checkOut: inDays(1), guests: 2 }} onSearch={onSearch} />);
      await user.click(screen.getByRole('button', { name: /Kiểm tra phòng/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Ngày nhận phòng không được trước hôm nay');
      expect(onSearch).not.toHaveBeenCalled();
    });
  });
});
