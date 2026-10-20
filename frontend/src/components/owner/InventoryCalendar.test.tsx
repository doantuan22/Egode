import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InventoryCalendar } from './InventoryCalendar';

const month = new Date(2099, 4, 1);
const cells = { '2099-05-02': { price: 700000, available: 5, closed: false }, '2099-05-03': { price: 0, available: 0, closed: true } };
const fmt = (v: number) => `${v} đ`;
const day = (d: number) => screen.getByRole('button', { name: new RegExp(`^${String(d).padStart(2, '0')}/05/2099`) });
const open = (patch: Partial<React.ComponentProps<typeof InventoryCalendar>> = {}) =>
  render(<InventoryCalendar month={month} cells={cells} selected={null} onSelect={vi.fn()} onMonthChange={vi.fn()} formatPrice={fmt} {...patch} />);

describe('InventoryCalendar', () => {
  it('shows price and rooms left, or "Đóng bán", for each day that has a record', () => {
    open();

    expect(day(2)).toHaveAccessibleName('02/05/2099, 700000 đ, 5 phòng');
    expect(day(3)).toHaveAccessibleName('03/05/2099, đóng bán');
    expect(day(4)).toHaveAccessibleName('04/05/2099, chưa có giá');
  });

  it('picks a range with two clicks, in either order, and starts over on the third', async () => {
    const onSelect = vi.fn();
    open({ onSelect });
    const user = userEvent.setup();

    await user.click(day(12));
    expect(onSelect).toHaveBeenLastCalledWith({ from: '2099-05-12', to: '2099-05-12' });
    await user.click(day(9));
    expect(onSelect).toHaveBeenLastCalledWith({ from: '2099-05-09', to: '2099-05-12' });
    await user.click(day(20));
    expect(onSelect).toHaveBeenLastCalledWith({ from: '2099-05-20', to: '2099-05-20' });
  });

  it('marks the selected days as pressed', () => {
    open({ selected: { from: '2099-05-10', to: '2099-05-12' } });
    expect(day(10)).toHaveAttribute('aria-pressed', 'true');
    expect(day(12)).toHaveAttribute('aria-pressed', 'true');
    expect(day(13)).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not let past days be picked', async () => {
    const onSelect = vi.fn();
    open({ month: new Date(2001, 0, 1), cells: {}, onSelect });

    const first = screen.getByRole('button', { name: /^01\/01\/2001/ });
    expect(first).toBeDisabled();
    await userEvent.setup().click(first);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('asks for the previous and the next month', async () => {
    const onMonthChange = vi.fn();
    open({ onMonthChange });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Tháng trước/ }));
    expect(onMonthChange).toHaveBeenLastCalledWith(new Date(2099, 3, 1));
    await user.click(screen.getByRole('button', { name: /Tháng sau/ }));
    expect(onMonthChange).toHaveBeenLastCalledWith(new Date(2099, 5, 1));
  });
});
