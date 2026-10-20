import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

const T0 = new Date('2030-01-01T10:00:00.000Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

describe('useCountdown', () => {
  it('counts down once a second from the seconds the server reported at the moment the data arrived', () => {
    const { result } = renderHook(() => useCountdown(10, T0, () => undefined));
    expect(result.current).toBe(10);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(result.current).toBe(7);
  });

  it('does not depend on the device clock: time already passed since the data arrived is subtracted', () => {
    // Dữ liệu đến cách đây 4 giây
    const { result } = renderHook(() => useCountdown(10, T0 - 4000, () => undefined));
    expect(result.current).toBe(6);
  });

  it('is null while there is no hold', () => {
    const { result } = renderHook(() => useCountdown(null, T0, () => undefined));
    expect(result.current).toBeNull();
  });

  it('stops at 0 and reports the end exactly once', () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() => useCountdown(2, T0, onEnd));

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe(0);
    expect(onEnd).toHaveBeenCalledTimes(1);

    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('starts over when fresh data arrives', () => {
    const { result, rerender } = renderHook(({ secondsLeft, startedAt }) => useCountdown(secondsLeft, startedAt, () => undefined), {
      initialProps: { secondsLeft: 10, startedAt: T0 },
    });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(5);

    rerender({ secondsLeft: 60, startedAt: T0 + 5000 });
    expect(result.current).toBe(60);
  });
});
