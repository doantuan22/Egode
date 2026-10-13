import { useEffect, useLayoutEffect, useRef, useState, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  children?: ReactNode;
}

/**
 * Fades a block in the first time it scrolls into view (motion.css, `[data-reveal]`). Without IntersectionObserver the
 * block is simply shown, and reduced-motion users get no movement at all (the CSS only applies under no-preference).
 */
export function Reveal({ as: Tag = 'div', children, ...rest }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  // A block already on screen when the page appears is simply there: no second fade on top of the page's own.
  const [instant, setInstant] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element && element.getBoundingClientRect().top < window.innerHeight * 0.9) {
      setInstant(true);
      setShown(true);
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal={shown ? 'in' : 'pending'} data-reveal-instant={instant || undefined} {...rest}>
      {children}
    </Tag>
  );
}
