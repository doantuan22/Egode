import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PartnerApplyPage from './PartnerApplyPage';
import { useApplyPartner, useMyPartnerApplication } from '../../features/partners/hooks';
import { applyPartnerSchema } from '../../features/partners/schemas';
import { renderWithProviders } from '../../test/testUtils';

vi.mock('../../features/partners/hooks');

const mutate = vi.fn();
const CONFIRM_ERROR = 'Vui lòng xác nhận thông tin cung cấp là chính xác';
const valid = { SoCCCD: '012345678901', SoGiayPhepKinhDoanh: 'GP-001', MaSoThue: '0101234567', TepGiayTo: 'https://files.test/gp.pdf' };

beforeEach(() => {
  mutate.mockReset();
  vi.mocked(useMyPartnerApplication).mockReturnValue({ isLoading: false, data: undefined } as unknown as ReturnType<typeof useMyPartnerApplication>);
  vi.mocked(useApplyPartner).mockReturnValue({ mutate, isError: false, isPending: false, data: undefined, error: null } as unknown as ReturnType<typeof useApplyPartner>);
});

const field = (label: RegExp) => screen.getByLabelText(label);
const confirmBox = () => screen.getByRole('checkbox', { name: /xác nhận các thông tin cung cấp/ });
const submit = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Nộp hồ sơ đối tác' }));
const fillBusinessFields = async (user: ReturnType<typeof userEvent.setup>, values: Partial<typeof valid> = {}) => {
  const v = { ...valid, ...values };
  if (v.SoCCCD) await user.type(field(/Số CCCD/), v.SoCCCD);
  if (v.SoGiayPhepKinhDoanh) await user.type(field(/Số giấy phép kinh doanh/), v.SoGiayPhepKinhDoanh);
  if (v.MaSoThue) await user.type(field(/Mã số thuế/), v.MaSoThue);
  if (v.TepGiayTo) await user.type(field(/Đường dẫn tệp giấy tờ/), v.TepGiayTo);
};

describe('PartnerApplyPage mandatory confirmation checkbox', () => {
  it('starts unchecked and is not an HTML-required control (the schema decides)', () => {
    renderWithProviders(<PartnerApplyPage />);
    expect(confirmBox()).not.toBeChecked();
    expect(confirmBox()).not.toBeRequired();
  });

  it('everything filled but the box unchecked: nothing is submitted and the message sits under the checkbox', async () => {
    renderWithProviders(<PartnerApplyPage />);
    const user = userEvent.setup();
    await fillBusinessFields(user);

    await submit(user);

    expect(await screen.findByText(CONFIRM_ERROR)).toBeInTheDocument();
    expect(confirmBox()).toHaveAttribute('aria-invalid', 'true');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('the box checked: the application is submitted with the four business fields only', async () => {
    renderWithProviders(<PartnerApplyPage />);
    const user = userEvent.setup();
    await fillBusinessFields(user);
    await user.click(confirmBox());

    await submit(user);

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toEqual(valid); // no XacNhanThongTin leaks to the API
    expect(screen.queryByText(CONFIRM_ERROR)).not.toBeInTheDocument();
  });

  it('un-checking it again brings the block back, checking it clears the message', async () => {
    renderWithProviders(<PartnerApplyPage />);
    const user = userEvent.setup();
    await fillBusinessFields(user);
    await submit(user);
    expect(await screen.findByText(CONFIRM_ERROR)).toBeInTheDocument();

    await user.click(confirmBox());
    await waitFor(() => expect(screen.queryByText(CONFIRM_ERROR)).not.toBeInTheDocument());

    await user.click(confirmBox());
    await submit(user);
    expect(await screen.findByText(CONFIRM_ERROR)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('the other fields keep their own messages — the checkbox neither hides nor replaces them', async () => {
    renderWithProviders(<PartnerApplyPage />);
    const user = userEvent.setup();
    await user.click(confirmBox()); // confirmed, but the form is empty

    await submit(user);

    expect(await screen.findByText('Số CCCD không hợp lệ')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập số giấy phép kinh doanh')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập mã số thuế')).toBeInTheDocument();
    expect(screen.getByText('Vui lòng nhập đường dẫn hợp lệ (URL) tới tệp giấy tờ')).toBeInTheDocument();
    expect(screen.queryByText(CONFIRM_ERROR)).not.toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('unchecked AND another field invalid: both messages are shown together', async () => {
    renderWithProviders(<PartnerApplyPage />);
    const user = userEvent.setup();
    await fillBusinessFields(user, { MaSoThue: '' });

    await submit(user);

    expect(await screen.findByText('Vui lòng nhập mã số thuế')).toBeInTheDocument();
    expect(screen.getByText(CONFIRM_ERROR)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });
});

describe('applyPartnerSchema confirmation rule', () => {
  it('rejects false and a missing value, accepts true', () => {
    expect(applyPartnerSchema.safeParse({ ...valid, XacNhanThongTin: false }).success).toBe(false);
    expect(applyPartnerSchema.safeParse(valid).success).toBe(false);
    const result = applyPartnerSchema.safeParse({ ...valid, XacNhanThongTin: true });
    expect(result.success).toBe(true);
  });
});
