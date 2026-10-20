import { useCallback, useEffect, useRef, useState } from 'react';

/** Xác định mục đang đọc của trang dài để đánh dấu tab */
export function useActiveSection(ids: readonly string[], enabled = true) {
  const [active, setActive] = useState(ids[0]);
  const pinned = useRef(false);

  const select = useCallback((id: string) => {
    pinned.current = true;
    setActive(id);
  }, []);

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return;
    const follow = (id: string) => {
      if (!pinned.current) setActive(id);
    };
    const inBand = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        }
        const current = ids.find((id) => inBand.has(id));
        if (current) follow(current);
      },
      // Vùng đọc nằm dưới thanh đầu trang và tab
      { rootMargin: '-140px 0px -55% 0px' }
    );
    ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    // Cuối trang thì mục cuối là mục đang đọc
    const onScroll = () => {
      const root = document.documentElement;
      const scrollable = root.scrollHeight > window.innerHeight + 10;
      if (scrollable && window.innerHeight + window.scrollY >= root.scrollHeight - 2) follow(ids[ids.length - 1]);
    };
    const release = () => {
      pinned.current = false;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    for (const name of ['wheel', 'touchmove', 'keydown']) window.addEventListener(name, release, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      for (const name of ['wheel', 'touchmove', 'keydown']) window.removeEventListener(name, release);
    };
  }, [enabled, ids]);

  return [active, select] as const;
}
