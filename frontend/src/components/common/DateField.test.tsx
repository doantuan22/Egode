import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DateField } from './DateField';
import { Input } from './Input';
import { DashboardUiContext } from './DashboardUiContext';

const inDashboard = (node: React.ReactNode) => render(<DashboardUiContext.Provider value>{node}</DashboardUiContext.Provider>);

function Controlled({ min }: { min?: string }) {
  const [value, setValue] = useState('2030-01-10');
  return (
    <label>
      Từ ngày
      <DateField min={min} value={value} onChange={(event) => setValue(event.target.value)} />
    </label>
  );
}

describe('DateField', () => {
  it('is the plain native date input outside the dashboards', () => {
    render(<Controlled />);
    expect(screen.queryByRole('button', { name: 'Mở lịch chọn ngày' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Từ ngày')).toHaveAttribute('type', 'date');
  });

  it('keeps the native input (typing still works) and adds a calendar button in the dashboards', () => {
    inDashboard(<Controlled />);
    const input = screen.getByLabelText('Từ ngày');
    expect(input).toHaveAttribute('type', 'date');
    expect(input).toHaveValue('2030-01-10');
    expect(screen.getByRole('button', { name: 'Mở lịch chọn ngày' })).toBeInTheDocument();
  });

  it('opens the calendar on the current month and picks a day into the field', async () => {
    inDashboard(<Controlled />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chọn ngày' });
    await user.click(within(dialog).getByRole('button', { name: /ngày 15 tháng 01 năm 2030/ }));

    expect(screen.getByLabelText('Từ ngày')).toHaveValue('2030-01-15');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('does not let a day before `min` be picked', async () => {
    inDashboard(<Controlled min="2030-01-12" />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chọn ngày' });

    expect(within(dialog).getByRole('button', { name: /ngày 11 tháng 01 năm 2030/ })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /ngày 12 tháng 01 năm 2030/ })).toBeEnabled();
  });

  it('clears an optional date and closes with Escape', async () => {
    inDashboard(<Controlled />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }));
    await user.click(await screen.findByRole('button', { name: 'Xóa ngày' }));
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('is used by Input type="date" too', () => {
    inDashboard(<Input type="date" aria-label="Nhận phòng từ ngày" defaultValue="2030-01-01" />);
    expect(screen.getByLabelText('Nhận phòng từ ngày')).toHaveAttribute('type', 'date');
    expect(screen.getByRole('button', { name: 'Mở lịch chọn ngày' })).toBeInTheDocument();
  });
});
