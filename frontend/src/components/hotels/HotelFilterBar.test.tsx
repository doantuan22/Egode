import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { amenityIconName } from './amenityIcon';
import { HotelFilterBar } from './HotelFilterBar';

const amenities = [
  { MaTienNghi: 1, TenTienNghi: 'Hồ bơi', BieuTuong: null },
  { MaTienNghi: 2, TenTienNghi: 'Bữa sáng miễn phí', BieuTuong: null },
];
const handlers = () => ({ onApply: vi.fn(), onReset: vi.fn() });
const apply = () => screen.getByRole('button', { name: /Áp dụng bộ lọc/ });

describe('HotelFilterBar', () => {
  it('lists the applied filters as chips (with a clear-all) and nothing when none are applied', () => {
    const { rerender } = render(<HotelFilterBar values={{}} amenities={amenities} {...handlers()} />);
    expect(screen.getByText('Chưa chọn bộ lọc nào.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xóa tất cả/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đặt lại bộ lọc/ })).toBeDisabled();

    rerender(<HotelFilterBar values={{ starRating: 4, amenities: [2], minPrice: 500000 }} amenities={amenities} {...handlers()} />);
    expect(screen.getByRole('button', { name: 'Bỏ lọc Từ 4 sao' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ lọc Bữa sáng miễn phí' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ lọc Giá: 500.000đ – 10.000.000đ+' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xóa tất cả/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Từ 4 sao trở lên$/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Từ 5 sao trở lên$/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Bữa sáng miễn phí' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps choices as a draft until "Áp dụng bộ lọc", then commits the whole set at once', async () => {
    const h = handlers();
    render(<HotelFilterBar values={{}} amenities={amenities} {...h} />);
    const user = userEvent.setup();
    expect(apply()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^Từ 5 sao trở lên$/ }));
    await user.click(screen.getByRole('button', { name: 'Hồ bơi' }));
    expect(h.onApply).not.toHaveBeenCalled();
    expect(apply()).toBeEnabled();

    await user.click(apply());
    expect(h.onApply).toHaveBeenCalledTimes(1);
    expect(h.onApply).toHaveBeenCalledWith({ keyword: undefined, minPrice: undefined, maxPrice: undefined, starRating: 5, amenities: [1] });
  });

  it('says the rating is a minimum — "Tất cả" and "N trở lên" for 3, 4 and 5 — never "exactly N stars"', () => {
    render(<HotelFilterBar values={{}} amenities={undefined} {...handlers()} />);

    expect(screen.getByText('Hạng sao tối thiểu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tất cả' })).toHaveAttribute('aria-pressed', 'true');
    for (const star of [3, 4, 5]) {
      expect(screen.getByRole('button', { name: `Từ ${star} sao trở lên` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /^[1-5] sao$/ })).not.toBeInTheDocument();
  });

  it('picks a star rating and "Tất cả" / a second click clears it', async () => {
    const h = handlers();
    render(<HotelFilterBar values={{ starRating: 5 }} amenities={undefined} {...h} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Tất cả' }));
    await user.click(apply());
    expect(h.onApply).toHaveBeenLastCalledWith(expect.objectContaining({ starRating: undefined }));
  });

  it('applies a typed price range; a bound at its extreme means "no bound"; crossed bounds are swapped', async () => {
    const h = handlers();
    render(<HotelFilterBar values={{}} amenities={undefined} {...h} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Giá tối thiểu'), '500000');
    expect(screen.getByLabelText('Giá tối thiểu')).toHaveValue('500.000');
    await user.click(apply());
    expect(h.onApply).toHaveBeenLastCalledWith(expect.objectContaining({ minPrice: 500000, maxPrice: undefined }));

    const max = screen.getByLabelText('Giá tối đa');
    await user.clear(max);
    await user.type(max, '300000');
    await user.click(apply());
    expect(h.onApply).toHaveBeenLastCalledWith(expect.objectContaining({ minPrice: 300000, maxPrice: 500000 }));
  });

  it('moves the price with the sliders without letting them cross', () => {
    const h = handlers();
    render(<HotelFilterBar values={{}} amenities={undefined} {...h} />);

    fireEvent.change(screen.getByLabelText('Kéo chọn giá tối đa'), { target: { value: '2000000' } });
    expect(screen.getByLabelText('Giá tối đa')).toHaveValue('2.000.000');
    fireEvent.change(screen.getByLabelText('Kéo chọn giá tối thiểu'), { target: { value: '5000000' } });
    expect(screen.getByLabelText('Giá tối thiểu')).toHaveValue('2.000.000');
  });

  it('applies the keyword with Enter', async () => {
    const h = handlers();
    render(<HotelFilterBar values={{}} amenities={undefined} {...h} />);

    await userEvent.setup().type(screen.getByLabelText('Từ khóa'), '  biển  {Enter}');
    expect(h.onApply).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'biển' }));
  });

  it('a chip × removes just that filter at once; "Xóa tất cả" and "Đặt lại bộ lọc" reset', async () => {
    const h = handlers();
    render(<HotelFilterBar values={{ starRating: 4, amenities: [1, 2] }} amenities={amenities} {...h} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Bỏ lọc Hồ bơi' }));
    expect(h.onApply).toHaveBeenLastCalledWith({ starRating: 4, amenities: [2] });

    await user.click(screen.getByRole('button', { name: /Xóa tất cả/ }));
    await user.click(screen.getByRole('button', { name: /Đặt lại bộ lọc/ }));
    expect(h.onReset).toHaveBeenCalledTimes(2);
  });

  it('shows the number of hotels found and can be collapsed', async () => {
    render(<HotelFilterBar values={{}} amenities={undefined} totalHotels={124} {...handlers()} />);
    expect(screen.getByText(/Tìm thấy/)).toHaveTextContent('Tìm thấy 124 khách sạn');

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Thu gọn bộ lọc' }));
    expect(screen.getByRole('button', { name: 'Mở rộng bộ lọc' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(document.body).queryByLabelText('Từ khóa')).not.toBeVisible();
  });

  it('shows amenities in a single row closed by the "Xem thêm" card, and unfolds them all', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ MaTienNghi: i + 1, TenTienNghi: `Tiện nghi ${i + 1}`, BieuTuong: null }));
    render(<HotelFilterBar values={{}} amenities={many} {...handlers()} />);
    const user = userEvent.setup();
    const group = screen.getByRole('group', { name: 'Tiện nghi' });
    const cards = () => within(group).getAllByRole('button');

    // jsdom has no layout, so the grid uses its 6-column fallback: 5 amenities + the "Xem thêm" card, which is last.
    expect(cards()).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Tiện nghi 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tiện nghi 6' })).not.toBeInTheDocument();
    expect(cards().at(-1)).toHaveTextContent('Xem thêm 6');

    await user.click(cards().at(-1)!);
    expect(screen.getByRole('button', { name: 'Tiện nghi 11' })).toBeInTheDocument();
    expect(cards().at(-1)).toHaveTextContent('Thu gọn');
  });

  it('has no "Xem thêm" card when every amenity fits in the row', () => {
    render(<HotelFilterBar values={{}} amenities={amenities} {...handlers()} />);
    expect(screen.queryByRole('button', { name: /Xem thêm/ })).not.toBeInTheDocument();
  });
});

describe('amenityIconName', () => {
  it('picks an icon from the amenity name, ignoring accents, with a neutral default', () => {
    expect(amenityIconName({ TenTienNghi: 'Hồ bơi' })).toBe('swimming-pool');
    expect(amenityIconName({ TenTienNghi: 'Bãi đỗ xe' })).toBe('car');
    expect(amenityIconName({ TenTienNghi: 'Điều hòa nhiệt độ' })).toBe('snowflake');
    expect(amenityIconName({ TenTienNghi: 'Đưa đón sân bay' })).toBe('airplane-tilt');
    expect(amenityIconName({ TenTienNghi: 'Dọn phòng hằng ngày' })).toBe('sparkle');
  });
});
