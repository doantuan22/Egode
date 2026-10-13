import { act, render, screen } from '@testing-library/react';
import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MainLayout from '../layouts/MainLayout';
import { Reveal } from './Reveal';
import { useAuthStore } from '../../lib/authStore';
import { renderWithProviders } from '../../test/testUtils';

describe('Reveal', () => {
  const original = globalThis.IntersectionObserver;
  afterEach(() => {
    globalThis.IntersectionObserver = original;
    vi.restoreAllMocks();
  });

  it('shows its block at once when IntersectionObserver is missing (nothing stays hidden)', () => {
    // @ts-expect-error — simulating an environment without the API
    delete globalThis.IntersectionObserver;
    render(<Reveal as="section" data-testid="block">hello</Reveal>);

    expect(screen.getByTestId('block')).toHaveAttribute('data-reveal', 'in');
    expect(screen.getByTestId('block').tagName).toBe('SECTION');
  });

  const placeAt = (top: number) =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);

  it('stays pending below the fold until the block is seen, then reveals it once', () => {
    placeAt(5000);
    let notify: (entries: Array<{ isIntersecting: boolean }>) => void = () => {};
    const disconnect = vi.fn();
    globalThis.IntersectionObserver = class {
      constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) { notify = callback; }
      observe() {}
      disconnect = disconnect;
    } as unknown as typeof IntersectionObserver;

    render(<Reveal data-testid="block">hello</Reveal>);
    expect(screen.getByTestId('block')).toHaveAttribute('data-reveal', 'pending');

    act(() => notify([{ isIntersecting: false }]));
    expect(screen.getByTestId('block')).toHaveAttribute('data-reveal', 'pending');

    act(() => notify([{ isIntersecting: true }]));
    expect(screen.getByTestId('block')).toHaveAttribute('data-reveal', 'in');
    expect(screen.getByTestId('block')).not.toHaveAttribute('data-reveal-instant');
    expect(disconnect).toHaveBeenCalled();
  });

  it('a block that is already on screen is shown at once, without an entrance of its own', () => {
    placeAt(100);
    render(<Reveal data-testid="block">hello</Reveal>);

    expect(screen.getByTestId('block')).toHaveAttribute('data-reveal', 'in');
    expect(screen.getByTestId('block')).toHaveAttribute('data-reveal-instant', 'true');
  });
});

describe('route fallback', () => {
  beforeEach(() => useAuthStore.setState({ accessToken: null, role: null, isBootstrapping: false }));

  it('keeps the header and footer and shows a loading status inside the layout while a page loads', () => {
    const Pending = lazy(() => new Promise<never>(() => {}));
    renderWithProviders(
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Pending />} />
        </Route>
      </Routes>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Đang tải trang...');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
});
