import { startTransition, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, type Location } from 'react-router-dom';

/** If the next page is not ready by then, the old page is released and the new one simply replaces it. */
const GIVE_UP_MS = 1200;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The location the page area should RENDER. It follows the router's location, but a change of page goes through the
 * browser's View Transition: the old page's picture stays up until the next page has rendered, then the two dissolve
 * into each other (see ::view-transition-* in motion.css). There is no moment with a blank or half-faded page, which
 * is what a plain fade-in looks like as a flash.
 *
 * Only a change of pathname is a "page change"; a new query string (filters, pages of a list) swaps at once.
 * Browsers without the API, and reduced-motion users, get an instant swap.
 */
export function usePageTransitionLocation(): Location {
  const location = useLocation();
  const [displayed, setDisplayed] = useState(location);
  const inFlight = useRef<{ transition: ViewTransition; settle: () => void } | null>(null);

  useEffect(() => {
    if (location.key === displayed.key) return;

    // A newer navigation overtakes one still waiting: drop the animation and show the latest page.
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
      // As a React transition: a page whose code is still loading keeps the old one in place until it can render.
      startTransition(() => setDisplayed(location));
      return ready;
    });
    inFlight.current = { transition, settle };
    void transition.finished.finally(() => {
      window.clearTimeout(giveUp);
      if (inFlight.current?.transition === transition) inFlight.current = null;
    });
    // `displayed` is deliberately not a dependency: this runs for a new router location only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  // The new page is in the DOM: let the browser take its picture and start the dissolve.
  useLayoutEffect(() => {
    inFlight.current?.settle();
  }, [displayed]);

  return displayed;
}
