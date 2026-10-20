import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, type Location } from 'react-router-dom';

/** Quá thời gian này trang cũ được thay bằng trang mới */
const GIVE_UP_MS = 1200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Vị trí mà vùng trang cần render, chuyển trang qua View Transition */
export function usePageTransitionLocation(): Location {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(location);
  const inFlight = useRef<{ transition: ViewTransition; settle: () => void } | null>(null);

  useEffect(() => {
    if (location.key === displayed.key) return;

    // Lần điều hướng mới thay thế lần đang chờ
    if (inFlight.current) {
      inFlight.current.settle();
      inFlight.current.transition.skipTransition();
      inFlight.current = null;
      setDisplayed(location);
      return;
    }

    const animate =
      location.pathname !== displayed.pathname &&
      typeof document !== 'undefined' &&
      typeof document.startViewTransition === 'function' &&
      !prefersReducedMotion();
    if (!animate) {
      setDisplayed(location);
      return;
    }

    let settle: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      settle = resolve;
    });
    const giveUp = window.setTimeout(() => settle(), GIVE_UP_MS);
    const transition = document.startViewTransition(() => {
      // Chuyển trang như React transition
      startTransition(() => setDisplayed(location));
      return ready;
    });
    inFlight.current = { transition, settle };
    void transition.finished.finally(() => {
      window.clearTimeout(giveUp);
      if (inFlight.current?.transition === transition) inFlight.current = null;
    });
    // Chỉ chạy khi vị trí router đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // Trang mới đã vào DOM, bắt đầu hiệu ứng
  useLayoutEffect(() => {
    inFlight.current?.settle();
  }, [displayed]);

  return displayed;
}
