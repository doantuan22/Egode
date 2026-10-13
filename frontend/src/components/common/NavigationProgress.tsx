import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Phase = 'idle' | 'loading' | 'done';

/** A click on a link this long without the new page being ready is worth a progress bar; quicker ones show nothing. */
const SHOW_AFTER_MS = 160;
/** Safety net: never leave the bar crawling if a navigation never lands. */
const GIVE_UP_MS = 12_000;

/** The internal path a plain left click on `link` would navigate to, or null when the click is not a navigation. */
function targetOf(event: MouseEvent, link: HTMLAnchorElement | null): string | null {
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (link.target && link.target !== '_self') return null;
  if (link.hasAttribute('download')) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return url.pathname + url.search;
}

/**
 * A slim bar under the top edge for navigations that take a moment. The old page stays on screen until the next one is
 * ready (no blank in between), and this bar is what tells the visitor that the click was heard.
 */
export function NavigationProgress() {
  const { pathname, search } = useLocation();
  const [phase, setPhase] = useState<Phase>('idle');
  const current = useRef(pathname + search);
  const showTimer = useRef<number>(undefined);
  const giveUpTimer = useRef<number>(undefined);

  useEffect(() => {
    current.current = pathname + search;
    window.clearTimeout(showTimer.current);
    window.clearTimeout(giveUpTimer.current);
    setPhase((phase) => (phase === 'loading' ? 'done' : phase));
    const hide = window.setTimeout(() => setPhase('idle'), 500);
    return () => window.clearTimeout(hide);
  }, [pathname, search]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      const target = targetOf(event, link);
      if (!target || target === current.current) return;
      window.clearTimeout(showTimer.current);
      window.clearTimeout(giveUpTimer.current);
      showTimer.current = window.setTimeout(() => setPhase('loading'), SHOW_AFTER_MS);
      giveUpTimer.current = window.setTimeout(() => setPhase('idle'), GIVE_UP_MS);
    };
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(giveUpTimer.current);
    };
  }, []);

  return (
    <div className="nav-progress" data-phase={phase} aria-hidden="true">
      <span />
    </div>
  );
}
