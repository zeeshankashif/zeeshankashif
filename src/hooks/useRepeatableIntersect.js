import { useEffect, useRef, useState } from 'react';

/**
 * Sets `active` true while the element intersects the viewport.
 * If `once` is true, it triggers once and stays active.
 */
export function useRepeatableIntersect(
  threshold = 0.12,
  rootMargin = '0px 0px -8% 0px',
  once = false
) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (once) {
          if (entry.isIntersecting) {
            setActive(true);
            observer.unobserve(entry.target);
          }
          return;
        }

        setActive(entry.isIntersecting);
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return [ref, active];
}
