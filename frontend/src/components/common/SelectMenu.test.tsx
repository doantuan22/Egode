import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { Select } from './Select';
import { DashboardUiContext } from './DashboardUiContext';

const inDashboard = (node: React.ReactNode) => render(<DashboardUiContext.Provider value>{node}</DashboardUiContext.Provider>);
const face = () => document.querySelector('.ui-select__face') as HTMLElement;

function Controlled({ onChange = () => undefined }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <Select
      label="Trạng thái"
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        onChange(event.target.value);
      }}
    >
      <option value="">Tất cả trạng thái</option>
      {['Hoạt động', 'Khóa'].map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </Select>
  );
}

describe('Select in the dashboards', () => {
  it('stays the plain native select outside the dashboards', () => {
    render(<Controlled />);
    expect(document.querySelector('.ui-select')).toBeNull();
    expect(screen.getByLabelText('Trạng thái').tagName).toBe('SELECT');
  });

  it('keeps the native select as the labelled control and shows its value on a styled face', async () => {
    inDashboard(<Controlled />);
    const select = screen.getByLabelText('Trạng thái');
    expect(select.tagName).toBe('SELECT');
    expect(face()).toHaveTextContent('Tất cả trạng thái');
    expect(face()).toHaveAttribute('aria-hidden', 'true');

    await userEvent.setup().selectOptions(select, 'Khóa');

    expect(face()).toHaveTextContent('Khóa');
  });

  it('opens a list on click, marks the current option, and choosing one changes the native value and calls onChange', async () => {
    const onChange = vi.fn();
    inDashboard(<Controlled onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(face());
    const list = await screen.findByRole('listbox');
    expect(within(list).getAllByRole('option').map((option) => option.textContent)).toEqual(['Tất cả trạng thái', 'Hoạt động', 'Khóa']);
    expect(within(list).getByRole('option', { name: 'Tất cả trạng thái' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(list).getByRole('option', { name: 'Hoạt động' }));

    expect(onChange).toHaveBeenCalledWith('Hoạt động');
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('Hoạt động');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(face()).toHaveTextContent('Hoạt động');
  });

  it('works from the keyboard: Space opens, arrows move, Enter chooses, Escape closes', async () => {
    inDashboard(<Controlled />);
    const user = userEvent.setup();
    const select = screen.getByLabelText('Trạng thái');

    select.focus();
    await user.keyboard(' ');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(select).toHaveValue('Khóa');
    expect(select).toHaveFocus();

    await user.keyboard(' ');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(select).toHaveValue('Khóa');
  });

  it('closes when the user clicks elsewhere', async () => {
    inDashboard(
      <>
        <Controlled />
        <button type="button">Ngoài</button>
      </>
    );
    const user = userEvent.setup();
    await user.click(face());
    await screen.findByRole('listbox');

    await user.click(screen.getByRole('button', { name: 'Ngoài' }));

    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('does not open when disabled', async () => {
    inDashboard(
      <Select label="Vai trò" disabled>
        <option value="a">A</option>
      </Select>
    );
    await userEvent.setup().click(face());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('works with react-hook-form (register + defaultValue) and follows reset()', async () => {
    const onSubmit = vi.fn();
    function Form() {
      const { register, handleSubmit, reset } = useForm({ defaultValues: { star: '4' } });
      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Select label="Hạng sao" {...register('star')}>
            <option value="3">3 sao</option>
            <option value="4">4 sao</option>
            <option value="5">5 sao</option>
          </Select>
          <button type="submit">Lưu</button>
          <button type="button" onClick={() => reset({ star: '5' })}>
            Đặt lại
          </button>
        </form>
      );
    }
    inDashboard(<Form />);
    const user = userEvent.setup();
    await waitFor(() => expect(face()).toHaveTextContent('4 sao'));

    await user.click(face());
    await user.click(within(await screen.findByRole('listbox')).getByRole('option', { name: '3 sao' }));
    await user.click(screen.getByRole('button', { name: 'Lưu' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toEqual({ star: '3' });

    await user.click(screen.getByRole('button', { name: 'Đặt lại' }));
    await waitFor(() => expect(face()).toHaveTextContent('5 sao'));
  });
});
