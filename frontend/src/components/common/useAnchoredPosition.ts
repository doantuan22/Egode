import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export interface AnchoredPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 6;
const MARGIN = 12;

/**
 * Where to put a popover (rendered in a portal with `position: fixed`) so it hangs under `anchor`, or above it when
 * there is more room there. Fixed + portal keeps it from being clipped by the `overflow: hidden` cards and tables of
 * the dashboards. It closes (via `onClose`) when the page scrolls or resizes, instead of drifting away from its field.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  preferredHeight = 320,
  /** Width of the popover when it is wider than the field (a calendar): keeps it inside the window. */
  popoverWidth?: number
) {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const measure = useCallback(() => {
    const element = anchor.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - MARGIN;
    const above = rect.top - MARGIN;
    const placeAbove = below < Math.min(preferredHeight, 220) && above > below;
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - MARGIN - Math.max(rect.width, popoverWidth ?? 0)));
    setPosition(
      placeAbove
        ? { bottom: window.innerHeight - rect.top + GAP, left, width: rect.width, maxHeight: Math.max(120, above - GAP) }
        : { top: rect.bottom + GAP, left, width: rect.width, maxHeight: Math.max(120, below - GAP) }
    );
  }, [anchor, preferredHeight, popoverWidth]);

  useLayoutEffect(() => {
    if (open) measure();
    else setPosition(null);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (event: Event) => {
      // Scrolling inside the popover itself (a long option list) must not close it.
      if (event.target instanceof Element && event.target.closest('[data-anchored-popover]')) return;
      onClose();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [open, onClose]);

  return position;
}
