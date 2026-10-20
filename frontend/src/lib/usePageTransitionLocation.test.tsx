import { act, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePageTransitionLocation } from './usePageTransitionLocation';

function App() {
  const location = usePageTransitionLocation();
  return (
    <>
      <Link to="/a">to a</Link>
      <Link to="/?filter=1">same page, new query</Link>
      <Routes location={location}>
        <Route path="/" element={<p>home</p>} />
        <Route path="/a" element={<p>page a</p>} />
      </Routes>
    </>
  );
}

const renderApp = () => render(<MemoryRouter><App /></MemoryRouter>);

interface FakeTransition { finished: Promise<void>; skipTransition: () => void }
const original = (document as unknown as { startViewTransition?: unknown }).startViewTransition;
afterEach(() => {
  (document as unknown as { startViewTransition?: unknown }).startViewTransition = original;
  vi.restoreAllMocks();
});

/** Giả lập trình duyệt giữ trang cũ đến khi promise xong */
function installViewTransition() {
  const calls: Array<{ update: () => Promise<void> | void; done: () => void }> = [];
  (document as unknown as { startViewTransition: unknown }).startViewTransition = vi.fn((update: () => Promise<void> | void) => {
    let done: () => void = () => {};
    const finished = new Promise<void>((resolve) => { done = resolve; });
    calls.push({ update, done });
    const transition: FakeTransition = { finished, skipTransition: vi.fn() };
    return transition;
  });
  return calls;
}

describe('usePageTransitionLocation', () => {
  it('swaps pages at once when the browser has no View Transition API', async () => {
    (document as unknown as { startViewTransition?: unknown }).startViewTransition = undefined;
    renderApp();

    await userEvent.setup().click(screen.getByText('to a'));

    expect(screen.getByText('page a')).toBeInTheDocument();
  });

  it('keeps the old page until the browser runs the update, then shows the new one', async () => {
    const calls = installViewTransition();
    renderApp();
    expect(screen.getByText('home')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByText('to a'));
    // Router đã chuyển nhưng vẫn hiện trang cũ
    expect(calls).toHaveLength(1);
    expect(screen.getByText('home')).toBeInTheDocument();

    let updated: Promise<void> | void = undefined;
    act(() => {
      updated = calls[0].update();
    });

    // Trang mới đã render và trình duyệt được báo ngay
    expect(screen.getByText('page a')).toBeInTheDocument();
    await expect(Promise.race([updated, new Promise((resolve) => setTimeout(() => resolve('late'), 200))])).resolves.toBeUndefined();
    act(() => calls[0].done());
  });

  it('does not animate a change of query string only', async () => {
    const calls = installViewTransition();
    renderApp();

    await userEvent.setup().click(screen.getByText('same page, new query'));

    expect(calls).toHaveLength(0);
    expect(screen.getByText('home')).toBeInTheDocument();
  });

  it('does not animate for reduced-motion users', async () => {
    const calls = installViewTransition();
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    renderApp();

    await userEvent.setup().click(screen.getByText('to a'));

    expect(calls).toHaveLength(0);
    expect(screen.getByText('page a')).toBeInTheDocument();
  });
});
