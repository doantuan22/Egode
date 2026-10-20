import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export function NavigationEffects() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Có #anchor thì trang đích tự cuộn tới sau khi tải xong
    if (import.meta.env.MODE !== 'test' && !hash) window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.querySelector<HTMLElement>('#main-content')?.focus({ preventScroll: true });
  }, [pathname, hash]);

  return null;
}
