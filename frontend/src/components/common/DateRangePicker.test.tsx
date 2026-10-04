import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/testUtils';
import { DateRangePicker } from './DateRangePicker';

const day = (key: string) => document.querySelector(`[data-day="${key}"] button`) as HTMLButtonElement;

describe('DateRangePicker bounds', () => {
  it('while choosing a check-in: disables days before min and after maxCheckIn', () => {
    renderWithProviders(<DateRangePicker value={{ from: '', to: '' }} min="2099-05-03" maxCheckIn="2099-05-20" onChange={vi.fn()} />);

    expect(day('2099-05-02')).toBeDisabled();
    expect(day('2099-05-03')).not.toBeDisabled();
    expect(day('2099-05-20')).not.toBeDisabled();
    expect(day('2099-05-21')).toBeDisabled();
  });

  it('while choosing a check-out: allows at most maxNights nights after the check-in', () => {
    renderWithProviders(<DateRangePicker value={{ from: '2099-05-01', to: '' }} min="2099-04-20" maxCheckIn="2099-05-20" maxNights={3} onChange={vi.fn()} />);

    expect(day('2099-05-04')).not.toBeDisabled(); // 3 nights
    expect(day('2099-05-05')).toBeDisabled(); // 4 nights
    // The check-in window only limits the check-in, not the day the guest leaves.
    expect(day('2099-05-25')).toBeDisabled();
  });

  it('a complete range restarts with the next click as a new check-in', () => {
    const onChange = vi.fn();
    renderWithProviders(<DateRangePicker value={{ from: '2099-05-01', to: '2099-05-03' }} min="2099-04-20" maxCheckIn="2099-06-30" maxNights={30} onChange={onChange} />);

    day('2099-05-10').click();
    expect(onChange).toHaveBeenCalledWith({ from: '2099-05-10', to: '' });
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });
});
