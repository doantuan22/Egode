import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationProgress } from './NavigationProgress';

function Page({ name }: { name: string }) {
  const navigate = useNavigate();
  return (
    <div>
      <p>{name}</p>
      <Link to="/next">internal</Link>
      <Link to="/">same page</Link>
      <a href="https://example.com/x" onClick={(event) => event.preventDefault()}>external</a>
      <Link to="/next" target="_blank" onClick={(event) => event.preventDefault()}>new tab</Link>
      <button type="button" onClick={() => navigate('/next')}>go</button>
    </div>
  );
}

const phase = () => document.querySelector('.nav-progress')!.getAttribute('data-phase');

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <NavigationProgress />
      <Routes>
        <Route path="/" element={<Page name="home" />} />
        <Route path="/next" element={<Page name="next" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('NavigationProgress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stays hidden for a navigation that finishes quickly', () => {
    renderApp();
    fireEvent.click(screen.getByText('internal'));
    // the page changed within the same tick, before the bar's delay
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('next')).toBeInTheDocument();
    expect(phase()).toBe('idle');
  });

  it('ignores clicks that are not navigations: same page, other origin, new tab, modified clicks', () => {
    renderApp();
    fireEvent.click(screen.getByText('same page'));
    fireEvent.click(screen.getByText('external'));
    fireEvent.click(screen.getByText('new tab'));
    fireEvent.click(screen.getByText('external'), { ctrlKey: true });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(phase()).toBe('idle');
  });

  it('shows the bar when a click is not answered in time and finishes it when the location changes', () => {
    // A link whose navigation is held back: the click is heard, the location does not change.
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationProgress />
        <a href="/slow" onClick={(event) => event.preventDefault()}>slow</a>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('slow'));
    act(() => { vi.advanceTimersByTime(100); });
    expect(phase()).toBe('idle');
    act(() => { vi.advanceTimersByTime(100); });
    expect(phase()).toBe('loading');
  });

  it('gives up by itself if a navigation never lands', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <NavigationProgress />
        <a href="/slow" onClick={(event) => event.preventDefault()}>slow</a>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('slow'));
    act(() => { vi.advanceTimersByTime(300); });
    expect(phase()).toBe('loading');
    act(() => { vi.advanceTimersByTime(12_000); });
    expect(phase()).toBe('idle');
  });
});
