import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveSection } from './useActiveSection';

class FakeObserver {
  static instances: FakeObserver[] = [];
  targets: Element[] = [];
  constructor(public callback: (entries: Array<Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>>) => void) {
    FakeObserver.instances.push(this);
  }
  observe(element: Element) { this.targets.push(element); }
  disconnect() { this.targets = []; }
}

const IDS = ['rooms', 'overview', 'amenities'] as const;

beforeEach(() => {
  FakeObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  IDS.forEach((id) => { const el = document.createElement('section'); el.id = id; document.body.append(el); });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const see = (id: string, isIntersecting: boolean) =>
  act(() => FakeObserver.instances[0].callback([{ target: document.getElementById(id)!, isIntersecting }]));

describe('useActiveSection', () => {
  it('starts with the first section', () => {
    const { result } = renderHook(() => useActiveSection(IDS));
    expect(result.current[0]).toBe('rooms');
  });

  it('follows the section that is being read', () => {
    const { result } = renderHook(() => useActiveSection(IDS));

    see('overview', true);
    expect(result.current[0]).toBe('overview');

    see('overview', false);
    see('amenities', true);
    expect(result.current[0]).toBe('amenities');
  });

  it('when several sections are in the reading band, the one that comes first on the page wins', () => {
    const { result } = renderHook(() => useActiveSection(IDS));

    see('amenities', true);
    see('overview', true);

    expect(result.current[0]).toBe('overview');
  });

  it('keeps the last section when none is in the band (between two sections)', () => {
    const { result } = renderHook(() => useActiveSection(IDS));
    see('overview', true);

    see('overview', false);

    expect(result.current[0]).toBe('overview');
  });

  it('watches nothing until enabled (the sections do not exist yet)', () => {
    const { rerender } = renderHook(({ enabled }) => useActiveSection(IDS, enabled), { initialProps: { enabled: false } });
    expect(FakeObserver.instances).toHaveLength(0);

    rerender({ enabled: true });
    expect(FakeObserver.instances[0].targets.map((el) => el.id)).toEqual([...IDS]);
  });

  describe('at the bottom of the page', () => {
    const setViewport = (scrollHeight: number, innerHeight: number, scrollY: number) => {
      Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: scrollHeight });
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
      Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
    };

    it('marks the last section when the page cannot scroll any further, even if it never reaches the reading band', () => {
      setViewport(3000, 900, 0);
      const { result } = renderHook(() => useActiveSection(IDS));
      see('overview', true);
      expect(result.current[0]).toBe('overview');

      setViewport(3000, 900, 2100);
      act(() => { window.dispatchEvent(new Event('scroll')); });

      expect(result.current[0]).toBe('amenities');
    });

    it('does not jump to the last section on a page that is not scrollable', () => {
      setViewport(800, 900, 0);
      const { result } = renderHook(() => useActiveSection(IDS));

      act(() => { window.dispatchEvent(new Event('scroll')); });

      expect(result.current[0]).toBe('rooms');
    });
  });

  describe('choosing a tab', () => {
    it('shows the chosen section as current straight away and keeps it there while the page scrolls itself to it', () => {
      const { result } = renderHook(() => useActiveSection(IDS));

      act(() => result.current[1]('amenities'));
      expect(result.current[0]).toBe('amenities');

      // Trang còn đang cuộn
      see('overview', true);
      expect(result.current[0]).toBe('amenities');
    });

    it.each(['wheel', 'touchmove', 'keydown'])('follows the reader again after they scroll by hand (%s)', (eventName) => {
      const { result } = renderHook(() => useActiveSection(IDS));
      act(() => result.current[1]('amenities'));

      act(() => { window.dispatchEvent(new Event(eventName)); });
      see('overview', true);

      expect(result.current[0]).toBe('overview');
    });
  });

  it('does not fail where IntersectionObserver does not exist', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const { result } = renderHook(() => useActiveSection(IDS));
    expect(result.current[0]).toBe('rooms');
  });
});
