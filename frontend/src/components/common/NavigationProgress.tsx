import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

type Phase = 'idle' | 'loading' | 'done';

/** Click liên kết lâu hơn mức này mới hiện thanh tiến trình */
const SHOW_AFTER_MS = 160;
/** Chặn thanh chạy mãi khi điều hướng không hoàn tất */
const GIVE_UP_MS = 12_000;

/** Đường dẫn nội bộ mà click trái vào liên kết sẽ tới, hoặc null */
function targetOf(event: MouseEvent, link: HTMLAnchorElement | null): string | null {
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  if (link.target && link.target !== '_self') return null;
  if (link.hasAttribute('download')) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  return url.pathname + url.search;
}

/** Thanh mảnh báo trang đang tải khi điều hướng chậm */
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
