import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationEffects } from './NavigationEffects';

function Go({ to }: { to: string }) {
  const navigate = useNavigate();
  return <button onClick={() => navigate(to)}>go</button>;
}

function setup(initial: string, to: string) {
  const utils = render(
    <MemoryRouter initialEntries={[initial]}>
      <NavigationEffects />
      <Routes>
        <Route path="*" element={<Go to={to} />} />
      </Routes>
    </MemoryRouter>
  );
  return utils;
}

beforeEach(() => {
  // Giả lập bản build thật vì chế độ test bỏ qua cuộn trang
  vi.stubEnv('MODE', 'development');
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});

afterEach(() => vi.unstubAllEnvs());

describe('NavigationEffects', () => {
  it('scrolls to the top after navigating to another page', () => {
    const { getByText } = setup('/a', '/b');
    vi.mocked(window.scrollTo).mockClear();

    getByText('go').click();

    return vi.waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' }));
  });

  it('leaves the scroll position to the page when the URL has an #anchor', async () => {
    const { getByText } = setup('/a', '/bookings/5#danh-gia');
    vi.mocked(window.scrollTo).mockClear();

    getByText('go').click();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
